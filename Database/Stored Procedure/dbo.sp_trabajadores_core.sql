CREATE OR ALTER PROCEDURE dbo.sp_listar_modulos_sistema_core AS
BEGIN SET NOCOUNT ON; SELECT id_modulo IdModulo,codigo Codigo,nombre Nombre,orden Orden FROM dbo.modulo_sistema WHERE activo=1 AND codigo NOT LIKE '%.%' ORDER BY orden; END
GO

CREATE OR ALTER PROCEDURE dbo.sp_listar_usuarios_core @Query VARCHAR(100)=''
AS
BEGIN
 SET NOCOUNT ON;
 SELECT u.id_usuario IdUsuario,u.nombre Nombre,u.apellidos Apellidos,u.telefono Telefono,u.username Username,u.correo Correo,u.fecha_expiracion_password FechaExpiracionPassword,u.rol Rol,u.id_sucursal IdSucursal,s.nombre Sucursal,u.activo Activo,
        ISNULL(STRING_AGG(m.codigo,','),'') Permisos
 FROM dbo.usuario u LEFT JOIN dbo.sucursal s ON s.id_sucursal=u.id_sucursal
 LEFT JOIN dbo.usuario_modulo um ON um.id_usuario=u.id_usuario LEFT JOIN dbo.modulo_sistema m ON m.id_modulo=um.id_modulo
 WHERE @Query='' OR u.nombre LIKE '%'+@Query+'%' OR ISNULL(u.apellidos,'') LIKE '%'+@Query+'%' OR u.username LIKE '%'+@Query+'%' OR ISNULL(u.telefono,'') LIKE '%'+@Query+'%'
 GROUP BY u.id_usuario,u.nombre,u.apellidos,u.telefono,u.username,u.correo,u.fecha_expiracion_password,u.rol,u.id_sucursal,s.nombre,u.activo ORDER BY u.nombre,u.apellidos;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_guardar_usuario_core
 @IdUsuario INT=NULL,@Nombre VARCHAR(150),@Apellidos VARCHAR(150)=NULL,@Telefono VARCHAR(20)=NULL,@Username VARCHAR(50),@PasswordHash VARCHAR(255)=NULL,@Correo VARCHAR(150)=NULL,@FechaExpiracionPassword DATE=NULL,@Rol VARCHAR(50),@IdSucursal INT=NULL,@Activo BIT=1,@Permisos VARCHAR(MAX)=''
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NULLIF(LTRIM(RTRIM(@Telefono)),'') IS NOT NULL AND (LEN(@Telefono)<>8 OR @Telefono LIKE '%[^0-9]%') THROW 50408,'El telefono debe contener exactamente 8 numeros.',1;
 IF LOWER(@Rol) NOT IN('administrador','encargado') THROW 50401,'El rol debe ser Administrador o Encargado.',1;
 IF EXISTS(SELECT 1 FROM dbo.usuario WHERE username=@Username AND (@IdUsuario IS NULL OR id_usuario<>@IdUsuario)) THROW 50402,'El nombre de usuario ya está registrado.',1;
 IF @IdUsuario IS NULL AND NULLIF(@PasswordHash,'') IS NULL THROW 50403,'La contraseña es obligatoria para un usuario nuevo.',1;
 IF LOWER(@Rol)='encargado' AND NULLIF(LTRIM(RTRIM(@Correo)),'') IS NULL THROW 50405,'El correo es obligatorio para recuperar la contraseña.',1;
 IF LOWER(@Rol)='encargado' AND @FechaExpiracionPassword IS NULL THROW 50406,'La vigencia de la contraseña es obligatoria.',1;
 IF LOWER(@Rol)='encargado' AND @FechaExpiracionPassword<CAST(GETDATE() AS DATE) THROW 50407,'La vigencia no puede ser anterior a hoy.',1;
 BEGIN TRANSACTION;
 IF @IdUsuario IS NULL
 BEGIN
   INSERT dbo.usuario(nombre,apellidos,telefono,username,password,correo,fecha_expiracion_password,rol,id_sucursal,activo) VALUES(LTRIM(RTRIM(@Nombre)),NULLIF(LTRIM(RTRIM(@Apellidos)),''),NULLIF(LTRIM(RTRIM(@Telefono)),''),LTRIM(RTRIM(@Username)),NULLIF(@PasswordHash,''),NULLIF(LTRIM(RTRIM(@Correo)),''),CASE WHEN LOWER(@Rol)='administrador' THEN NULL ELSE @FechaExpiracionPassword END,@Rol,@IdSucursal,@Activo);
   SET @IdUsuario=CONVERT(INT,SCOPE_IDENTITY());
 END
 ELSE
 BEGIN
   UPDATE dbo.usuario SET nombre=LTRIM(RTRIM(@Nombre)),apellidos=NULLIF(LTRIM(RTRIM(@Apellidos)),''),telefono=NULLIF(LTRIM(RTRIM(@Telefono)),''),username=LTRIM(RTRIM(@Username)),correo=NULLIF(LTRIM(RTRIM(@Correo)),''),rol=@Rol,id_sucursal=@IdSucursal,activo=@Activo,
          fecha_expiracion_password=CASE WHEN LOWER(@Rol)='administrador' THEN NULL ELSE @FechaExpiracionPassword END,
          requiere_cambio_password=CASE WHEN NULLIF(@PasswordHash,'') IS NULL THEN requiere_cambio_password ELSE 0 END,
          password=CASE WHEN NULLIF(@PasswordHash,'') IS NULL THEN password ELSE @PasswordHash END WHERE id_usuario=@IdUsuario;
   IF @@ROWCOUNT=0 THROW 50404,'El usuario no existe.',1;
 END
 DELETE dbo.usuario_modulo WHERE id_usuario=@IdUsuario;
 IF LOWER(@Rol)='encargado'
   INSERT dbo.usuario_modulo(id_usuario,id_modulo)
   SELECT @IdUsuario,m.id_modulo FROM dbo.modulo_sistema m JOIN STRING_SPLIT(@Permisos,',') p ON LTRIM(RTRIM(p.value))=m.codigo WHERE m.activo=1;
 COMMIT;
 SELECT @IdUsuario IdUsuario;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_listar_trabajadores_core @IdSucursal INT=NULL,@Query VARCHAR(100)='',@SoloActivos BIT=0
AS
BEGIN
 SET NOCOUNT ON;
 SELECT v.id_vendedor IdVendedor,v.nombre Nombre,v.telefono Telefono,v.correo Correo,v.dpi Dpi,v.puesto Puesto,v.fecha_ingreso FechaIngreso,
        v.id_sucursal IdSucursal,s.nombre Sucursal,v.activo Activo,
        COUNT(DISTINCT CASE WHEN ISNULL(r.estado,'')<>'Anulado' THEN ve.id_venta END) Ventas,ISNULL(SUM(CASE WHEN ISNULL(r.estado,'')<>'Anulado' THEN ve.total ELSE 0 END),0) TotalVendido
 FROM dbo.vendedor v LEFT JOIN dbo.sucursal s ON s.id_sucursal=v.id_sucursal
 LEFT JOIN dbo.venta ve ON ve.id_vendedor=v.id_vendedor
 LEFT JOIN dbo.factura f ON f.id_venta=ve.id_venta LEFT JOIN dbo.recibo r ON r.id_factura=f.id_factura
 WHERE (@IdSucursal IS NULL OR v.id_sucursal=@IdSucursal) AND (@SoloActivos=0 OR v.activo=1)
   AND (@Query='' OR v.nombre LIKE '%'+@Query+'%' OR ISNULL(v.dpi,'') LIKE '%'+@Query+'%' OR ISNULL(v.telefono,'') LIKE '%'+@Query+'%')
 GROUP BY v.id_vendedor,v.nombre,v.telefono,v.correo,v.dpi,v.puesto,v.fecha_ingreso,v.id_sucursal,s.nombre,v.activo ORDER BY v.nombre;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_guardar_trabajador_core
 @IdVendedor INT=NULL,@Nombre VARCHAR(150),@Telefono VARCHAR(20)=NULL,@Correo VARCHAR(150)=NULL,@Dpi VARCHAR(20)=NULL,@Puesto VARCHAR(80)=NULL,@FechaIngreso DATE=NULL,@IdSucursal INT,@Activo BIT=1,@IdUsuario INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF NULLIF(LTRIM(RTRIM(@Nombre)),'') IS NULL THROW 50410,'El nombre es obligatorio.',1;
 IF NULLIF(LTRIM(RTRIM(@Dpi)),'') IS NOT NULL AND (LEN(@Dpi)<>13 OR @Dpi LIKE '%[^0-9]%') THROW 50412,'El DPI debe contener exactamente 13 números.',1;
 IF NULLIF(LTRIM(RTRIM(@Telefono)),'') IS NOT NULL AND (LEN(@Telefono)<>8 OR @Telefono LIKE '%[^0-9]%') THROW 50413,'El teléfono debe contener exactamente 8 números.',1;
 IF NULLIF(LTRIM(RTRIM(@Dpi)),'') IS NOT NULL AND EXISTS(SELECT 1 FROM dbo.vendedor WHERE dpi=@Dpi AND (@IdVendedor IS NULL OR id_vendedor<>@IdVendedor)) THROW 50414,'Ya existe un trabajador con ese DPI.',1;
 DECLARE @EsNuevo BIT=CASE WHEN @IdVendedor IS NULL THEN 1 ELSE 0 END,@ActivoAnterior BIT,@SucursalAnterior INT;
 IF @EsNuevo=0 SELECT @ActivoAnterior=activo,@SucursalAnterior=id_sucursal FROM dbo.vendedor WHERE id_vendedor=@IdVendedor;
 IF @IdVendedor IS NULL
 BEGIN
   INSERT dbo.vendedor(nombre,telefono,correo,dpi,puesto,fecha_ingreso,id_sucursal,activo)
   VALUES(LTRIM(RTRIM(@Nombre)),NULLIF(LTRIM(RTRIM(@Telefono)),''),NULLIF(LTRIM(RTRIM(@Correo)),''),NULLIF(LTRIM(RTRIM(@Dpi)),''),'Vendedor',ISNULL(@FechaIngreso,CAST(GETDATE() AS DATE)),@IdSucursal,@Activo);
   SET @IdVendedor=CONVERT(INT,SCOPE_IDENTITY());
   INSERT dbo.historial_trabajador(id_vendedor,fecha,tipo,detalle,estado,id_sucursal,id_usuario)
   VALUES(@IdVendedor,GETDATE(),'Registro','Trabajador registrado en el sistema.',CASE WHEN @Activo=1 THEN 'Activo' ELSE 'Inactivo' END,@IdSucursal,@IdUsuario);
 END
 ELSE
 BEGIN
   UPDATE dbo.vendedor SET nombre=LTRIM(RTRIM(@Nombre)),telefono=NULLIF(LTRIM(RTRIM(@Telefono)),''),correo=NULLIF(LTRIM(RTRIM(@Correo)),''),dpi=NULLIF(LTRIM(RTRIM(@Dpi)),''),
          puesto='Vendedor',fecha_ingreso=@FechaIngreso,id_sucursal=@IdSucursal,activo=@Activo WHERE id_vendedor=@IdVendedor;
   IF @@ROWCOUNT=0 THROW 50411,'El trabajador no existe.',1;
   INSERT dbo.historial_trabajador(id_vendedor,fecha,tipo,detalle,estado,id_sucursal,id_usuario)
   VALUES(@IdVendedor,GETDATE(),CASE WHEN ISNULL(@ActivoAnterior,1)<>@Activo THEN CASE WHEN @Activo=1 THEN 'Reactivación' ELSE 'Desactivación' END WHEN ISNULL(@SucursalAnterior,0)<>@IdSucursal THEN 'Cambio de sucursal' ELSE 'Edición' END,
          CASE WHEN ISNULL(@SucursalAnterior,0)<>@IdSucursal THEN 'Se actualizó la sucursal asignada.' ELSE 'Se actualizaron los datos del trabajador.' END,
          CASE WHEN @Activo=1 THEN 'Activo' ELSE 'Inactivo' END,@IdSucursal,@IdUsuario);
 END
 SELECT @IdVendedor IdVendedor;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_guardar_evaluacion_trabajador_core
 @IdVendedor INT,@PeriodoDesde DATE,@PeriodoHasta DATE,@Puntualidad TINYINT,@ServicioCliente TINYINT,@CumplimientoMetas TINYINT,@TrabajoEquipo TINYINT,@PreguntasJson NVARCHAR(MAX)=NULL,@Observaciones VARCHAR(800)=NULL,@IdUsuario INT
AS
BEGIN
 SET NOCOUNT ON;
 IF @PeriodoHasta<@PeriodoDesde THROW 50420,'El período de evaluación no es válido.',1;
 IF @Puntualidad NOT BETWEEN 1 AND 5 OR @ServicioCliente NOT BETWEEN 1 AND 5 OR @CumplimientoMetas NOT BETWEEN 1 AND 5 OR @TrabajoEquipo NOT BETWEEN 1 AND 5 THROW 50421,'Las puntuaciones deben estar entre 1 y 5.',1;
 INSERT dbo.evaluacion_trabajador(id_vendedor,periodo_desde,periodo_hasta,puntualidad,servicio_cliente,cumplimiento_metas,trabajo_equipo,observaciones,id_usuario)
 VALUES(@IdVendedor,@PeriodoDesde,@PeriodoHasta,@Puntualidad,@ServicioCliente,@CumplimientoMetas,@TrabajoEquipo,NULLIF(LTRIM(RTRIM(@Observaciones)),''),@IdUsuario);
 DECLARE @IdEvaluacion INT=CONVERT(INT,SCOPE_IDENTITY());
 INSERT dbo.evaluacion_trabajador_pregunta(id_evaluacion,pregunta,puntuacion)
 SELECT @IdEvaluacion,LTRIM(RTRIM(Pregunta)),Puntuacion
 FROM OPENJSON(COALESCE(@PreguntasJson,'[]')) WITH(Pregunta VARCHAR(180) '$.Pregunta',Puntuacion TINYINT '$.Puntuacion')
 WHERE NULLIF(LTRIM(RTRIM(Pregunta)),'') IS NOT NULL AND Puntuacion BETWEEN 1 AND 5;
 SELECT @IdEvaluacion IdEvaluacion;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_kpis_trabajadores_core @IdSucursal INT=NULL,@FechaDesde DATE,@FechaHasta DATE
AS
BEGIN
 SET NOCOUNT ON;
 SELECT v.id_vendedor IdVendedor,v.nombre Trabajador,v.puesto Puesto,s.nombre Sucursal,COUNT(DISTINCT CASE WHEN ISNULL(r.estado,'')<>'Anulado' THEN ve.id_venta END) Ventas,
        ISNULL(SUM(CASE WHEN ISNULL(r.estado,'')<>'Anulado' THEN ve.total ELSE 0 END),0) TotalVendido,
        ISNULL(AVG(CASE WHEN ISNULL(r.estado,'')<>'Anulado' THEN ve.total END),0) VentaPromedio,
        ISNULL(ev.PromedioEvaluacion,0) PromedioEvaluacion
 FROM dbo.vendedor v JOIN dbo.sucursal s ON s.id_sucursal=v.id_sucursal LEFT JOIN dbo.venta ve ON ve.id_vendedor=v.id_vendedor AND CAST(ve.fecha AS DATE) BETWEEN @FechaDesde AND @FechaHasta
 LEFT JOIN dbo.factura f ON f.id_venta=ve.id_venta LEFT JOIN dbo.recibo r ON r.id_factura=f.id_factura
 OUTER APPLY(SELECT AVG(CONVERT(DECIMAL(5,2),(e.puntualidad+e.servicio_cliente+e.cumplimiento_metas+e.trabajo_equipo+ISNULL(px.TotalExtra,0))/(4.0+ISNULL(px.CantidadExtra,0)))) PromedioEvaluacion FROM dbo.evaluacion_trabajador e OUTER APPLY(SELECT SUM(p.puntuacion) TotalExtra,COUNT(*) CantidadExtra FROM dbo.evaluacion_trabajador_pregunta p WHERE p.id_evaluacion=e.id_evaluacion)px WHERE e.id_vendedor=v.id_vendedor AND e.periodo_desde<=@FechaHasta AND e.periodo_hasta>=@FechaDesde)ev
 WHERE (@IdSucursal IS NULL OR v.id_sucursal=@IdSucursal) AND v.activo=1
 GROUP BY v.id_vendedor,v.nombre,v.puesto,s.nombre,ev.PromedioEvaluacion ORDER BY TotalVendido DESC,v.nombre;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ventas_trabajador_core @IdSucursal INT,@IdVendedor INT=NULL,@FechaDesde DATE,@FechaHasta DATE
AS
BEGIN
 SET NOCOUNT ON;
 SELECT ve.id_venta IdVenta,ve.fecha Fecha,v.id_vendedor IdVendedor,v.nombre Trabajador,c.nombre Cliente,r.numero_recibo Recibo,
        ve.tipo_pago MetodoPago,ve.total Total,ISNULL(r.estado,'Sin recibo') Estado
 FROM dbo.venta ve JOIN dbo.vendedor v ON v.id_vendedor=ve.id_vendedor LEFT JOIN dbo.cliente c ON c.id_cliente=ve.id_cliente
 LEFT JOIN dbo.factura f ON f.id_venta=ve.id_venta LEFT JOIN dbo.recibo r ON r.id_factura=f.id_factura
 WHERE v.id_sucursal=@IdSucursal AND (@IdVendedor IS NULL OR v.id_vendedor=@IdVendedor) AND CAST(ve.fecha AS DATE) BETWEEN @FechaDesde AND @FechaHasta
 ORDER BY ve.fecha DESC;
END
GO

DECLARE @n VARCHAR(128),@c VARCHAR(128);
DECLARE sin CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM (VALUES
('sp_listar_modulos_sistema','sp_listar_modulos_sistema_core'),('sp_listar_usuarios','sp_listar_usuarios_core'),('sp_guardar_usuario','sp_guardar_usuario_core'),
('sp_listar_trabajadores','sp_listar_trabajadores_core'),('sp_guardar_trabajador','sp_guardar_trabajador_core'),('sp_guardar_evaluacion_trabajador','sp_guardar_evaluacion_trabajador_core'),
('sp_kpis_trabajadores','sp_kpis_trabajadores_core'),('sp_ventas_trabajador','sp_ventas_trabajador_core'))x(n,c);
OPEN sin;FETCH NEXT FROM sin INTO @n,@c;
WHILE @@FETCH_STATUS=0 BEGIN EXEC('IF OBJECT_ID(''dbo.'+@n+''',''SN'') IS NOT NULL DROP SYNONYM dbo.'+@n);EXEC('CREATE SYNONYM dbo.'+@n+' FOR dbo.'+@c);FETCH NEXT FROM sin INTO @n,@c;END
CLOSE sin;DEALLOCATE sin;
GO
