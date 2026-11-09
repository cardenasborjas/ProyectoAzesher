namespace Core.DTOs;

public class ProductoEntradaDTO { public int IdProducto { get; set; } public string? Codigo { get; set; } public string Nombre { get; set; } = string.Empty; public string? Descripcion { get; set; } public decimal Precio { get; set; } }
public class ProveedorEntradaDTO { public int IdProveedor { get; set; } public string Nombre { get; set; } = string.Empty; }
public class ProveedorDTO { public int IdProveedor {get;set;} public string Nombre {get;set;}=""; public string? Telefono {get;set;} public string? Direccion {get;set;} }
public class CrearProductoEntradaDTO { public int IdProveedor { get; set; } public string? Codigo { get; set; } public string Nombre { get; set; } = string.Empty; public string? Descripcion { get; set; } public decimal Precio { get; set; } }
public class DetalleEntradaPedidoDTO { public int IdProducto { get; set; } public int Cantidad { get; set; } public decimal CostoUnitario { get; set; } public decimal PrecioVenta { get; set; } }
public class RegistrarEntradaPedidoDTO { public int IdSucursal { get; set; } public int IdProveedor { get; set; } public DateTime? Fecha { get; set; } public string MetodoPago { get; set; } = string.Empty; public string? Observaciones { get; set; } public List<DetalleEntradaPedidoDTO> Detalles { get; set; } = []; }
public class EntradaPedidoConsultaDTO { public int IdCompra { get; set; } public string? NumeroPedido { get; set; } public DateTime Fecha { get; set; } public decimal Total { get; set; } public string MetodoPago { get; set; } = string.Empty; public string? Observaciones { get; set; } public string ProveedorNombre { get; set; } = string.Empty; public int Productos { get; set; } public int Unidades { get; set; } public decimal TotalPagado { get; set; } public decimal SaldoPendiente { get; set; } public string EstadoPago { get; set; } = string.Empty; }
public class RegistrarPagoCompraDTO { public int IdSucursal { get; set; } public decimal Monto { get; set; } public string MetodoPago { get; set; } = "efectivo"; public DateTime? Fecha { get; set; } public string? Referencia { get; set; } public string? Observaciones { get; set; } }
public class EntradaPedidoProductoDTO
{
    public int IdCompra { get; set; }
    public string NumeroPedido { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public decimal Total { get; set; }
    public string MetodoPago { get; set; } = string.Empty;
    public string? Observaciones { get; set; }
    public string ProveedorNombre { get; set; } = string.Empty;
    public string SucursalNombre { get; set; } = string.Empty;
    public int IdProducto { get; set; }
    public string? Codigo { get; set; }
    public string ProductoNombre { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public decimal CostoUnitario { get; set; }
    public decimal PrecioVenta { get; set; }
    public decimal Subtotal { get; set; }
}

public class CambiarPrecioProductoDTO { public decimal Precio { get; set; } }
public class ResolverCambioPrecioDTO { public bool Aprobar { get; set; } }
