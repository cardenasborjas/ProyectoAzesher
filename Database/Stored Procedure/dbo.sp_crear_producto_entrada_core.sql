CREATE OR ALTER PROCEDURE dbo.sp_crear_producto_entrada_core @IdProveedor INT,@Codigo VARCHAR(20)=NULL,@Nombre VARCHAR(150),@Descripcion VARCHAR(MAX)=NULL,@Precio DECIMAL(12,2) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON; SET @Codigo=NULLIF(LTRIM(RTRIM(@Codigo)),'');
 IF NOT EXISTS(SELECT 1 FROM dbo.proveedor WHERE id_proveedor=@IdProveedor AND activo=1) THROW 50000,'El proveedor no existe o está desactivado.',1;
 IF @Codigo IS NOT NULL AND EXISTS(SELECT 1 FROM dbo.producto WHERE cod_producto=@Codigo) THROW 50001,'Ya existe un producto con ese código.',1;
 BEGIN TRANSACTION;
 INSERT dbo.producto(cod_producto,nombre,descripcion,precio) VALUES(@Codigo,LTRIM(RTRIM(@Nombre)),NULLIF(LTRIM(RTRIM(@Descripcion)),''),@Precio);
 DECLARE @IdProducto INT=CAST(SCOPE_IDENTITY() AS INT); INSERT dbo.proveedor_producto(id_proveedor,id_producto)VALUES(@IdProveedor,@IdProducto); COMMIT;
 SELECT @IdProducto IdProducto;
END
GO
IF OBJECT_ID('dbo.sp_crear_producto_entrada','SN') IS NOT NULL DROP SYNONYM dbo.sp_crear_producto_entrada;
GO
CREATE SYNONYM dbo.sp_crear_producto_entrada FOR dbo.sp_crear_producto_entrada_core;
GO
