CREATE OR ALTER PROCEDURE dbo.sp_obtener_inventario_productos_core
    @IdSucursal INT,
    @Query VARCHAR(200) = ''
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Busqueda VARCHAR(200) = LTRIM(RTRIM(ISNULL(@Query, '')));

    SELECT
        i.id_inventario AS IdInventario,
        p.id_producto AS IdProducto,
        COALESCE(cb.codigo, p.cod_producto) AS Codigo,
        p.nombre AS Nombre,
        p.descripcion AS Descripcion,
        p.precio AS Precio,
        lastCost.CostoUltimaCompra,
        pending.id_solicitud AS IdSolicitudPrecio,
        pending.precio_solicitado AS PrecioSolicitado,
        pending.Solicitante AS SolicitantePrecio,
        i.stock AS Stock,
        s.id_sucursal AS IdSucursal,
        s.nombre AS SucursalNombre,
        CASE
            WHEN i.stock <= 0 THEN 'Sin existencias'
            WHEN i.stock <= 5 THEN 'Existencia baja'
            ELSE 'Disponible'
        END AS EstadoStock
    FROM dbo.inventario i
    INNER JOIN dbo.producto p ON p.id_producto = i.id_producto
    INNER JOIN dbo.sucursal s ON s.id_sucursal = i.id_sucursal
    OUTER APPLY (
        SELECT TOP 1 codigo
        FROM dbo.producto_codigo_barra
        WHERE id_producto = p.id_producto AND activo = 1
        ORDER BY id_codigo_barra
    ) cb
    OUTER APPLY (
        SELECT TOP 1 dc.costo_unitario CostoUltimaCompra
        FROM dbo.detalle_compra dc INNER JOIN dbo.compra c ON c.id_compra=dc.id_compra
        WHERE dc.id_producto=p.id_producto ORDER BY c.fecha DESC,dc.id_detalle_compra DESC
    ) lastCost
    OUTER APPLY (
        SELECT TOP 1 scp.id_solicitud,scp.precio_solicitado,CONCAT(u.nombre,' ',ISNULL(u.apellidos,'')) Solicitante
        FROM dbo.solicitud_cambio_precio scp INNER JOIN dbo.usuario u ON u.id_usuario=scp.id_usuario_solicita
        WHERE scp.id_producto=p.id_producto AND scp.estado='Pendiente' ORDER BY scp.fecha_solicitud DESC
    ) pending
    WHERE i.id_sucursal = @IdSucursal
      AND (
          @Busqueda = ''
          OR p.nombre LIKE '%' + @Busqueda + '%'
          OR ISNULL(p.descripcion, '') LIKE '%' + @Busqueda + '%'
          OR CONVERT(VARCHAR(20), p.id_producto) = @Busqueda
          OR EXISTS (
              SELECT 1 FROM dbo.producto_codigo_barra x
              WHERE x.id_producto = p.id_producto AND x.activo = 1
                AND x.codigo LIKE '%' + @Busqueda + '%'
          )
      )
    ORDER BY p.nombre, p.id_producto;
END;
GO

IF OBJECT_ID('dbo.sp_obtener_inventario_productos', 'SN') IS NOT NULL
    DROP SYNONYM dbo.sp_obtener_inventario_productos;
GO

CREATE SYNONYM dbo.sp_obtener_inventario_productos
FOR dbo.sp_obtener_inventario_productos_core;
GO
