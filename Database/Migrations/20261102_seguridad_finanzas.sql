IF COL_LENGTH('dbo.detalle_venta','costo_unitario') IS NULL
BEGIN
    ALTER TABLE dbo.detalle_venta ADD costo_unitario DECIMAL(12,2) NULL;
    UPDATE dv SET costo_unitario=ISNULL(cost.costo,0)
    FROM dbo.detalle_venta dv
    OUTER APPLY(SELECT TOP(1) dc.costo_unitario costo FROM dbo.detalle_compra dc WHERE dc.id_producto=dv.id_producto ORDER BY dc.id_detalle_compra DESC) cost;
    ALTER TABLE dbo.detalle_venta ALTER COLUMN costo_unitario DECIMAL(12,2) NOT NULL;
END;
GO
