using System.Data; using Core.DTOs; using Core.DTOs.Interfaces; using Dapper; using Microsoft.Data.SqlClient;
namespace Core.Provider;
public class OperacionProvider(IConfiguration cfg):IOperacionProviderDTO {
 private readonly string cs=cfg.GetConnectionString("DefaultConnection")??throw new ArgumentNullException(nameof(cfg));
 private async Task<List<T>> List<T>(string sp,object? parameters){await using var connection=new SqlConnection(cs);return(await connection.QueryAsync<T>(sp,parameters,commandType:CommandType.StoredProcedure)).ToList();}
 private async Task Exec(string sp,object parameters){await using var connection=new SqlConnection(cs);await connection.ExecuteAsync(sp,parameters,commandType:CommandType.StoredProcedure);}
 public async Task<CajaEstadoDTO?> EstadoCaja(int user,int branch)=>(await List<CajaEstadoDTO>("dbo.sp_estado_caja",new{IdUsuario=user,IdSucursal=branch})).FirstOrDefault();
 public Task AbrirCaja(int user,int branch,decimal amount)=>Exec("dbo.sp_abrir_caja",new{IdUsuario=user,IdSucursal=branch,MontoApertura=amount});
 public Task RegistrarSalidaCaja(int user,int branch,decimal amount,string concept,string? notes)=>Exec("dbo.sp_registrar_salida_caja",new{IdUsuario=user,IdSucursal=branch,Monto=amount,Concepto=concept,Observaciones=notes});
 public async Task<CierreCajaDTO> CerrarCaja(int user,int branch,decimal amount,string? notes){await using var connection=new SqlConnection(cs);return await connection.QuerySingleAsync<CierreCajaDTO>("dbo.sp_cerrar_caja",new{IdUsuario=user,IdSucursal=branch,MontoCierre=amount,Observaciones=notes},commandType:CommandType.StoredProcedure);}
 public Task<List<MovimientoCajaDTO>> MovimientosCaja(int user,int branch,int? session=null)=>List<MovimientoCajaDTO>("dbo.sp_movimientos_caja",new{IdUsuario=user,IdSucursal=branch,IdSesion=session});
 public Task<List<CierreCajaDTO>> CierresCaja(int branch,DateTime? from,DateTime? to)=>List<CierreCajaDTO>("dbo.sp_listar_cierres_caja",new{IdSucursal=branch,FechaDesde=from,FechaHasta=to});
 public Task<List<ClienteGestionDTO>> Clientes(string query,int branch)=>List<ClienteGestionDTO>("dbo.sp_listar_clientes",new{Query=query,IdSucursal=branch});
 public async Task<int> CrearCliente(ClienteGestionDTO client){await using var connection=new SqlConnection(cs);return await connection.QuerySingleAsync<int>("dbo.sp_crear_cliente",new{client.Nombre,client.Nit,client.Telefono,client.Correo,client.Direccion,client.FechaNacimiento},commandType:CommandType.StoredProcedure);}
 public Task ActualizarCliente(ClienteGestionDTO client)=>Exec("dbo.sp_actualizar_cliente",new{client.IdCliente,client.Nombre,client.Nit,client.Telefono,client.Correo,client.Direccion,client.FechaNacimiento});
 public Task<List<HistorialClienteDTO>> Historial(int client,int branch,DateTime? from,DateTime? to)=>List<HistorialClienteDTO>("dbo.sp_historial_cliente",new{IdCliente=client,IdSucursal=branch,FechaDesde=from,FechaHasta=to});
 public Task<List<ReporteFilaDTO>> Reporte(string type,int branch,DateTime from,DateTime to)=>List<ReporteFilaDTO>($"dbo.sp_reporte_{type}",type=="inventario"?new{IdSucursal=branch}:(object)new{IdSucursal=branch,FechaDesde=from,FechaHasta=to});
 public async Task<ReporteUtilidadDTO> ReporteUtilidad(int branch,DateTime from,DateTime to){await using var connection=new SqlConnection(cs);return await connection.QuerySingleAsync<ReporteUtilidadDTO>("""
 DECLARE @Ventas DECIMAL(18,2)=(SELECT ISNULL(SUM(v.total),0) FROM dbo.venta v JOIN dbo.sesion_caja s ON s.id_sesion=v.id_sesion WHERE s.id_sucursal=@Branch AND CAST(v.fecha AS DATE) BETWEEN @From AND @To);
 DECLARE @Costo DECIMAL(18,2)=(SELECT ISNULL(SUM(dv.cantidad*dv.costo_unitario),0) FROM dbo.detalle_venta dv JOIN dbo.venta v ON v.id_venta=dv.id_venta JOIN dbo.sesion_caja s ON s.id_sesion=v.id_sesion WHERE s.id_sucursal=@Branch AND CAST(v.fecha AS DATE) BETWEEN @From AND @To);
 DECLARE @Gastos DECIMAL(18,2)=(SELECT ISNULL(SUM(m.monto),0) FROM dbo.movimiento_caja_manual m JOIN dbo.sesion_caja s ON s.id_sesion=m.id_sesion WHERE s.id_sucursal=@Branch AND CAST(m.fecha AS DATE) BETWEEN @From AND @To);
 SELECT @Ventas Ventas,@Costo CostoVentas,@Ventas-@Costo UtilidadBruta,@Gastos GastosOperativos,@Ventas-@Costo-@Gastos UtilidadNeta,CASE WHEN @Ventas=0 THEN 0 ELSE ((@Ventas-@Costo)/@Ventas)*100 END MargenBrutoPorcentaje,
 (SELECT ISNULL(SUM(cx.saldo_pendiente),0) FROM dbo.cuenta_cobrar cx JOIN dbo.venta v ON v.id_venta=cx.id_venta JOIN dbo.sesion_caja s ON s.id_sesion=v.id_sesion WHERE s.id_sucursal=@Branch AND cx.estado='Pendiente') CuentasPorCobrar,
 (SELECT ISNULL(SUM(c.total),0) FROM dbo.compra c WHERE c.id_sucursal=@Branch AND CAST(c.fecha AS DATE) BETWEEN @From AND @To) Compras,
 (SELECT ISNULL(SUM(cp.monto),0) FROM dbo.compra_pago cp JOIN dbo.compra c ON c.id_compra=cp.id_compra WHERE c.id_sucursal=@Branch AND CAST(cp.fecha AS DATE) BETWEEN @From AND @To) PagosProveedores;
 """,new{Branch=branch,From=from.Date,To=to.Date});}
}
