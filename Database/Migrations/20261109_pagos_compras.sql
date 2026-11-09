IF OBJECT_ID('dbo.compra_pago','U') IS NULL
BEGIN
    CREATE TABLE dbo.compra_pago(
        id_pago INT IDENTITY(1,1) PRIMARY KEY,
        id_compra INT NOT NULL,
        fecha DATETIME2 NOT NULL CONSTRAINT df_compra_pago_fecha DEFAULT GETDATE(),
        monto DECIMAL(12,2) NOT NULL,
        metodo_pago VARCHAR(30) NOT NULL,
        referencia VARCHAR(100) NULL,
        observaciones VARCHAR(500) NULL,
        id_usuario INT NOT NULL,
        id_sesion INT NULL,
        CONSTRAINT fk_compra_pago_compra FOREIGN KEY(id_compra) REFERENCES dbo.compra(id_compra),
        CONSTRAINT fk_compra_pago_usuario FOREIGN KEY(id_usuario) REFERENCES dbo.usuario(id_usuario),
        CONSTRAINT fk_compra_pago_sesion FOREIGN KEY(id_sesion) REFERENCES dbo.sesion_caja(id_sesion),
        CONSTRAINT ck_compra_pago_monto CHECK(monto>0)
    );
    CREATE INDEX idx_compra_pago_compra ON dbo.compra_pago(id_compra,fecha DESC);
    CREATE INDEX idx_compra_pago_sesion ON dbo.compra_pago(id_sesion);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_registrar_pago_compra_core
 @IdCompra INT,@IdSucursal INT,@IdUsuario INT,@Monto DECIMAL(12,2),@MetodoPago VARCHAR(30),
 @Fecha DATETIME2=NULL,@Referencia VARCHAR(100)=NULL,@Observaciones VARCHAR(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @Monto<=0 THROW 50701,'El monto debe ser mayor que cero.',1;
 IF LOWER(@MetodoPago) NOT IN('efectivo','tarjeta','transferencia') THROW 50702,'Selecciona una forma de pago válida.',1;
 BEGIN TRANSACTION;
 DECLARE @Total DECIMAL(12,2),@MetodoOriginal VARCHAR(30),@Pagado DECIMAL(12,2),@IdSesion INT=NULL;
 SELECT @Total=total,@MetodoOriginal=metodo_pago FROM dbo.compra WITH(UPDLOCK,HOLDLOCK) WHERE id_compra=@IdCompra AND id_sucursal=@IdSucursal;
 IF @Total IS NULL THROW 50703,'La entrada no existe en esta sucursal.',1;
 IF LOWER(@MetodoOriginal)<>'credito' THROW 50704,'Esta entrada ya fue registrada como pagada.',1;
 SELECT @Pagado=ISNULL(SUM(monto),0) FROM dbo.compra_pago WHERE id_compra=@IdCompra;
 IF @Monto>@Total-@Pagado THROW 50705,'El monto supera el saldo pendiente del pedido.',1;
 IF LOWER(@MetodoPago)='efectivo'
 BEGIN
   SELECT TOP(1) @IdSesion=id_sesion FROM dbo.sesion_caja WHERE id_sucursal=@IdSucursal AND fecha_cierre IS NULL ORDER BY fecha_apertura DESC;
   IF @IdSesion IS NULL THROW 50706,'Debes abrir la caja de la sucursal antes de registrar un pago en efectivo.',1;
 END
 INSERT dbo.compra_pago(id_compra,fecha,monto,metodo_pago,referencia,observaciones,id_usuario,id_sesion)
 VALUES(@IdCompra,COALESCE(@Fecha,GETDATE()),@Monto,LOWER(@MetodoPago),NULLIF(LTRIM(RTRIM(@Referencia)),''),NULLIF(LTRIM(RTRIM(@Observaciones)),''),@IdUsuario,@IdSesion);
 COMMIT;
 SELECT CONVERT(INT,SCOPE_IDENTITY()) IdPago;
END
GO

IF OBJECT_ID('dbo.sp_registrar_pago_compra','SN') IS NOT NULL DROP SYNONYM dbo.sp_registrar_pago_compra;
GO
CREATE SYNONYM dbo.sp_registrar_pago_compra FOR dbo.sp_registrar_pago_compra_core;
GO
