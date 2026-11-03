IF OBJECT_ID('dbo.solicitud_cambio_precio','U') IS NULL
BEGIN
    CREATE TABLE dbo.solicitud_cambio_precio(
        id_solicitud INT IDENTITY(1,1) PRIMARY KEY,
        id_producto INT NOT NULL,
        precio_actual DECIMAL(12,2) NOT NULL,
        precio_solicitado DECIMAL(12,2) NOT NULL,
        id_usuario_solicita INT NOT NULL,
        fecha_solicitud DATETIME2 NOT NULL CONSTRAINT df_solicitud_precio_fecha DEFAULT SYSUTCDATETIME(),
        estado VARCHAR(20) NOT NULL CONSTRAINT df_solicitud_precio_estado DEFAULT 'Pendiente',
        id_usuario_resuelve INT NULL,
        fecha_resolucion DATETIME2 NULL,
        CONSTRAINT fk_solicitud_precio_producto FOREIGN KEY(id_producto) REFERENCES dbo.producto(id_producto),
        CONSTRAINT fk_solicitud_precio_solicita FOREIGN KEY(id_usuario_solicita) REFERENCES dbo.usuario(id_usuario),
        CONSTRAINT fk_solicitud_precio_resuelve FOREIGN KEY(id_usuario_resuelve) REFERENCES dbo.usuario(id_usuario),
        CONSTRAINT ck_solicitud_precio_valores CHECK(precio_actual>=0 AND precio_solicitado>0),
        CONSTRAINT ck_solicitud_precio_estado CHECK(estado IN('Pendiente','Aprobada','Rechazada'))
    );
    CREATE UNIQUE INDEX ux_solicitud_precio_pendiente ON dbo.solicitud_cambio_precio(id_producto) WHERE estado='Pendiente';
END;
GO
