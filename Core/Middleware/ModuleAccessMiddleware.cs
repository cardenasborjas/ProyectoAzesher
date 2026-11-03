using System.Security.Claims;

namespace Core.Middleware;

public sealed class ModuleAccessMiddleware(RequestDelegate next)
{
    private static readonly Dictionary<string, string[]> Rules = new(StringComparer.OrdinalIgnoreCase)
    {
        ["/api/inventario"] = ["inventarios"],
        ["/api/ventas"] = ["ventas"],
        ["/api/facturacion"] = ["ventas"],
        ["/api/cobros"] = ["cobros"],
        ["/api/trabajadores"] = ["trabajadores", "configuracion"],
        ["/api/datos-maestros"] = ["configuracion"],
        ["/api/bitacora"] = ["bitacora"],
        ["/api/catalogo"] = ["ventas", "inventarios", "clientes", "cobros"],
        ["/api/operaciones/caja"] = ["caja"],
        ["/api/operaciones/clientes"] = ["clientes"],
        ["/api/operaciones/reportes"] = ["reportes"]
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
                if (!rule.Value.Any(module => permissions.Contains(module, StringComparer.OrdinalIgnoreCase)))
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
