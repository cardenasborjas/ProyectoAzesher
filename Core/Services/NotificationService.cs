using Core.DTOs;
using Dapper;
using Microsoft.Data.SqlClient;

namespace Core.Services;

public sealed class NotificationService(IConfiguration configuration)
{
    private readonly string connectionString = configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("No se configuró la conexión a la base de datos.");

    private sealed class ClientRow
    {
        public string Nombre { get; set; } = "";
        public string Nit { get; set; } = "CF";
    }
    private sealed class PriceProductRow { public string Nombre { get; set; } = ""; public decimal Precio { get; set; } public decimal? Costo { get; set; } }
    private sealed class PriceRequestRow { public int IdProducto { get; set; } public decimal PrecioSolicitado { get; set; } public int IdUsuarioSolicita { get; set; } public string Producto { get; set; } = ""; public decimal? Costo { get; set; } }

    public async Task<NotificationListDTO> ListAsync(int userId, bool includeRead, int limit)
    {
        await using var db = new SqlConnection(connectionString);
        var rows = (await db.QueryAsync<NotificationDTO>("""
            SELECT TOP(@Limit) id_notificacion IdNotificacion,tipo Tipo,titulo Titulo,mensaje Mensaje,
                   url Url,entidad Entidad,id_entidad IdEntidad,fecha_creacion FechaCreacion,
                   fecha_lectura FechaLectura,fecha_resolucion FechaResolucion
            FROM dbo.notificacion
            WHERE id_usuario_destino=@UserId AND fecha_resolucion IS NULL
              AND (@IncludeRead=1 OR fecha_lectura IS NULL)
            ORDER BY fecha_creacion DESC,id_notificacion DESC
            """, new { UserId = userId, IncludeRead = includeRead, Limit = Math.Clamp(limit, 1, 100) })).ToList();
        var unread = await db.ExecuteScalarAsync<int>("""
            SELECT COUNT(1) FROM dbo.notificacion
            WHERE id_usuario_destino=@UserId AND fecha_lectura IS NULL AND fecha_resolucion IS NULL
            """, new { UserId = userId });
        return new NotificationListDTO { NoLeidas = unread, Registros = rows };
    }

    public async Task<List<NotificationDTO>> HistoryAsync(int userId, int limit, DateTime? date = null)
    {
        await using var db = new SqlConnection(connectionString);
        return (await db.QueryAsync<NotificationDTO>("""
            SELECT TOP(@Limit) id_notificacion IdNotificacion,tipo Tipo,titulo Titulo,mensaje Mensaje,
                   url Url,entidad Entidad,id_entidad IdEntidad,fecha_creacion FechaCreacion,
                   fecha_lectura FechaLectura,fecha_resolucion FechaResolucion
            FROM dbo.notificacion WHERE id_usuario_destino=@UserId
              AND (@Date IS NULL OR CAST((fecha_creacion AT TIME ZONE 'UTC' AT TIME ZONE 'Central America Standard Time') AS DATE)=CAST(@Date AS DATE))
            ORDER BY fecha_creacion DESC,id_notificacion DESC
            """, new { UserId = userId, Limit = Math.Clamp(limit, 1, 500), Date = date?.Date })).ToList();
    }

    public async Task MarkReadAsync(int userId, long notificationId)
    {
        await using var db = new SqlConnection(connectionString);
        await db.ExecuteAsync("""
            UPDATE dbo.notificacion SET fecha_lectura=COALESCE(fecha_lectura,SYSUTCDATETIME())
            WHERE id_notificacion=@NotificationId AND id_usuario_destino=@UserId
            """, new { UserId = userId, NotificationId = notificationId });
    }

    public async Task MarkAllReadAsync(int userId)
    {
        await using var db = new SqlConnection(connectionString);
        await db.ExecuteAsync("""
            UPDATE dbo.notificacion SET fecha_lectura=SYSUTCDATETIME()
            WHERE id_usuario_destino=@UserId AND fecha_lectura IS NULL AND fecha_resolucion IS NULL
            """, new { UserId = userId });
    }

    public async Task CreateForUserAsync(int destinationId, int? actorId, string type, string title, string message, string? url = null, string? entity = null, int? entityId = null)
    {
        type = type.Length > 40 ? type[..40] : type;
        title = title.Length > 150 ? title[..150] : title;
        message = message.Length > 600 ? message[..600] : message;
        await using var db = new SqlConnection(connectionString);
        await db.ExecuteAsync("""
            INSERT dbo.notificacion(id_usuario_destino,id_usuario_origen,tipo,titulo,mensaje,url,entidad,id_entidad)
            VALUES(@DestinationId,@ActorId,@Type,@Title,@Message,@Url,@Entity,@EntityId)
            """, new { DestinationId = destinationId, ActorId = actorId, Type = type, Title = title, Message = message, Url = url, Entity = entity, EntityId = entityId });
    }

    public async Task RequestCreditAsync(int requesterId, int clientId)
    {
        await using var db = new SqlConnection(connectionString);
        await db.OpenAsync();
        await using var tx = (SqlTransaction)await db.BeginTransactionAsync();
        var client = await db.QueryFirstOrDefaultAsync<ClientRow>("""
            SELECT nombre Nombre,ISNULL(nit,'CF') Nit FROM dbo.cliente WHERE id_cliente=@ClientId
            """, new { ClientId = clientId }, tx);
        if (client is null || string.IsNullOrWhiteSpace(client.Nombre)) throw new InvalidOperationException("El cliente seleccionado no existe.");
        var url = $"/cobros/autorizar?idCliente={clientId}&cliente={Uri.EscapeDataString(client.Nombre)}";
        var inserted = await db.ExecuteAsync("""
            INSERT dbo.notificacion(id_usuario_destino,id_usuario_origen,tipo,titulo,mensaje,url,entidad,id_entidad)
            SELECT u.id_usuario,@RequesterId,'solicitud_credito','Solicitud de crédito',
                   CONCAT(@ClientName,' (NIT ',@Nit,') solicita autorización de crédito.'),
                   @Url,'cliente',@ClientId
            FROM dbo.usuario u
            WHERE u.activo=1 AND LOWER(LTRIM(RTRIM(u.rol))) IN ('administrador','admin','demo','superusuario')
              AND NOT EXISTS(SELECT 1 FROM dbo.notificacion n
                  WHERE n.id_usuario_destino=u.id_usuario AND n.tipo='solicitud_credito'
                    AND n.entidad='cliente' AND n.id_entidad=@ClientId AND n.fecha_resolucion IS NULL)
            """, new { RequesterId = requesterId, ClientId = clientId, ClientName = client.Nombre, client.Nit, Url = url }, tx);
        await tx.CommitAsync();
        if (inserted == 0) throw new InvalidOperationException("La solicitud ya está pendiente de revisión por administración.");
    }

    public async Task ResolveCreditRequestAsync(int clientId, int resolverId, bool authorized)
    {
        await using var db = new SqlConnection(connectionString);
        await db.OpenAsync();
        await using var tx = (SqlTransaction)await db.BeginTransactionAsync();
        var requesters = (await db.QueryAsync<int>("""
            SELECT DISTINCT id_usuario_origen FROM dbo.notificacion
            WHERE tipo='solicitud_credito' AND entidad='cliente' AND id_entidad=@ClientId
              AND fecha_resolucion IS NULL AND id_usuario_origen IS NOT NULL
            """, new { ClientId = clientId }, tx)).ToList();
        var clientName = await db.QueryFirstOrDefaultAsync<string>(
            "SELECT nombre FROM dbo.cliente WHERE id_cliente=@ClientId", new { ClientId = clientId }, tx) ?? "El cliente";
        await db.ExecuteAsync("""
            UPDATE dbo.notificacion SET fecha_resolucion=SYSUTCDATETIME(),id_usuario_resolvio=@ResolverId
            WHERE tipo='solicitud_credito' AND entidad='cliente' AND id_entidad=@ClientId AND fecha_resolucion IS NULL
            """, new { ClientId = clientId, ResolverId = resolverId }, tx);
        foreach (var requester in requesters.Where(id => id != resolverId))
        {
            await db.ExecuteAsync("""
                INSERT dbo.notificacion(id_usuario_destino,id_usuario_origen,tipo,titulo,mensaje,url,entidad,id_entidad)
                VALUES(@RequesterId,@ResolverId,'resultado_credito',@Title,@Message,
                       '/clientes/listado','cliente',@ClientId)
                """, new {
                    RequesterId = requester, ResolverId = resolverId, ClientId = clientId,
                    Title = authorized ? "Crédito autorizado" : "Crédito denegado",
                    Message = $"La solicitud de crédito de {clientName} fue {(authorized ? "autorizada" : "denegada")}."
                }, tx);
        }
        await tx.CommitAsync();
    }

    public async Task<int> RequestPriceChangeAsync(int requesterId, int productId, decimal requestedPrice)
    {
        await using var db = new SqlConnection(connectionString);
        await db.OpenAsync();
        await using var tx = (SqlTransaction)await db.BeginTransactionAsync();
        var product = await db.QueryFirstOrDefaultAsync<PriceProductRow>("""
            SELECT p.nombre Nombre,p.precio Precio,
              COALESCE((SELECT TOP(1) dc.costo_unitario FROM dbo.detalle_compra dc INNER JOIN dbo.compra c ON c.id_compra=dc.id_compra WHERE dc.id_producto=p.id_producto ORDER BY c.fecha DESC,dc.id_detalle_compra DESC),p.costo) Costo
            FROM dbo.producto p WHERE p.id_producto=@ProductId
            """, new { ProductId = productId }, tx);
        if (product is null || string.IsNullOrWhiteSpace(product.Nombre)) throw new InvalidOperationException("El producto no existe.");
        if (requestedPrice <= 0) throw new InvalidOperationException("El precio de venta debe ser mayor que cero.");
        if (product.Costo.HasValue && requestedPrice <= product.Costo.Value) throw new InvalidOperationException("El precio de venta debe ser mayor que el último costo de compra.");
        if (await db.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM dbo.solicitud_cambio_precio WHERE id_producto=@ProductId AND estado='Pendiente'", new { ProductId = productId }, tx) > 0)
            throw new InvalidOperationException("Este producto ya tiene una solicitud de precio pendiente.");
        var requestId = await db.QuerySingleAsync<int>("""
            INSERT dbo.solicitud_cambio_precio(id_producto,precio_actual,precio_solicitado,id_usuario_solicita)
            OUTPUT INSERTED.id_solicitud VALUES(@ProductId,@CurrentPrice,@RequestedPrice,@RequesterId)
            """, new { ProductId = productId, CurrentPrice = product.Precio, RequestedPrice = requestedPrice, RequesterId = requesterId }, tx);
        var url = $"/inventarios/productos?producto={productId}&solicitudPrecio={requestId}";
        await db.ExecuteAsync("""
            INSERT dbo.notificacion(id_usuario_destino,id_usuario_origen,tipo,titulo,mensaje,url,entidad,id_entidad)
            SELECT u.id_usuario,@RequesterId,'solicitud_precio','Solicitud de cambio de precio',
              CONCAT(@ProductName,': de Q ',CONVERT(VARCHAR(30),@CurrentPrice),' a Q ',CONVERT(VARCHAR(30),@RequestedPrice)),
              @Url,'solicitud_precio',@RequestId
            FROM dbo.usuario u WHERE u.activo=1 AND LOWER(LTRIM(RTRIM(u.rol))) IN ('administrador','admin','demo','superusuario')
            """, new { RequesterId = requesterId, ProductName = product.Nombre, CurrentPrice = product.Precio, RequestedPrice = requestedPrice, Url = url, RequestId = requestId }, tx);
        await tx.CommitAsync();
        return requestId;
    }

    public async Task ResolvePriceChangeAsync(int requestId, int resolverId, bool approved)
    {
        await using var db = new SqlConnection(connectionString);
        await db.OpenAsync();
        await using var tx = (SqlTransaction)await db.BeginTransactionAsync();
        var request = await db.QueryFirstOrDefaultAsync<PriceRequestRow>("""
            SELECT s.id_producto IdProducto,s.precio_solicitado PrecioSolicitado,s.id_usuario_solicita IdUsuarioSolicita,p.nombre Producto,
              COALESCE((SELECT TOP(1) dc.costo_unitario FROM dbo.detalle_compra dc INNER JOIN dbo.compra c ON c.id_compra=dc.id_compra WHERE dc.id_producto=s.id_producto ORDER BY c.fecha DESC,dc.id_detalle_compra DESC),p.costo) Costo
            FROM dbo.solicitud_cambio_precio s INNER JOIN dbo.producto p ON p.id_producto=s.id_producto
            WHERE s.id_solicitud=@RequestId AND s.estado='Pendiente'
            """, new { RequestId = requestId }, tx);
        if (request is null || request.IdProducto <= 0) throw new InvalidOperationException("La solicitud ya fue resuelta o no existe.");
        if (approved && request.Costo.HasValue && request.PrecioSolicitado <= request.Costo.Value) throw new InvalidOperationException("El precio solicitado ya no supera el último costo de compra.");
        if (approved) await db.ExecuteAsync("UPDATE dbo.producto SET precio=@Price WHERE id_producto=@ProductId", new { Price = request.PrecioSolicitado, ProductId = request.IdProducto }, tx);
        await db.ExecuteAsync("""
            UPDATE dbo.solicitud_cambio_precio SET estado=@Status,id_usuario_resuelve=@ResolverId,fecha_resolucion=SYSUTCDATETIME() WHERE id_solicitud=@RequestId;
            UPDATE dbo.notificacion SET fecha_resolucion=SYSUTCDATETIME(),id_usuario_resolvio=@ResolverId WHERE entidad='solicitud_precio' AND id_entidad=@RequestId AND fecha_resolucion IS NULL;
            """, new { Status = approved ? "Aprobada" : "Rechazada", ResolverId = resolverId, RequestId = requestId }, tx);
        await db.ExecuteAsync("""
            INSERT dbo.notificacion(id_usuario_destino,id_usuario_origen,tipo,titulo,mensaje,url,entidad,id_entidad)
            VALUES(@RequesterId,@ResolverId,'resultado_precio',@Title,@Message,@Url,'producto',@ProductId)
            """, new { RequesterId = request.IdUsuarioSolicita, ResolverId = resolverId, Title = approved ? "Cambio de precio aprobado" : "Cambio de precio rechazado", Message = $"La solicitud para {request.Producto} fue {(approved ? "aprobada" : "rechazada")}.", Url = $"/inventarios/productos?producto={request.IdProducto}", ProductId = request.IdProducto }, tx);
        await tx.CommitAsync();
    }
}
