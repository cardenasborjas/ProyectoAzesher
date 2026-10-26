CREATE OR ALTER PROCEDURE dbo.sp_datos_maestros_desactivar @Entidad VARCHAR(40), @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Entidad='proveedores' UPDATE dbo.proveedor SET activo=0 WHERE id_proveedor=@Id;
    ELSE IF @Entidad='vendedores' UPDATE dbo.vendedor SET activo=0 WHERE id_vendedor=@Id;
    ELSE IF @Entidad='monedas' UPDATE dbo.moneda SET activo=0 WHERE id_moneda=@Id;
    ELSE IF @Entidad='tipos-pos' UPDATE dbo.tipo_pos SET activo=0 WHERE id_tipo_pos=@Id;
    ELSE IF @Entidad='clientes-credito' UPDATE dbo.cliente_credito SET activo=0 WHERE id_cliente_credito=@Id;
    ELSE IF @Entidad='categorias-producto' UPDATE dbo.categoria_producto SET activo=0 WHERE id_categoria=@Id;
    ELSE IF @Entidad='motivos-salida' UPDATE dbo.motivo_salida_inventario SET activo=0 WHERE id_motivo=@Id;
    ELSE IF @Entidad='preguntas-evaluacion' UPDATE dbo.pregunta_evaluacion SET activo=0 WHERE id_pregunta=@Id;
    ELSE IF @Entidad='bonos-planilla' BEGIN UPDATE dbo.bono_planilla SET activo=0 WHERE id_bono=@Id; UPDATE dbo.trabajador_bono SET activo=0 WHERE id_bono=@Id; END
    ELSE IF @Entidad='proveedor-producto'
    BEGIN
        DECLARE @r INT = @Id / 1000000, @p INT = @Id % 1000000;
        UPDATE dbo.proveedor_producto SET activo=0 WHERE id_proveedor=@r AND id_producto=@p;
    END
    ELSE THROW 50004, 'Este catálogo conserva historial y no permite eliminación. Puedes editar el registro.',1;
END
GO
