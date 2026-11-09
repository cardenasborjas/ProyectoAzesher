IF COL_LENGTH('dbo.producto','costo') IS NULL
    ALTER TABLE dbo.producto ADD costo DECIMAL(12,2) NULL;
GO

UPDATE p SET costo=lastCost.costo_unitario
FROM dbo.producto p
OUTER APPLY(
    SELECT TOP(1) dc.costo_unitario
    FROM dbo.detalle_compra dc INNER JOIN dbo.compra c ON c.id_compra=dc.id_compra
    WHERE dc.id_producto=p.id_producto
    ORDER BY c.fecha DESC,dc.id_detalle_compra DESC
) lastCost
WHERE p.costo IS NULL AND lastCost.costo_unitario IS NOT NULL;
GO

UPDATE dv SET costo_unitario=COALESCE(costAtSale.costo_unitario,p.costo,0)
FROM dbo.detalle_venta dv
INNER JOIN dbo.venta v ON v.id_venta=dv.id_venta
INNER JOIN dbo.producto p ON p.id_producto=dv.id_producto
OUTER APPLY(
    SELECT TOP(1) dc.costo_unitario
    FROM dbo.detalle_compra dc INNER JOIN dbo.compra c ON c.id_compra=dc.id_compra
    WHERE dc.id_producto=dv.id_producto AND c.fecha<=v.fecha
    ORDER BY c.fecha DESC,dc.id_detalle_compra DESC
) costAtSale
WHERE ISNULL(dv.costo_unitario,0)=0;
GO
