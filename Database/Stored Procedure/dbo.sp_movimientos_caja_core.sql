CREATE OR ALTER PROCEDURE dbo.sp_movimientos_caja_core
    @IdUsuario INT,@IdSucursal INT,@IdSesion INT=NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Id INT=@IdSesion;
    IF @Id IS NULL SELECT TOP(1)@Id=id_sesion FROM dbo.sesion_caja WHERE id_sucursal=@IdSucursal AND fecha_cierre IS NULL ORDER BY fecha_apertura DESC;
    IF NOT EXISTS(SELECT 1 FROM dbo.sesion_caja WHERE id_sesion=@Id AND id_sucursal=@IdSucursal) THROW 50401,'El cierre no pertenece a la sucursal seleccionada.',1;
    SELECT Tipo,Numero,Fecha,MetodoPago,Monto,Estado FROM(
        SELECT CASE WHEN r.metodo_pago='credito' THEN 'Venta a crédito' ELSE 'Recibo' END Tipo,r.numero_recibo Numero,r.fecha_pago Fecha,r.metodo_pago MetodoPago,r.monto Monto,r.estado Estado
        FROM dbo.venta v JOIN dbo.factura f ON f.id_venta=v.id_venta JOIN dbo.recibo r ON r.id_factura=f.id_factura WHERE v.id_sesion=@Id
        UNION ALL
        SELECT 'Entrada de pedido',c.numero_pedido,c.fecha,c.metodo_pago,-c.total,'Registrada' FROM dbo.compra c WHERE c.id_sesion=@Id
        UNION ALL SELECT 'Pago a proveedor',c.numero_pedido,cp.fecha,cp.metodo_pago,-cp.monto,'Registrado' FROM dbo.compra_pago cp JOIN dbo.compra c ON c.id_compra=cp.id_compra WHERE cp.id_sesion=@Id
        UNION ALL
        SELECT 'Abono',a.numero_abono,a.fecha,a.metodo_pago,a.monto,'Registrado' FROM dbo.abono a WHERE a.id_sesion=@Id
        UNION ALL
        SELECT 'Salida de caja',CONCAT('SAL-',RIGHT('00000000'+CAST(m.id_movimiento AS VARCHAR),8)),m.fecha,'efectivo',-m.monto,m.concepto
        FROM dbo.movimiento_caja_manual m WHERE m.id_sesion=@Id
    )mov ORDER BY Fecha DESC;
END
GO
IF OBJECT_ID('dbo.sp_movimientos_caja','SN') IS NOT NULL DROP SYNONYM dbo.sp_movimientos_caja;
GO
CREATE SYNONYM dbo.sp_movimientos_caja FOR dbo.sp_movimientos_caja_core;
GO
