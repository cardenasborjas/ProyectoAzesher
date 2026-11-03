
IF OBJECT_ID('dbo.sp_obtener_sucursales_core', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sp_obtener_sucursales_core;
END
GO

CREATE PROCEDURE dbo.sp_obtener_sucursales_core
    @IdSucursalUsuario INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        id_sucursal AS IdSucursal,
        nombre,
        direccion,
        telefono,
        color_identificacion AS ColorIdentificacion
    FROM 
        dbo.sucursal
    WHERE 
        activo=1 AND (@IdSucursalUsuario IS NULL OR id_sucursal = @IdSucursalUsuario)
    ORDER BY 
        nombre ASC;
END
GO


IF OBJECT_ID('dbo.sp_obtener_sucursales', 'SN') IS NOT NULL
BEGIN
    DROP SYNONYM dbo.sp_obtener_sucursales;
END
GO

CREATE SYNONYM dbo.sp_obtener_sucursales FOR dbo.sp_obtener_sucursales_core;
GO
