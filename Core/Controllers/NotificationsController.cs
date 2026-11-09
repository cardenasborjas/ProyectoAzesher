using System.Security.Claims;
using Core.Models;
using Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Controllers;

[Authorize, ApiController, Route("api/notificaciones")]
public sealed class NotificationsController(NotificationService notifications) : ControllerBase
{
    private int UserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    [HttpGet]
    public async Task<IActionResult> List(bool incluirLeidas = false, int limite = 20) =>
        Ok(new ApiResponse<object> { Success = true, Data = await notifications.ListAsync(UserId, incluirLeidas, limite) });

    [HttpGet("historial")]
    public async Task<IActionResult> History(int limite = 100, DateTime? fecha = null) =>
        Ok(new ApiResponse<object> { Success = true, Data = await notifications.HistoryAsync(UserId, limite, fecha) });

    [HttpPost("{id:long}/leer")]
    public async Task<IActionResult> Read(long id)
    {
        await notifications.MarkReadAsync(UserId, id);
        return Ok(new ApiResponse<object> { Success = true, Message = "Notificación leída." });
    }

    [HttpPost("leer-todas")]
    public async Task<IActionResult> ReadAll()
    {
        await notifications.MarkAllReadAsync(UserId);
        return Ok(new ApiResponse<object> { Success = true, Message = "Notificaciones leídas." });
    }

    [HttpPost("solicitudes-credito/{clientId:int}")]
    public async Task<IActionResult> RequestCredit(int clientId)
    {
        try
        {
            await notifications.RequestCreditAsync(UserId, clientId);
            return Ok(new ApiResponse<object> { Success = true, Message = "Solicitud enviada a los administradores." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}
