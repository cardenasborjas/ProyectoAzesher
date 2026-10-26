IF COL_LENGTH('dbo.proveedor', 'activo') IS NULL
    ALTER TABLE dbo.proveedor ADD activo BIT NOT NULL CONSTRAINT df_proveedor_activo DEFAULT 1;
GO
