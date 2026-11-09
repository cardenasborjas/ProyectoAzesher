using System.Security.Claims;

namespace Core.Middleware;

public sealed class ModuleAccessMiddleware(RequestDelegate next)
{
    private static readonly Dictionary<string, string[]> Rules = new(StringComparer.OrdinalIgnoreCase)
    {
        ["/api/inventario/entrada"] = ["inventarios.entradas"],
        ["/api/inventario/entradas"] = ["inventarios.entradas"],
        ["/api/inventario/proveedores"] = ["inventarios.proveedores"],
        ["/api/inventario/traslados"] = ["inventarios.traslados"],
        ["/api/inventario/salidas"] = ["inventarios.salidas"],
        ["/api/inventario/productos"] = ["inventarios.productos"],
        ["/api/inventario"] = ["inventarios"],
        ["/api/ventas/recibos"] = ["ventas.recibos"],
        ["/api/ventas"] = ["ventas.venta"],
        ["/api/facturacion"] = ["ventas.facturas"],
        ["/api/cobros"] = ["cobros"],
        ["/api/trabajadores"] = ["trabajadores", "configuracion"],
        ["/api/datos-maestros"] = ["configuracion.datos"],
        ["/api/bitacora"] = ["bitacora"],
        ["/api/catalogo"] = ["ventas", "inventarios", "clientes", "cobros"],
        ["/api/operaciones/caja"] = ["caja.apertura"],
        ["/api/operaciones/clientes"] = ["clientes.listado"],
        ["/api/operaciones/reportes/utilidad"] = ["reportes.ganancias"],
        ["/api/operaciones/reportes"] = ["reportes.consolidado"]
    };

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var role = context.User.FindFirstValue(ClaimTypes.Role)?.Trim().ToLowerInvariant() ?? "";
            var admin = role is "administrador" or "admin" or "demo" or "superusuario";
            var rule = Rules.OrderByDescending(item => item.Key.Length).FirstOrDefault(item => context.Request.Path.StartsWithSegments(item.Key));
            if (!admin && rule.Value is not null)
            {
                var permissions = (context.User.FindFirstValue("permisos") ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                static bool HasPermission(IEnumerable<string> permissions, string requested)
                {
                    var parent = requested.Split('.')[0];
                    return permissions.Contains(requested, StringComparer.OrdinalIgnoreCase)
                        || permissions.Contains(parent, StringComparer.OrdinalIgnoreCase)
                        || (!requested.Contains('.') && permissions.Any(permission =>
                            permission.StartsWith(requested + ".", StringComparison.OrdinalIgnoreCase)));
                }
                if (!rule.Value.Any(module => HasPermission(permissions, module)))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new { success = false, message = "No tienes permiso para utilizar este módulo." });
                    return;
                }
            }
        }
        await next(context);
    }
}
