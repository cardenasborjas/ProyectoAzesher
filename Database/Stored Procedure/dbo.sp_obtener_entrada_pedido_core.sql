CREATE OR ALTER PROCEDURE dbo.sp_obtener_entrada_pedido_core
    @IdCompra INT,
    @IdSucursal INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.id_compra IdCompra,c.numero_pedido NumeroPedido,c.fecha Fecha,c.total Total,
           c.metodo_pago MetodoPago,c.observaciones Observaciones,pr.nombre ProveedorNombre,
           s.nombre SucursalNombre,p.id_producto IdProducto,p.cod_producto Codigo,p.nombre ProductoNombre,
           dc.cantidad Cantidad,dc.costo_unitario CostoUnitario,p.precio PrecioVenta,dc.subtotal Subtotal
    FROM dbo.compra c
    INNER JOIN dbo.proveedor pr ON pr.id_proveedor=c.id_proveedor
    INNER JOIN dbo.sucursal s ON s.id_sucursal=c.id_sucursal
    INNER JOIN dbo.detalle_compra dc ON dc.id_compra=c.id_compra
    INNER JOIN dbo.producto p ON p.id_producto=dc.id_producto
    WHERE c.id_compra=@IdCompra AND c.id_sucursal=@IdSucursal
    ORDER BY p.nombre;
END
GO
IF OBJECT_ID('dbo.sp_obtener_entrada_pedido','SN') IS NOT NULL DROP SYNONYM dbo.sp_obtener_entrada_pedido;
GO
CREATE SYNONYM dbo.sp_obtener_entrada_pedido FOR dbo.sp_obtener_entrada_pedido_core;
GO
