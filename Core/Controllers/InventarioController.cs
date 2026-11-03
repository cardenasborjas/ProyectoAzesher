using System.Security.Claims;
using Core.DTOs;
using Core.DTOs.Interfaces;
using Core.Models;
using Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class InventarioController(IInventarioProviderDTO inventarioProvider, NotificationService notifications) : ControllerBase
{
    [HttpGet("proveedores")] public async Task<IActionResult> BuscarProveedores([FromQuery]string? query=null) => Ok(new ApiResponse<object>{Success=true,Message="Proveedores obtenidos.",Data=await inventarioProvider.BuscarProveedoresAsync(query??"")});
    [HttpPost("proveedores")] public async Task<IActionResult> CrearProveedor([FromBody]ProveedorDTO supplier) { if(string.IsNullOrWhiteSpace(supplier.Nombre))return BadRequest(new ApiResponse<object>{Success=false,Message="El nombre es obligatorio."});var id=await inventarioProvider.CrearProveedorAsync(supplier);return Ok(new ApiResponse<object>{Success=true,Message="Proveedor creado.",Data=new{IdProveedor=id}}); }
    [HttpGet("proveedores/{idProveedor:int}/productos")] public async Task<IActionResult> ProductosProveedor(int idProveedor) => Ok(new ApiResponse<object>{Success=true,Message="Productos del proveedor.",Data=await inventarioProvider.ObtenerProductosProveedorAsync(idProveedor)});
    [HttpGet("entrada/proveedores")]
    public async Task<IActionResult> Proveedores() => Ok(new ApiResponse<IEnumerable<ProveedorEntradaDTO>> { Success = true, Message = "Proveedores obtenidos.", Data = await inventarioProvider.ObtenerProveedoresAsync() });

    [HttpGet("entrada/productos")]
    public async Task<IActionResult> ProductosEntrada([FromQuery] int idProveedor, [FromQuery] string? query = null) => Ok(new ApiResponse<IEnumerable<ProductoEntradaDTO>> { Success = true, Message = "Productos obtenidos.", Data = await inventarioProvider.BuscarProductosEntradaAsync(idProveedor, query ?? "") });

    [HttpPost("entrada/productos")]
    public async Task<IActionResult> CrearProducto([FromBody] CrearProductoEntradaDTO product)
    {
        if (product.IdProveedor <= 0) return BadRequest(new ApiResponse<object> { Success = false, Message = "Debes seleccionar un proveedor." });
        if (string.IsNullOrWhiteSpace(product.Nombre) || product.Precio < 0) return BadRequest(new ApiResponse<object> { Success = false, Message = "Completa un nombre y precio válidos." });
        try { var id = await inventarioProvider.CrearProductoAsync(product); return Ok(new ApiResponse<object> { Success = true, Message = "Producto creado correctamente.", Data = new { IdProducto = id } }); }
        catch (Exception ex) { return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message }); }
    }

    [HttpGet("entradas")]
    public async Task<IActionResult> Entradas([FromQuery] int? idSucursal, [FromQuery] string? query = null)
    {
        var branchId = ResolveBranch(idSucursal); if (!branchId.HasValue) return BranchRequired();
        return Ok(new ApiResponse<IEnumerable<EntradaPedidoConsultaDTO>> { Success = true, Message = "Entradas obtenidas.", Data = await inventarioProvider.BuscarEntradasAsync(branchId.Value, query ?? "") });
    }

    [HttpPost("entradas")]
    public async Task<IActionResult> RegistrarEntrada([FromBody] RegistrarEntradaPedidoDTO order)
    {
        var branchId = ResolveBranch(order.IdSucursal); if (!branchId.HasValue) return BranchRequired();
        if (order.IdProveedor <= 0 || order.Detalles.Count == 0) return BadRequest(new ApiResponse<object> { Success = false, Message = "Selecciona un proveedor y agrega productos." });
        order.IdSucursal = branchId.Value;
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var idUsuario) ? idUsuario : 0;
        try { var id = await inventarioProvider.RegistrarEntradaAsync(order, userId); return Ok(new ApiResponse<object> { Success = true, Message = "Entrada registrada e inventario actualizado.", Data = new { IdCompra = id } }); }
        catch (Exception ex) { return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message }); }
    }

    [HttpGet("entradas/{idCompra:int}")]
    public async Task<IActionResult> Entrada(int idCompra, [FromQuery] int? idSucursal)
    {
        var branchId = ResolveBranch(idSucursal); if (!branchId.HasValue) return BranchRequired();
        var rows = await inventarioProvider.ObtenerEntradaAsync(idCompra, branchId.Value);
        return rows.Count == 0
            ? NotFound(new ApiResponse<object> { Success = false, Message = "La entrada no existe en la sucursal seleccionada." })
            : Ok(new ApiResponse<IEnumerable<EntradaPedidoProductoDTO>> { Success = true, Message = "Detalle de entrada.", Data = rows });
    }

    [HttpGet("entradas/{idCompra:int}/pdf")]
    public async Task<IActionResult> EntradaPdf(int idCompra, [FromQuery] int? idSucursal)
    {
        var branchId = ResolveBranch(idSucursal); if (!branchId.HasValue) return BranchRequired();
        var rows = await inventarioProvider.ObtenerEntradaAsync(idCompra, branchId.Value);
        if (rows.Count == 0) return NotFound(new ApiResponse<object> { Success = false, Message = "La entrada no existe en la sucursal seleccionada." });
        return File(EntradaPedidoDocumentService.GeneratePdf(rows), "application/pdf", $"entrada-productos-{rows[0].NumeroPedido}.pdf");
    }

    [HttpGet("productos")]
    public async Task<IActionResult> ObtenerProductos([FromQuery] int? idSucursal, [FromQuery] string? query = null)
    {
        var branchId = ResolveBranch(idSucursal);
        if (!branchId.HasValue) return BranchRequired();
        try
        {
            var products = await inventarioProvider.ObtenerProductosAsync(branchId.Value, query ?? string.Empty);
            return Ok(new ApiResponse<IEnumerable<InventarioProductoDTO>> { Success = true, Message = "Inventario obtenido correctamente.", Data = products });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "No fue posible consultar el inventario.", Errors = ex.Message });
        }
    }

    [HttpGet("productos/{idProducto:int}/codigos-barras")]
    public async Task<IActionResult> ObtenerCodigosBarras(int idProducto) => Ok(new ApiResponse<IEnumerable<ProductoCodigoBarraDTO>>
    {
        Success = true,
        Message = "Códigos de barras obtenidos.",
        Data = await inventarioProvider.ObtenerCodigosProductoAsync(idProducto)
    });

    [HttpPut("productos/{idProducto:int}/precio")]
    public async Task<IActionResult> CambiarPrecio(int idProducto, [FromBody] CambiarPrecioProductoDTO request)
    {
        if (request.Precio <= 0) return BadRequest(new ApiResponse<object> { Success = false, Message = "El precio de venta debe ser mayor que cero." });
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
        try
        {
            if (IsAdministrator())
            {
                await inventarioProvider.ActualizarPrecioProductoAsync(idProducto, request.Precio, userId);
                return Ok(new ApiResponse<object> { Success = true, Message = "Precio de venta actualizado." });
            }
            var requestId = await notifications.RequestPriceChangeAsync(userId, idProducto, request.Precio);
            return Accepted(new ApiResponse<object> { Success = true, Message = "Solicitud enviada a administración.", Data = new { IdSolicitud = requestId } });
        }
        catch (InvalidOperationException ex) { return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message }); }
    }

    [Authorize(Roles = "demo,Demo,superusuario,Superusuario,admin,Admin,Administrador,administrador")]
    [HttpPost("productos/precio-solicitudes/{idSolicitud:int}/resolver")]
    public async Task<IActionResult> ResolverPrecio(int idSolicitud, [FromBody] ResolverCambioPrecioDTO request)
    {
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
        try { await notifications.ResolvePriceChangeAsync(idSolicitud, userId, request.Aprobar); return Ok(new ApiResponse<object> { Success = true, Message = request.Aprobar ? "Cambio de precio aprobado." : "Cambio de precio rechazado." }); }
        catch (InvalidOperationException ex) { return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message }); }
    }

    [HttpPost("productos/{idProducto:int}/codigos-barras")]
    public async Task<IActionResult> GuardarCodigoBarras(int idProducto, [FromBody] GuardarProductoCodigoBarraDTO request)
    {
        var code = request.Codigo?.Trim() ?? string.Empty;
        if (!System.Text.RegularExpressions.Regex.IsMatch(code, "^[A-Za-z0-9._-]{4,100}$"))
            return BadRequest(new ApiResponse<object> { Success = false, Message = "El código debe contener entre 4 y 100 letras, números, puntos, guiones o guion bajo." });
        var type = request.Tipo?.Trim().ToUpperInvariant() ?? "CODE128";
        if (type is not ("CODE128" or "EAN13" or "EAN8" or "UPC" or "QR" or "INTERNO"))
            return BadRequest(new ApiResponse<object> { Success = false, Message = "El tipo de código seleccionado no es válido." });
        request.Tipo = type;
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
        try
        {
            var barcodeId = await inventarioProvider.GuardarCodigoProductoAsync(idProducto, request, userId);
            return Ok(new ApiResponse<object> { Success = true, Message = "Código asignado correctamente.", Data = new { IdCodigoBarra = barcodeId } });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("productos/{idProducto:int}/codigos-barras/{idCodigoBarra:int}")]
    public async Task<IActionResult> DesactivarCodigoBarras(int idProducto, int idCodigoBarra)
    {
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
        try
        {
            await inventarioProvider.DesactivarCodigoProductoAsync(idProducto, idCodigoBarra, userId);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("reporte/{format}")]
    public async Task<IActionResult> DescargarReporte(string format, [FromQuery] int? idSucursal, [FromQuery] string? query = null)
    {
        var branchId = ResolveBranch(idSucursal);
        if (!branchId.HasValue) return BranchRequired();
        if (format is not ("pdf" or "excel")) return BadRequest(new ApiResponse<object> { Success = false, Message = "Formato de reporte no válido." });

        try
        {
            var products = await inventarioProvider.ObtenerProductosAsync(branchId.Value, query ?? string.Empty);
            var generatedAt = DateTime.Now;
            var branch = products.FirstOrDefault()?.SucursalNombre ?? $"Sucursal {branchId.Value}";
            var stamp = generatedAt.ToString("yyyyMMdd_HHmmss");
            if (format == "pdf")
                return File(InventarioDocumentExportService.GeneratePdf(products, branch, generatedAt), "application/pdf", $"inventario_{stamp}.pdf");
            return File(InventarioDocumentExportService.GenerateXlsx(products, branch, generatedAt), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"inventario_{stamp}.xlsx");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "No fue posible generar el reporte de inventario.", Errors = ex.Message });
        }
    }

    [Authorize(Roles = "demo,Demo,superusuario,Superusuario,admin,Admin,Administrador")]
    [HttpPost("traslados")]
    public async Task<IActionResult> RegistrarTraslado([FromBody] RegistrarTrasladoDTO traslado)
    {
        if (traslado.IdSucursalOrigen <= 0 || traslado.IdSucursalDestino <= 0 || traslado.Detalles.Count == 0) return BadRequest(new ApiResponse<object> { Success=false, Message="Completa las sucursales y productos del traslado." });
        var idUsuario = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
        try { var result = await inventarioProvider.RegistrarTrasladoAsync(traslado,idUsuario); return Ok(new ApiResponse<TrasladoCreadoDTO> { Success=true,Message="Traslado registrado.",Data=result }); }
        catch(Exception ex) { return BadRequest(new ApiResponse<object> { Success=false,Message=ex.Message }); }
    }

    [Authorize(Roles = "demo,Demo,superusuario,Superusuario,admin,Admin,Administrador")]
    [HttpGet("traslados")]
    public async Task<IActionResult> Traslados([FromQuery]int? idSucursal=null,[FromQuery]string? query=null,[FromQuery]DateTime? fechaDesde=null,[FromQuery]DateTime? fechaHasta=null) => Ok(new ApiResponse<IEnumerable<TrasladoConsultaDTO>> { Success=true,Message="Traslados obtenidos.",Data=await inventarioProvider.BuscarTrasladosAsync(idSucursal,query??"",fechaDesde,fechaHasta) });

    [Authorize(Roles = "demo,Demo,superusuario,Superusuario,admin,Admin,Administrador")]
    [HttpGet("traslados/{id:int}/pdf")]
    public async Task<IActionResult> NotaTraslado(int id)
    {
        var rows=await inventarioProvider.BuscarTrasladosAsync(null,"",null,null,id);
        if(rows.Count==0)return NotFound();
        return File(TrasladoDocumentService.GeneratePdf(rows),"application/pdf",$"{rows[0].NumeroTraslado}.pdf");
    }

    [HttpPost("salidas")]
    public async Task<IActionResult> RegistrarSalida([FromBody]SalidaInventarioRequestDTO salida){var branch=ResolveBranch(salida.IdSucursal);if(!branch.HasValue)return BranchRequired();salida.IdSucursal=branch.Value;if(salida.Detalles.Count==0)return BadRequest(new ApiResponse<object>{Success=false,Message="Agrega al menos un producto."});var user=int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var id)?id:0;try{var result=await inventarioProvider.RegistrarSalidaAsync(salida,user);return Ok(new ApiResponse<object>{Success=true,Message="Salida registrada e inventario actualizado.",Data=new{IdSalida=result}});}catch(Exception ex){return BadRequest(new ApiResponse<object>{Success=false,Message=ex.Message});}}

    [HttpGet("salidas")]
    public async Task<IActionResult> Salidas([FromQuery]int? idSucursal,[FromQuery]string? query=null){var branch=ResolveBranch(idSucursal);if(!branch.HasValue)return BranchRequired();return Ok(new ApiResponse<object>{Success=true,Message="Salidas obtenidas.",Data=await inventarioProvider.BuscarSalidasAsync(branch.Value,query??"")});}

    [HttpGet("movimientos")]
    public async Task<IActionResult> Movimientos([FromQuery]int? idSucursal=null,[FromQuery]int? idProducto=null,[FromQuery]string? query=null,[FromQuery]string? tipo=null,[FromQuery]DateTime? fechaDesde=null,[FromQuery]DateTime? fechaHasta=null,[FromQuery]int pagina=1,[FromQuery]int tamanoPagina=25)
    {
        var assignedBranch = ResolveBranch(idSucursal);
        var isAdmin = User.IsInRole("Administrador") || User.IsInRole("administrador") || User.IsInRole("Admin") || User.IsInRole("admin") || User.IsInRole("Demo") || User.IsInRole("demo") || User.IsInRole("Superusuario") || User.IsInRole("superusuario");
        if (!isAdmin && !assignedBranch.HasValue) return BranchRequired();
        var rows = await inventarioProvider.BuscarMovimientosAsync(assignedBranch,idProducto,query??"",tipo??"",fechaDesde,fechaHasta,Math.Max(1,pagina),Math.Clamp(tamanoPagina,1,100));
        return Ok(new ApiResponse<object>{Success=true,Message="Movimientos de inventario obtenidos.",Data=new{Registros=rows,Total=rows.FirstOrDefault()?.TotalRegistros??0,Pagina=Math.Max(1,pagina),TamanoPagina=Math.Clamp(tamanoPagina,1,100)}});
    }

    private int? ResolveBranch(int? requestedBranch)
    {
        var claim = User.FindFirst("id_sucursal")?.Value ?? User.FindFirstValue("IdSucursal");
        if (int.TryParse(claim, out var assignedBranch) && assignedBranch > 0) return assignedBranch;
        return requestedBranch is > 0 ? requestedBranch : null;
    }

    private BadRequestObjectResult BranchRequired() => BadRequest(new ApiResponse<object> { Success = false, Message = "Debes seleccionar una sucursal." });
    private bool IsAdministrator() => User.IsInRole("Administrador") || User.IsInRole("administrador") || User.IsInRole("Admin") || User.IsInRole("admin") || User.IsInRole("Demo") || User.IsInRole("demo") || User.IsInRole("Superusuario") || User.IsInRole("superusuario");
}
