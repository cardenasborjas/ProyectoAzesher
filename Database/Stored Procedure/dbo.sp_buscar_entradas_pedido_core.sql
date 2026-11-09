CREATE OR ALTER PROCEDURE dbo.sp_buscar_entradas_pedido_core @IdSucursal INT,@Query VARCHAR(100)='' AS
BEGIN
 SET NOCOUNT ON;
 SELECT TOP(100) c.id_compra IdCompra,c.numero_pedido NumeroPedido,c.fecha Fecha,c.total Total,c.metodo_pago MetodoPago,c.observaciones Observaciones,p.nombre ProveedorNombre,COUNT(dc.id_detalle_compra) Productos,SUM(dc.cantidad) Unidades,
   CASE WHEN LOWER(c.metodo_pago)<>'credito' THEN c.total ELSE ISNULL(MAX(pay.TotalPagado),0) END TotalPagado,
   CASE WHEN LOWER(c.metodo_pago)<>'credito' THEN 0 ELSE c.total-ISNULL(MAX(pay.TotalPagado),0) END SaldoPendiente,
   CASE WHEN LOWER(c.metodo_pago)<>'credito' OR ISNULL(MAX(pay.TotalPagado),0)>=c.total THEN 'Pagado' WHEN ISNULL(MAX(pay.TotalPagado),0)>0 THEN 'Pago parcial' ELSE 'Pendiente' END EstadoPago
 FROM dbo.compra c JOIN dbo.proveedor p ON p.id_proveedor=c.id_proveedor JOIN dbo.detalle_compra dc ON dc.id_compra=c.id_compra
 OUTER APPLY(SELECT SUM(cp.monto) TotalPagado FROM dbo.compra_pago cp WHERE cp.id_compra=c.id_compra) pay
 WHERE c.id_sucursal=@IdSucursal AND (ISNULL(@Query,'')='' OR ISNULL(c.numero_pedido,'') LIKE '%'+@Query+'%' OR p.nombre LIKE '%'+@Query+'%' OR CONVERT(VARCHAR(20),c.id_compra)=@Query)
 GROUP BY c.id_compra,c.numero_pedido,c.fecha,c.total,c.metodo_pago,c.observaciones,p.nombre ORDER BY c.fecha DESC;
END
GO
IF OBJECT_ID('dbo.sp_buscar_entradas_pedido','SN') IS NOT NULL DROP SYNONYM dbo.sp_buscar_entradas_pedido;
GO
CREATE SYNONYM dbo.sp_buscar_entradas_pedido FOR dbo.sp_buscar_entradas_pedido_core;
GO
