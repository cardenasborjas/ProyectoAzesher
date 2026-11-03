namespace Core.DTOs;

public class InventarioProductoDTO
{
    public int IdInventario { get; set; }
    public int IdProducto { get; set; }
    public string? Codigo { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public decimal Precio { get; set; }
    public decimal? CostoUltimaCompra { get; set; }
    public int? IdSolicitudPrecio { get; set; }
    public decimal? PrecioSolicitado { get; set; }
    public string? SolicitantePrecio { get; set; }
    public int Stock { get; set; }
    public int IdSucursal { get; set; }
    public string SucursalNombre { get; set; } = string.Empty;
    public string EstadoStock { get; set; } = string.Empty;
}

public class MovimientoInventarioDTO
{
    public string IdMovimiento { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public int IdProducto { get; set; }
    public string? Codigo { get; set; }
    public string Producto { get; set; } = string.Empty;
    public int IdSucursal { get; set; }
    public string Sucursal { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string Direccion { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public string? Documento { get; set; }
    public string? Detalle { get; set; }
    public string Usuario { get; set; } = "Sistema";
    public int TotalRegistros { get; set; }
}
