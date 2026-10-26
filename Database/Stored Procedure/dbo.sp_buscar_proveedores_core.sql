CREATE OR ALTER PROCEDURE dbo.sp_buscar_proveedores_core @Query VARCHAR(100)='' AS BEGIN SET NOCOUNT ON; SELECT id_proveedor IdProveedor,nombre Nombre,telefono Telefono,direccion Direccion FROM dbo.proveedor WHERE activo=1 AND (ISNULL(@Query,'')='' OR nombre LIKE '%'+@Query+'%' OR ISNULL(telefono,'') LIKE '%'+@Query+'%') ORDER BY nombre; END
GO
IF OBJECT_ID('dbo.sp_buscar_proveedores','SN') IS NOT NULL DROP SYNONYM dbo.sp_buscar_proveedores;
GO
CREATE SYNONYM dbo.sp_buscar_proveedores FOR dbo.sp_buscar_proveedores_core;
GO
