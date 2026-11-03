IF COL_LENGTH('dbo.detalle_venta','costo_unitario') IS NULL
BEGIN
    ALTER TABLE dbo.detalle_venta ADD costo_unitario DECIMAL(12,2) NULL;
END;
GO

UPDATE dv SET costo_unitario=ISNULL(cost.costo,0)
FROM dbo.detalle_venta dv
OUTER APPLY(
    SELECT TOP(1) dc.costo_unitario costo
    FROM dbo.detalle_compra dc
    WHERE dc.id_producto=dv.id_producto
    ORDER BY dc.id_detalle_compra DESC
) cost
WHERE dv.costo_unitario IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id=OBJECT_ID('dbo.detalle_venta')
      AND name='costo_unitario'
      AND is_nullable=1
)
BEGIN
    ALTER TABLE dbo.detalle_venta ALTER COLUMN costo_unitario DECIMAL(12,2) NOT NULL;
END;
GO
