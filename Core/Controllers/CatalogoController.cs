using Core.DTOs;
using Core.Models;
using Microsoft.AspNetCore.Mvc;
using Core.DTOs.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace Core.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class CatalogoController(ICatalogoProviderDTO catalogoProvider) : ControllerBase
    {
        private readonly ICatalogoProviderDTO _catalogoProvider = catalogoProvider;

        [HttpGet("productos")]
        public async Task<IActionResult> BuscarProductos([FromQuery] string? query = null, [FromQuery] int? idSucursal = null)
        {
            try
            {
            var resultado = await _catalogoProvider.ObtenerProductosAsync(query ?? string.Empty, idSucursal);

                return Ok(new ApiResponse<IEnumerable<ProductoCatalogoDTO>>
                {
                    Success = true,
                    Message = "Productos encontrados correctamente.",
                    Data = resultado
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No fue posible buscar productos.",
                    Errors = ex.Message
                });
            }
        }

        [HttpGet("clientes")]
        public async Task<IActionResult> BuscarClientes([FromQuery] string? query = null)
        {
            try
            {
                var resultado = await _catalogoProvider.ObtenerClientesAsync(query ?? string.Empty);

                return Ok(new ApiResponse<IEnumerable<ClienteCatalogoDTO>>
                {
                    Success = true,
                    Message = "Clientes encontrados correctamente.",
                    Data = resultado
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No fue posible buscar clientes.",
                    Errors = ex.Message
                });
            }
        }

        [Authorize]
        [HttpGet("productos/por-codigo")]
        public async Task<IActionResult> BuscarProductoPorCodigo([FromQuery] string codigo, [FromQuery] int idSucursal)
        {
            if (string.IsNullOrWhiteSpace(codigo) || idSucursal <= 0)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Ingresa un código y selecciona una sucursal." });
            var producto = await _catalogoProvider.ObtenerProductoPorCodigoAsync(codigo, idSucursal);
            return producto is null
                ? NotFound(new ApiResponse<object> { Success = false, Message = "No se encontró un producto disponible con ese código." })
                : Ok(new ApiResponse<ProductoCatalogoDTO> { Success = true, Message = "Producto encontrado.", Data = producto });
        }

        [HttpGet("vendedores")]
        public async Task<IActionResult> ObtenerVendedores([FromQuery] int? idSucursal)
        {
            try
            {
                if (!idSucursal.HasValue || idSucursal.Value <= 0)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Debes seleccionar una sucursal."
                    });
                }

                var resultado = await _catalogoProvider.ObtenerVendedoresAsync(idSucursal.Value);
                return Ok(new ApiResponse<IEnumerable<VendedorCatalogoDTO>>
                {
                    Success = true,
                    Message = "Vendedores obtenidos correctamente.",
                    Data = resultado
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No fue posible obtener los vendedores.",
                    Errors = ex.Message
                });
            }
        }

        [HttpGet("monedas")]
        public async Task<IActionResult> ObtenerMonedas() => Ok(new ApiResponse<IEnumerable<MonedaCatalogoDTO>>
        {
            Success = true,
            Message = "Monedas obtenidas correctamente.",
            Data = await _catalogoProvider.ObtenerMonedasAsync()
        });

        [HttpGet("tipos-pos")]
        public async Task<IActionResult> ObtenerTiposPos() => Ok(new ApiResponse<IEnumerable<TipoPosCatalogoDTO>>
        {
            Success = true,
            Message = "Tipos de POS obtenidos correctamente.",
            Data = await _catalogoProvider.ObtenerTiposPosAsync()
        });

        [HttpGet("clientes-credito")]
        public async Task<IActionResult> BuscarClientesCredito([FromQuery] string? query = null) => Ok(new ApiResponse<IEnumerable<ClienteCreditoDTO>>
        {
            Success = true,
            Message = "Clientes autorizados obtenidos correctamente.",
            Data = await _catalogoProvider.BuscarClientesCreditoAsync(query ?? string.Empty)
        });
    }
}
