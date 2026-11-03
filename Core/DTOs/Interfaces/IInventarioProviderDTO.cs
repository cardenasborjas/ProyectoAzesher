namespace Core.DTOs.Interfaces;

public interface IInventarioProviderDTO
{
    Task<List<InventarioProductoDTO>> ObtenerProductosAsync(int idSucursal, string query);
    Task<List<ProductoCodigoBarraDTO>> ObtenerCodigosProductoAsync(int idProducto);
    Task<int> GuardarCodigoProductoAsync(int idProducto, GuardarProductoCodigoBarraDTO codigo, int idUsuario);
    Task DesactivarCodigoProductoAsync(int idProducto, int idCodigoBarra, int idUsuario);
    Task<List<ProductoEntradaDTO>> BuscarProductosEntradaAsync(int idProveedor, string query);
    Task<List<ProveedorEntradaDTO>> ObtenerProveedoresAsync();
    Task<int> CrearProductoAsync(CrearProductoEntradaDTO product);
    Task<int> RegistrarEntradaAsync(RegistrarEntradaPedidoDTO order, int idUsuario);
    Task<List<EntradaPedidoConsultaDTO>> BuscarEntradasAsync(int idSucursal, string query);
    Task<List<EntradaPedidoProductoDTO>> ObtenerEntradaAsync(int idCompra, int idSucursal);
    Task<List<ProveedorDTO>> BuscarProveedoresAsync(string query);
    Task<int> CrearProveedorAsync(ProveedorDTO supplier);
    Task<List<ProductoEntradaDTO>> ObtenerProductosProveedorAsync(int idProveedor);
    Task<TrasladoCreadoDTO> RegistrarTrasladoAsync(RegistrarTrasladoDTO traslado, int idUsuario);
    Task<List<TrasladoConsultaDTO>> BuscarTrasladosAsync(int? idSucursal, string query, DateTime? fechaDesde, DateTime? fechaHasta, int? idTraslado = null);
    Task<int> RegistrarSalidaAsync(SalidaInventarioRequestDTO salida,int idUsuario);
    Task<List<SalidaInventarioConsultaDTO>> BuscarSalidasAsync(int idSucursal,string query);
    Task<List<MovimientoInventarioDTO>> BuscarMovimientosAsync(int? idSucursal,int? idProducto,string query,string tipo,DateTime? fechaDesde,DateTime? fechaHasta,int pagina,int tamanoPagina);
    Task ActualizarPrecioProductoAsync(int idProducto, decimal precio, int idUsuario);
}
