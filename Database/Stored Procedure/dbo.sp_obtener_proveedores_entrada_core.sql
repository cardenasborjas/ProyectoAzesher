CREATE OR ALTER PROCEDURE dbo.sp_obtener_proveedores_entrada_core AS
BEGIN SET NOCOUNT ON; SELECT id_proveedor IdProveedor, nombre Nombre FROM dbo.proveedor WHERE activo=1 ORDER BY nombre; END
GO
IF OBJECT_ID('dbo.sp_obtener_proveedores_entrada','SN') IS NOT NULL DROP SYNONYM dbo.sp_obtener_proveedores_entrada;
GO
CREATE SYNONYM dbo.sp_obtener_proveedores_entrada FOR dbo.sp_obtener_proveedores_entrada_core;
GO
