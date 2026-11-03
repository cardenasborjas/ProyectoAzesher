IF COL_LENGTH('dbo.sucursal','activo') IS NULL
    ALTER TABLE dbo.sucursal ADD activo BIT NOT NULL CONSTRAINT DF_sucursal_activo DEFAULT(1);
GO
DECLARE @IdMelchor02 INT=(SELECT TOP(1) id_sucursal FROM dbo.sucursal WHERE LTRIM(RTRIM(LOWER(nombre)))='melchor 02');
IF @IdMelchor02 IS NOT NULL
BEGIN
    IF NOT EXISTS(SELECT 1 FROM dbo.inventario WHERE id_sucursal=@IdMelchor02)
       AND NOT EXISTS(SELECT 1 FROM dbo.usuario WHERE id_sucursal=@IdMelchor02)
       AND NOT EXISTS(SELECT 1 FROM dbo.vendedor WHERE id_sucursal=@IdMelchor02)
       AND NOT EXISTS(SELECT 1 FROM dbo.compra WHERE id_sucursal=@IdMelchor02)
       AND NOT EXISTS(SELECT 1 FROM dbo.recibo WHERE id_sucursal=@IdMelchor02)
       AND NOT EXISTS(SELECT 1 FROM dbo.sesion_caja WHERE id_sucursal=@IdMelchor02)
       AND NOT EXISTS(SELECT 1 FROM dbo.traslado WHERE id_sucursal_origen=@IdMelchor02 OR id_sucursal_destino=@IdMelchor02)
        DELETE dbo.sucursal WHERE id_sucursal=@IdMelchor02;
    ELSE UPDATE dbo.sucursal SET activo=0 WHERE id_sucursal=@IdMelchor02;
END;
GO
