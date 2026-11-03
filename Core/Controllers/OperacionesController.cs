using System.Security.Claims;
using Core.DTOs;
using Core.DTOs.Interfaces;
using Core.Integrations.Digifact;
using Core.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Controllers;

[Authorize, ApiController, Route("api/operaciones")]
public class OperacionesController(IOperacionProviderDTO provider, IDigifactClient digifact) : ControllerBase
{
    private int UserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirst("id_usuario")?.Value, out var id) ? id : 0;
    private int Branch(int requested) { var claim = User.FindFirst("id_sucursal")?.Value; return int.TryParse(claim, out var id) && id > 0 ? id : requested; }

    [HttpGet("caja")] public async Task<IActionResult> Caja(int idSucursal) => Ok(Success("Estado de caja.", await provider.EstadoCaja(UserId(), Branch(idSucursal))));
    [HttpPost("caja/abrir")] public async Task<IActionResult> Abrir(CajaMovimientoDTO request) { try { await provider.AbrirCaja(UserId(), Branch(request.IdSucursal), request.Monto); return Ok(Success("Caja abierta correctamente.")); } catch (Exception exception) { return BadRequest(Failure(exception.Message)); } }
    [HttpPost("caja/salidas")] public async Task<IActionResult> Salida(SalidaCajaRequestDTO request) { try { await provider.RegistrarSalidaCaja(UserId(), Branch(request.IdSucursal), request.Monto, request.Concepto, request.Observaciones); return Ok(Success("Salida registrada correctamente.")); } catch (Exception exception) { return BadRequest(Failure(exception.Message)); } }
    [HttpPost("caja/cerrar")] public async Task<IActionResult> Cerrar(CajaMovimientoDTO request) { try { return Ok(Success("Caja cerrada correctamente.", await provider.CerrarCaja(UserId(), Branch(request.IdSucursal), request.Monto, request.Observaciones))); } catch (Exception exception) { return BadRequest(Failure(exception.Message)); } }
    [HttpGet("caja/movimientos")] public async Task<IActionResult> Movimientos(int idSucursal, int? idSesion = null) => Ok(Success("Movimientos de caja.", await provider.MovimientosCaja(UserId(), Branch(idSucursal), idSesion)));
    [HttpGet("caja/cierres")] public async Task<IActionResult> Cierres(int idSucursal, DateTime? fechaDesde = null, DateTime? fechaHasta = null) => Ok(Success("Cierres de caja.", await provider.CierresCaja(Branch(idSucursal), fechaDesde, fechaHasta)));
    [HttpGet("clientes")] public async Task<IActionResult> Clientes(int idSucursal, string? query = null) => Ok(Success("Clientes.", await provider.Clientes(query ?? "", Branch(idSucursal))));

    [HttpPost("clientes")]
    public async Task<IActionResult> Crear(ClienteGestionDTO request)
    {
        if (string.IsNullOrWhiteSpace(request.Nombre)) return BadRequest(Failure("El nombre es obligatorio."));
        try
        {
            var validation = await digifact.ValidateNitAsync(request.Nit, HttpContext.RequestAborted);
            if (!validation.IsValid) return BadRequest(Failure(validation.Message));
            request.Nit = validation.Nit;
            if (!validation.IsConsumerFinal) request.Nombre = validation.Name;
            var id = await provider.CrearCliente(request);
            return Ok(Success("Cliente creado.", new { IdCliente = id }));
        }
        catch (DigifactException exception) { return ProviderError(exception); }
        catch (Exception exception) { return BadRequest(Failure(exception.Message)); }
    }

    [HttpPut("clientes/{id:int}")]
    public async Task<IActionResult> Actualizar(int id, ClienteGestionDTO request)
    {
        if (string.IsNullOrWhiteSpace(request.Nombre)) return BadRequest(Failure("El nombre es obligatorio."));
        try
        {
            var validation = await digifact.ValidateNitAsync(request.Nit, HttpContext.RequestAborted);
            if (!validation.IsValid) return BadRequest(Failure(validation.Message));
            request.Nit = validation.Nit;
            if (!validation.IsConsumerFinal) request.Nombre = validation.Name;
            request.IdCliente = id;
            await provider.ActualizarCliente(request);
            return Ok(Success("Cliente actualizado."));
        }
        catch (DigifactException exception) { return ProviderError(exception); }
        catch (Exception exception) { return BadRequest(Failure(exception.Message)); }
    }

    [HttpGet("clientes/{id:int}/historial")] public async Task<IActionResult> Historial(int id, int idSucursal, DateTime? fechaDesde = null, DateTime? fechaHasta = null) => Ok(Success("Historial.", await provider.Historial(id, Branch(idSucursal), fechaDesde, fechaHasta)));
    [HttpGet("reportes/{tipo}")] public async Task<IActionResult> Reporte(string tipo, int idSucursal, DateTime fechaDesde, DateTime fechaHasta) { if (tipo is not ("ventas" or "inventario" or "cobros" or "caja")) return BadRequest(); return Ok(Success("Reporte generado.", await provider.Reporte(tipo, Branch(idSucursal), fechaDesde, fechaHasta))); }
    [HttpGet("reportes/utilidad/resumen")] public async Task<IActionResult> Utilidad(int idSucursal,DateTime fechaDesde,DateTime fechaHasta){if(fechaHasta.Date<fechaDesde.Date)return BadRequest(Failure("La fecha final no puede ser anterior a la inicial."));return Ok(Success("Rentabilidad calculada.",await provider.ReporteUtilidad(Branch(idSucursal),fechaDesde,fechaHasta)));}

    private ObjectResult ProviderError(DigifactException exception) => StatusCode(exception.StatusCode is >= 400 and < 600 ? exception.StatusCode.Value : 502, Failure(exception.Message));
    private static ApiResponse<object> Success(string message, object? data = null) => new() { Success = true, Message = message, Data = data };
    private static ApiResponse<object> Failure(string message) => new() { Success = false, Message = message };
}
