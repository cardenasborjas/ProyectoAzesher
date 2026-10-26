CREATE OR ALTER PROCEDURE dbo.sp_buscar_productos_entrada_core @IdProveedor INT,@Query VARCHAR(200) = '' AS
BEGIN
 SET NOCOUNT ON; DECLARE @Busqueda VARCHAR(200)=LTRIM(RTRIM(ISNULL(@Query,'')));
 IF NOT EXISTS(SELECT 1 FROM dbo.proveedor WHERE id_proveedor=@IdProveedor AND activo=1) RETURN;
 SELECT TOP (30) p.id_producto IdProducto, p.cod_producto Codigo, p.nombre Nombre, p.descripcion Descripcion, p.precio Precio
 FROM dbo.producto p INNER JOIN dbo.proveedor_producto pp ON pp.id_producto=p.id_producto AND pp.id_proveedor=@IdProveedor AND pp.activo=1
 WHERE @Busqueda='' OR p.nombre LIKE '%'+@Busqueda+'%' OR ISNULL(p.cod_producto,'') LIKE '%'+@Busqueda+'%' OR CONVERT(VARCHAR(20),p.id_producto)=@Busqueda ORDER BY p.nombre;
END
GO
IF OBJECT_ID('dbo.sp_buscar_productos_entrada','SN') IS NOT NULL DROP SYNONYM dbo.sp_buscar_productos_entrada;
GO
CREATE SYNONYM dbo.sp_buscar_productos_entrada FOR dbo.sp_buscar_productos_entrada_core;
GO
