IF COL_LENGTH('dbo.proveedor', 'activo') IS NULL
    ALTER TABLE dbo.proveedor ADD activo BIT NOT NULL CONSTRAINT df_proveedor_activo DEFAULT 1;
GO

:r "Database/Stored Procedure/dbo.sp_datos_maestros_listar.sql"
:r "Database/Stored Procedure/dbo.sp_datos_maestros_guardar.sql"
:r "Database/Stored Procedure/dbo.sp_datos_maestros_desactivar.sql"
:r "Database/Stored Procedure/dbo.sp_obtener_proveedores_entrada_core.sql"
:r "Database/Stored Procedure/dbo.sp_buscar_proveedores_core.sql"
:r "Database/Stored Procedure/dbo.sp_crear_producto_entrada_core.sql"
:r "Database/Stored Procedure/dbo.sp_buscar_productos_entrada_core.sql"
:r "Database/Stored Procedure/dbo.sp_registrar_entrada_pedido_core.sql"
:r "Database/Stored Procedure/dbo.sp_autorizar_venta_core.sql"
