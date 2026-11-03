using BCrypt.Net;
using Core.DTOs.Interfaces;
using Core.DTOs;
using Core.Models;
using Core.Provider;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;
using Core.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.RateLimiting;

namespace Core.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController(IAuthProviderDTO authProvider, IPasswordResetEmailService emailService, IConfiguration configuration, IBitacoraProviderDTO bitacora, AccountService accountService) : ControllerBase
    {
        private readonly IAuthProviderDTO _authProvider = authProvider;

        [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDTO request)
        {
            if (string.IsNullOrWhiteSpace(request.username) || string.IsNullOrWhiteSpace(request.password))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = "El usuario y la contraseña son obligatorios."
                });
            }
            try
            {
      
                UsuarioLoginDTO? usuarioEnBD = await _authProvider.ObtenerUsuarioParaLoginAsync(request.username);

                if (usuarioEnBD == null)
                {
                    await AuditLogin(null,request.username,"Fallido",401,"Usuario inexistente o credenciales incorrectas.");
                    return Unauthorized(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Usuario o contraseña incorrectos."
                    });
                }

                bool passwordCorrecto = BCrypt.Net.BCrypt.Verify(request.password, usuarioEnBD.password);

                if (!passwordCorrecto)
                {
                    await AuditLogin(usuarioEnBD.id_usuario,usuarioEnBD.username,"Fallido",401,"Credenciales incorrectas.");
                    return Unauthorized(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Usuario o contraseña incorrectos."
                    });
                }

                var role=(usuarioEnBD.rol??"").Trim().ToLowerInvariant();
                var neverExpires=role is "administrador" or "admin" or "demo" or "superusuario";
                if(!neverExpires && (usuarioEnBD.requiere_cambio_password || usuarioEnBD.fecha_expiracion_password is null || usuarioEnBD.fecha_expiracion_password.Value.Date<DateTime.Today))
                {
                    await AuditLogin(usuarioEnBD.id_usuario,usuarioEnBD.username,"Fallido",403,"Contraseña vencida.");
                    return StatusCode(403,new ApiResponse<object>{Success=false,Message="Tu contraseña venció. Utiliza ‘¿Olvidaste tu contraseña?’ para crear una nueva.",Errors="PASSWORD_EXPIRED"});
                }

                int? idSucursalParaSP = usuarioEnBD.id_sucursal;
                if (idSucursalParaSP == 0) idSucursalParaSP = null;
                var listaSucursales = await _authProvider.ObtenerSucursalesPorUsuarioAsync(idSucursalParaSP);

                usuarioEnBD.password = string.Empty;

                string token = _authProvider.GenerarTokenJwt(usuarioEnBD);

                await AuditLogin(usuarioEnBD.id_usuario,usuarioEnBD.username,"Exitoso",200,"Inicio de sesión correcto.",idSucursalParaSP);


                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Sesión iniciada correctamente",
                    Data = new
                    {
                        Usuario = usuarioEnBD.username,
                        Token = token,
                        Sucursales = listaSucursales.Select(s => new {
                            idSucursal = s.IdSucursal,
                            nombreSuc = s.Nombre,
                            colorIdentificacion = s.ColorIdentificacion
                        }).ToList()
                    }
                });
            }
            catch (Exception ex)
            {
               
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Ocurrió un error interno en el servidor.",
                    Errors = ex.Message 
                });
            }
        }

        [Authorize]
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {
            var username = User.FindFirstValue(ClaimTypes.Name);
            if (string.IsNullOrWhiteSpace(username))
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "La sesión ya no es válida." });

            var usuario = await _authProvider.ObtenerUsuarioParaLoginAsync(username);
            if (usuario is null)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "El usuario ya no está disponible." });

            usuario.password = string.Empty;
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Sesión renovada.",
                Data = new { Token = _authProvider.GenerarTokenJwt(usuario) }
            });
        }

        private Task AuditLogin(int? idUsuario,string? username,string resultado,int codigo,string detalle,int? idSucursal=null)
            =>bitacora.RegistrarAsync(new RegistrarBitacoraDTO(idUsuario,username,idSucursal,"auth","Iniciar sesión","POST","/api/auth/login",resultado,codigo,HttpContext.Connection.RemoteIpAddress?.ToString(),detalle));

        [HttpPost("forgot-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ForgotPassword([FromBody]ForgotPasswordRequestDTO request)
        {
            const string generic="Si el usuario o correo está registrado, recibirás un enlace para restablecer la contraseña.";
            if(string.IsNullOrWhiteSpace(request.Identificador)) return BadRequest(new ApiResponse<object>{Success=false,Message="Ingresa tu usuario o correo."});
            var user=await _authProvider.ObtenerUsuarioReset(request.Identificador.Trim());
            if(user is null) return Ok(new ApiResponse<object>{Success=true,Message=generic});
            var bytes=RandomNumberGenerator.GetBytes(32);
            var token=Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_');
            var hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
            await _authProvider.GuardarTokenReset(user.IdUsuario,hash,DateTime.UtcNow.AddMinutes(30));
            var baseUrl=(configuration["FrontendBaseUrl"]??"http://localhost:5173").TrimEnd('/');
            try { await emailService.Send(user.Correo,user.Nombre,$"{baseUrl}/restablecer-password?token={Uri.EscapeDataString(token)}"); }
            catch(InvalidOperationException) { return Ok(new ApiResponse<object>{Success=true,Message=generic}); }
            return Ok(new ApiResponse<object>{Success=true,Message=generic});
        }

        [HttpPost("reset-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResetPassword([FromBody]ResetPasswordRequestDTO request)
        {
            if(string.IsNullOrWhiteSpace(request.Token))
                return BadRequest(new ApiResponse<object>{Success=false,Message="El enlace de recuperación es obligatorio."});
            if(!PasswordPolicy.IsValid(request.Password))
                return BadRequest(new ApiResponse<object>{Success=false,Message=PasswordPolicy.Message});
            try
            {
                var hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Token)));
                await accountService.ResetPasswordAsync(hash,request.Password);
                return Ok(new ApiResponse<object>{Success=true,Message="Contraseña actualizada. Ya puedes iniciar sesión."});
            }
            catch(Exception e){return BadRequest(new ApiResponse<object>{Success=false,Message=e.Message});}
        }
    }
}
