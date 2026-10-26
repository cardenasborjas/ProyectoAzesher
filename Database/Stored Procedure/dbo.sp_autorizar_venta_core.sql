CREATE OR ALTER PROCEDURE dbo.sp_autorizar_venta_core
    @IdUsuario INT,
    @IdCliente INT = NULL,
    @IdSucursal INT,
    @IdVendedor INT,
    @ClienteNombre VARCHAR(150),
    @ClienteNit VARCHAR(20) = NULL,
    @ClienteDomicilio VARCHAR(300) = NULL,
    @ClienteTelefono VARCHAR(20) = NULL,
    @MetodoPago VARCHAR(50),
    @ReferenciaPago VARCHAR(100) = NULL,
    @IdMoneda INT = NULL,
    @IdTipoPos INT = NULL,
    @FechaTransferencia DATE = NULL,
    @ComprobanteTransferencia VARBINARY(MAX) = NULL,
    @ComprobanteMime VARCHAR(100) = NULL,
    @NumeroCuotas INT = NULL,
    @MontoInicial DECIMAL(12,2) = 0,
    @CuotasJson NVARCHAR(MAX) = NULL,
    @Total DECIMAL(12,2),
    @DetallesJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.sucursal WHERE id_sucursal = @IdSucursal)
            THROW 50001, 'La sucursal seleccionada no existe.', 1;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.vendedor
            WHERE id_vendedor = @IdVendedor AND id_sucursal = @IdSucursal AND activo = 1
        )
            THROW 50002, 'El vendedor seleccionado no pertenece a la sucursal o está desactivado.', 1;

        DECLARE @Detalles TABLE (
            IdProducto INT NOT NULL PRIMARY KEY,
            ProductoNombre VARCHAR(150) NOT NULL,
            Cantidad INT NOT NULL,
            PrecioUnitario DECIMAL(12,2) NOT NULL,
            Subtotal DECIMAL(12,2) NOT NULL
        );

        INSERT INTO @Detalles (IdProducto, ProductoNombre, Cantidad, PrecioUnitario, Subtotal)
        SELECT IdProducto, ProductoNombre, Cantidad, PrecioUnitario, Subtotal
        FROM OPENJSON(@DetallesJson)
        WITH (
            IdProducto INT '$.IdProducto',
            ProductoNombre VARCHAR(150) '$.ProductoNombre',
            Cantidad INT '$.Cantidad',
            PrecioUnitario DECIMAL(12,2) '$.PrecioUnitario',
            Subtotal DECIMAL(12,2) '$.Subtotal'
        );

        IF NOT EXISTS (SELECT 1 FROM @Detalles)
            THROW 50003, 'El recibo debe incluir al menos un producto.', 1;

        IF @Total <= 0
            THROW 50017, 'El total de la venta debe ser mayor que cero.', 1;

        IF EXISTS (SELECT 1 FROM @Detalles WHERE Cantidad <= 0)
            THROW 50004, 'Las cantidades de los productos deben ser mayores que cero.', 1;

        DECLARE @ProductoSinStock VARCHAR(150);
        SELECT TOP 1 @ProductoSinStock = d.ProductoNombre
        FROM @Detalles d
        LEFT JOIN dbo.inventario i WITH (UPDLOCK, HOLDLOCK)
            ON i.id_producto = d.IdProducto AND i.id_sucursal = @IdSucursal
        WHERE ISNULL(i.stock, 0) < d.Cantidad;

        IF @ProductoSinStock IS NOT NULL
        BEGIN
            DECLARE @MensajeStock NVARCHAR(2048) = CONCAT('No hay existencias suficientes del producto ', @ProductoSinStock, ' en la sucursal seleccionada.');
            THROW 50005, @MensajeStock, 1;
        END

        IF ISNULL(@IdCliente, 0) <= 0
        BEGIN
            SELECT TOP 1 @IdCliente = id_cliente
            FROM dbo.cliente
            WHERE ISNULL(nit, '') = ISNULL(@ClienteNit, '') AND nombre = @ClienteNombre;

            IF ISNULL(@IdCliente, 0) <= 0
            BEGIN
                INSERT INTO dbo.cliente (nombre, telefono, direccion, nit)
                VALUES (@ClienteNombre, @ClienteTelefono, @ClienteDomicilio, @ClienteNit);
                SET @IdCliente = CAST(SCOPE_IDENTITY() AS INT);
            END
        END

        IF @MetodoPago = 'efectivo' AND NOT EXISTS (SELECT 1 FROM dbo.moneda WHERE id_moneda = @IdMoneda AND activo = 1)
            THROW 50006, 'Debes seleccionar una moneda válida.', 1;
        IF @MetodoPago = 'tarjeta' AND NOT EXISTS (SELECT 1 FROM dbo.tipo_pos WHERE id_tipo_pos = @IdTipoPos AND activo = 1)
            THROW 50007, 'Debes seleccionar el tipo de POS.', 1;
        IF @MetodoPago = 'tarjeta' AND NULLIF(LTRIM(RTRIM(@ReferenciaPago)), '') IS NULL
            THROW 50008, 'Debes ingresar el número de voucher.', 1;
        IF @MetodoPago = 'transferencia' AND (@FechaTransferencia IS NULL OR NULLIF(LTRIM(RTRIM(@ReferenciaPago)), '') IS NULL)
            THROW 50009, 'La fecha y el número de transferencia son obligatorios.', 1;

        DECLARE @IdSesion INT;
        SELECT TOP 1 @IdSesion = id_sesion
        FROM dbo.sesion_caja
        WHERE id_sucursal = @IdSucursal AND fecha_cierre IS NULL
        ORDER BY fecha_apertura DESC;

        IF ISNULL(@IdSesion, 0) <= 0
            THROW 50016, 'Debe existir una caja abierta en esta sucursal antes de autorizar una venta.', 1;

        DECLARE @IdVenta INT;
        INSERT INTO dbo.venta (fecha, total, tipo_pago, id_cliente, id_vendedor, id_sesion, id_usuario)
        VALUES (GETDATE(), @Total, @MetodoPago, @IdCliente, @IdVendedor, @IdSesion, @IdUsuario);
        SET @IdVenta = CAST(SCOPE_IDENTITY() AS INT);

        INSERT INTO dbo.detalle_pago_venta (
            id_venta, id_moneda, id_tipo_pos, fecha_transferencia,
            comprobante_transferencia, comprobante_mime
        )
        VALUES (
            @IdVenta, @IdMoneda, @IdTipoPos, @FechaTransferencia,
            @ComprobanteTransferencia, @ComprobanteMime
        );

        INSERT INTO dbo.detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
        SELECT @IdVenta, IdProducto, Cantidad, PrecioUnitario, Subtotal FROM @Detalles;

        UPDATE i
        SET i.stock = i.stock - d.Cantidad
        FROM dbo.inventario i
        INNER JOIN @Detalles d ON d.IdProducto = i.id_producto
        WHERE i.id_sucursal = @IdSucursal;

        IF @MetodoPago = 'credito'
        BEGIN
            DECLARE @Disponible DECIMAL(12,2);
            SELECT @Disponible = cc.limite_credito - ISNULL(SUM(cx.saldo_pendiente), 0)
            FROM dbo.cliente_credito cc
            LEFT JOIN dbo.venta vx ON vx.id_cliente = cc.id_cliente
            LEFT JOIN dbo.cuenta_cobrar cx ON cx.id_venta = vx.id_venta AND cx.estado = 'Pendiente'
            WHERE cc.id_cliente = @IdCliente
              AND cc.activo = 1
              AND ISNULL(cc.estado_autorizacion, 'Autorizado') = 'Autorizado'
              AND (cc.fecha_vencimiento_autorizacion IS NULL OR cc.fecha_vencimiento_autorizacion >= CAST(GETDATE() AS DATE))
            GROUP BY cc.limite_credito;

            IF @Disponible IS NULL
                THROW 50010, 'El cliente no está autorizado para cuentas por cobrar.', 1;
            IF @MontoInicial < 0 OR @MontoInicial > @Total
                THROW 50011, 'El monto inicial no es válido.', 1;
            IF @Disponible < (@Total - @MontoInicial)
                THROW 50012, 'El monto pendiente supera el crédito disponible del cliente.', 1;
            IF ISNULL(@NumeroCuotas, 0) <= 0
                THROW 50013, 'Debes definir la cantidad de cuotas del crédito.', 1;

            DECLARE @IdCuenta INT;
            INSERT INTO dbo.cuenta_cobrar (
                id_venta, saldo_pendiente, estado, numero_cuotas, monto_inicial
            )
            VALUES (
                @IdVenta, @Total - @MontoInicial,
                CASE WHEN @Total - @MontoInicial = 0 THEN 'Pagada' ELSE 'Pendiente' END,
                @NumeroCuotas, @MontoInicial
            );
            SET @IdCuenta = CAST(SCOPE_IDENTITY() AS INT);

            INSERT INTO dbo.cuota_cuenta_cobrar (id_cuenta, numero_cuota, fecha_vencimiento, monto)
            SELECT @IdCuenta, NumeroCuota, FechaVencimiento, Monto
            FROM OPENJSON(@CuotasJson)
            WITH (
                NumeroCuota INT '$.NumeroCuota',
                FechaVencimiento DATE '$.FechaVencimiento',
                Monto DECIMAL(12,2) '$.Monto'
            );

            IF (SELECT COUNT(*) FROM dbo.cuota_cuenta_cobrar WHERE id_cuenta = @IdCuenta) <> @NumeroCuotas
                THROW 50014, 'El calendario de cuotas está incompleto.', 1;
            IF ABS((SELECT SUM(monto) FROM dbo.cuota_cuenta_cobrar WHERE id_cuenta = @IdCuenta) - (@Total - @MontoInicial)) > 0.01
                THROW 50015, 'El total de las cuotas no coincide con el saldo pendiente.', 1;
        END

        DECLARE @IdFactura INT;
        INSERT INTO dbo.factura (numero_factura, fecha_emision, total, estado, id_venta)
        VALUES ('BORRADOR', GETDATE(), @Total, 'Pendiente', @IdVenta);
        SET @IdFactura = CAST(SCOPE_IDENTITY() AS INT);

        UPDATE dbo.factura
        SET numero_factura = CONCAT('BOR-', RIGHT('000000' + CAST(@IdFactura AS VARCHAR(10)), 6))
        WHERE id_factura = @IdFactura;

        DECLARE @IdRecibo INT;
        INSERT INTO dbo.recibo (numero_recibo, fecha_pago, monto, metodo_pago, numero_comprobante, id_factura, id_sucursal)
        VALUES ('PENDIENTE', GETDATE(), @Total, @MetodoPago, @ReferenciaPago, @IdFactura, @IdSucursal);
        SET @IdRecibo = CAST(SCOPE_IDENTITY() AS INT);

        UPDATE dbo.recibo
        SET numero_recibo = CONCAT('REC-', RIGHT('000000' + CAST(@IdRecibo AS VARCHAR(10)), 6))
        WHERE id_recibo = @IdRecibo;

        COMMIT TRANSACTION;
        SELECT @IdRecibo AS IdRecibo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

IF OBJECT_ID('dbo.sp_autorizar_venta', 'SN') IS NOT NULL
    DROP SYNONYM dbo.sp_autorizar_venta;
GO
CREATE SYNONYM dbo.sp_autorizar_venta FOR dbo.sp_autorizar_venta_core;
GO
