CREATE OR ALTER PROCEDURE dbo.sp_registrar_entrada_pedido_core @IdSucursal INT,@IdProveedor INT,@IdUsuario INT,@Fecha DATETIME=NULL,@MetodoPago VARCHAR(30),@Observaciones VARCHAR(500)=NULL,@Detalles NVARCHAR(MAX) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.proveedor WHERE id_proveedor=@IdProveedor AND activo=1) THROW 50008,'El proveedor está desactivado y no puede recibir nuevas entradas.',1;
 IF NOT EXISTS(SELECT 1 FROM OPENJSON(@Detalles)) THROW 50002,'El pedido debe incluir al menos un producto.',1;
 BEGIN TRANSACTION;
 DECLARE @Detalle TABLE(IdProducto INT,Cantidad INT,CostoUnitario DECIMAL(12,2));
 INSERT @Detalle SELECT IdProducto,Cantidad,CostoUnitario FROM OPENJSON(@Detalles) WITH(IdProducto INT '$.IdProducto',Cantidad INT '$.Cantidad',CostoUnitario DECIMAL(12,2) '$.CostoUnitario');
 IF EXISTS(SELECT 1 FROM @Detalle WHERE IdProducto IS NULL OR Cantidad<=0 OR CostoUnitario<0) THROW 50003,'Las cantidades, productos y costos no son válidos.',1;
 IF EXISTS(SELECT 1 FROM @Detalle d WHERE NOT EXISTS(SELECT 1 FROM dbo.proveedor_producto pp WHERE pp.id_proveedor=@IdProveedor AND pp.id_producto=d.IdProducto AND pp.activo=1)) THROW 50004,'Uno de los productos no pertenece al proveedor seleccionado.',1;
 IF @MetodoPago NOT IN('efectivo','tarjeta','transferencia','credito') THROW 50005,'El método de pago no es válido.',1;
 DECLARE @IdSesion INT=NULL;
 IF @MetodoPago='efectivo'
 BEGIN
  SELECT TOP(1) @IdSesion=id_sesion FROM dbo.sesion_caja WHERE id_sucursal=@IdSucursal AND fecha_cierre IS NULL ORDER BY fecha_apertura DESC;
  IF @IdSesion IS NULL THROW 50007,'No hay una caja abierta en esta sucursal. Abre la caja antes de registrar una entrada en efectivo.',1;
 END;
 DECLARE @Total DECIMAL(12,2)=(SELECT SUM(Cantidad*CostoUnitario) FROM @Detalle); IF @Total IS NULL THROW 50006,'No fue posible calcular el total del pedido.',1;
 INSERT dbo.compra(fecha,total,id_proveedor,id_sucursal,numero_pedido,metodo_pago,observaciones,id_sesion,id_usuario) VALUES(ISNULL(@Fecha,GETDATE()),@Total,@IdProveedor,@IdSucursal,'PENDIENTE',@MetodoPago,NULLIF(LTRIM(RTRIM(@Observaciones)),''),@IdSesion,@IdUsuario);
 DECLARE @IdCompra INT=CAST(SCOPE_IDENTITY() AS INT);
 UPDATE dbo.compra SET numero_pedido=CONCAT('PED-',RIGHT('00000000'+CAST(@IdCompra AS VARCHAR(10)),8)) WHERE id_compra=@IdCompra;
 INSERT dbo.detalle_compra(id_compra,id_producto,cantidad,costo_unitario,subtotal) SELECT @IdCompra,IdProducto,Cantidad,CostoUnitario,Cantidad*CostoUnitario FROM @Detalle;
 MERGE dbo.inventario AS t USING(SELECT IdProducto,SUM(Cantidad) Cantidad FROM @Detalle GROUP BY IdProducto) s ON t.id_sucursal=@IdSucursal AND t.id_producto=s.IdProducto
 WHEN MATCHED THEN UPDATE SET stock=t.stock+s.Cantidad WHEN NOT MATCHED THEN INSERT(id_sucursal,id_producto,stock) VALUES(@IdSucursal,s.IdProducto,s.Cantidad);
 COMMIT; SELECT @IdCompra IdCompra,@Total Total;
END
GO
IF OBJECT_ID('dbo.sp_registrar_entrada_pedido','SN') IS NOT NULL DROP SYNONYM dbo.sp_registrar_entrada_pedido;
GO
CREATE SYNONYM dbo.sp_registrar_entrada_pedido FOR dbo.sp_registrar_entrada_pedido_core;
GO
