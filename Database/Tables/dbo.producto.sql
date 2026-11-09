-- ==============================================================================
-- TABLA: PRODUCTO
-- Descripci�n: Cat�logo central de todos los productos disponibles.
-- ==============================================================================
IF OBJECT_ID('dbo.producto', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.producto)
        DROP TABLE dbo.producto;
    ELSE
        PRINT 'La tabla "producto" contiene datos. Omitiendo eliminaci�n.';
END
GO

IF OBJECT_ID('dbo.producto', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.producto (
        id_producto INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        descripcion VARCHAR(MAX),
        costo DECIMAL(12,2) NULL,
        precio DECIMAL(12,2) NOT NULL
    );
    CREATE INDEX idx_producto_nombre ON dbo.producto(nombre);
END
GO

IF COL_LENGTH('dbo.producto', 'costo') IS NULL
    ALTER TABLE dbo.producto ADD costo DECIMAL(12,2) NULL;
GO


/*=========================================================
AGREGAR COLUMNA cod_producto
=========================================================*/

IF COL_LENGTH('dbo.producto', 'cod_producto') IS NULL
BEGIN
    ALTER TABLE dbo.producto
    ADD cod_producto VARCHAR(20);
END
GO

/*=========================================================
AGREGAR CONSTRAINT UNIQUE
=========================================================*/

IF NOT EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE name = 'UQ_producto_cod_producto'
)
BEGIN
    ALTER TABLE dbo.producto
    ADD CONSTRAINT UQ_producto_cod_producto
    UNIQUE (cod_producto);
END
GO
