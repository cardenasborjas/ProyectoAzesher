CREATE OR ALTER PROCEDURE dbo.sp_estado_caja_core @IdUsuario INT,@IdSucursal INT AS BEGIN SET NOCOUNT ON;
 SELECT TOP(1) sc.id_sesion IdSesion,sc.fecha_apertura FechaApertura,sc.fecha_cierre FechaCierre,sc.monto_apertura MontoApertura,sc.monto_cierre MontoCierre,sc.monto_esperado MontoEsperado,sc.diferencia,sc.observaciones,
 ISNULL(SUM(CASE WHEN v.tipo_pago='efectivo' AND ISNULL(r.estado,'')<>'Anulado' THEN r.monto ELSE 0 END),0) VentasEfectivo,
 ISNULL(SUM(CASE WHEN v.tipo_pago='tarjeta' AND ISNULL(r.estado,'')<>'Anulado' THEN r.monto ELSE 0 END),0) VentasTarjeta,
 ISNULL(SUM(CASE WHEN v.tipo_pago='transferencia' AND ISNULL(r.estado,'')<>'Anulado' THEN r.monto ELSE 0 END),0) VentasTransferencia,
 ISNULL(SUM(CASE WHEN v.tipo_pago='credito' AND ISNULL(r.estado,'')<>'Anulado' THEN r.monto ELSE 0 END),0) VentasCredito,
 ISNULL(SUM(CASE WHEN ISNULL(r.estado,'')<>'Anulado' THEN r.monto ELSE 0 END),0) VentasTotales,
 (SELECT ISNULL(SUM(c.total),0) FROM dbo.compra c WHERE c.id_sesion=sc.id_sesion AND c.metodo_pago='efectivo')+(SELECT ISNULL(SUM(cp.monto),0) FROM dbo.compra_pago cp WHERE cp.id_sesion=sc.id_sesion AND cp.metodo_pago='efectivo') ComprasEfectivo,
 (SELECT ISNULL(SUM(a.monto),0) FROM dbo.abono a WHERE a.id_sesion=sc.id_sesion AND a.metodo_pago='efectivo') AbonosEfectivo,
 (SELECT ISNULL(SUM(m.monto),0) FROM dbo.movimiento_caja_manual m WHERE m.id_sesion=sc.id_sesion AND m.tipo='salida') SalidasEfectivo
 FROM dbo.sesion_caja sc LEFT JOIN dbo.venta v ON v.id_sesion=sc.id_sesion LEFT JOIN dbo.factura f ON f.id_venta=v.id_venta LEFT JOIN dbo.recibo r ON r.id_factura=f.id_factura
 WHERE sc.id_sucursal=@IdSucursal AND sc.fecha_cierre IS NULL GROUP BY sc.id_sesion,sc.fecha_apertura,sc.fecha_cierre,sc.monto_apertura,sc.monto_cierre,sc.monto_esperado,sc.diferencia,sc.observaciones ORDER BY sc.fecha_apertura DESC;
END
GO
IF OBJECT_ID('dbo.sp_estado_caja','SN') IS NOT NULL DROP SYNONYM dbo.sp_estado_caja;
GO
CREATE SYNONYM dbo.sp_estado_caja FOR dbo.sp_estado_caja_core;
GO
