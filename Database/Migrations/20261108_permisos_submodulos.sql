MERGE dbo.modulo_sistema AS destino
USING (VALUES
 ('inventarios.productos','Listado de productos',201),
 ('inventarios.entradas','Entrada de pedido',202),
 ('inventarios.salidas','Salida de producto',203),
 ('inventarios.proveedores','Proveedores',204),
 ('inventarios.traslados','Traslados',205),
 ('ventas.venta','Venta de productos',301),
 ('ventas.recibos','Recibos',302),
 ('ventas.facturas','Facturas',303),
 ('caja.apertura','Apertura y cierre',401),
 ('caja.cierres','Listado de cierres',402),
 ('clientes.listado','Gestión de clientes',501),
 ('cobros.estado','Estado de cuenta',601),
 ('cobros.abonos','Registrar abonos',602),
 ('cobros.listado','Listado de cobros',603),
 ('cobros.autorizar','Autorizar crédito',604),
 ('reportes.consolidado','Reportes consolidados',701),
 ('reportes.ganancias','Control de ganancias',702),
 ('trabajadores.registro','Registro de trabajadores',801),
 ('trabajadores.kpis','KPIs',802),
 ('trabajadores.evaluacion','Evaluaciones',803),
 ('trabajadores.ventas','Ventas por trabajador',804),
 ('trabajadores.planilla','Planilla',805),
 ('configuracion.datos','Datos maestros',901),
 ('configuracion.usuarios','Usuarios',902)
) AS origen(codigo,nombre,orden)
ON destino.codigo=origen.codigo
WHEN MATCHED THEN UPDATE SET nombre=origen.nombre,orden=origen.orden,activo=1
WHEN NOT MATCHED THEN INSERT(codigo,nombre,orden,activo) VALUES(origen.codigo,origen.nombre,origen.orden,1);
GO
