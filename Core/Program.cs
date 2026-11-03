using Core.DTOs.Interfaces;
using Core.Provider;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Core.Services;
using Core.Middleware;
using Core.Configuration;
using Core.Integrations.Digifact;
using Core.Hubs;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
EnvFileLoader.Load(Path.Combine(builder.Environment.ContentRootPath, ".env"));
builder.Configuration.AddEnvironmentVariables();
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;
// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 8, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 180, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddSignalR();
builder.Services.AddSingleton<ISaleScannerSessionService, SaleScannerSessionService>();
builder.Services.AddScoped<IAuthProviderDTO, AuthProvider>();
builder.Services.AddScoped<ICatalogoProviderDTO, CatalogoProvider>();
builder.Services.AddScoped<IVentaProviderDTO, VentaProvider>();
builder.Services.AddScoped<IInventarioProviderDTO, InventarioProvider>();
builder.Services.AddScoped<IFacturacionProviderDTO, FacturacionProvider>();
builder.Services.AddScoped<IOperacionProviderDTO, OperacionProvider>();
builder.Services.AddScoped<ITrabajadorProviderDTO, TrabajadorProvider>();
builder.Services.AddScoped<IPasswordResetEmailService, PasswordResetEmailService>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddSingleton<InvoiceCertificationQueue>();
builder.Services.AddSingleton<InvoicePdfCache>();
builder.Services.AddHostedService<InvoiceCertificationWorker>();
builder.Services.AddScoped<IDatosMaestrosProviderDTO, DatosMaestrosProvider>();
builder.Services.AddScoped<ICobroProviderDTO, CobroProvider>();
builder.Services.AddScoped<IBitacoraProviderDTO, BitacoraProvider>();
builder.Services.Configure<DigifactOptions>(builder.Configuration.GetSection(DigifactOptions.SectionName));
builder.Services.AddSingleton<IDigifactNucFactory, DigifactNucFactory>();
builder.Services.AddHttpClient<IDigifactClient, DigifactClient>((services, client) =>
{
    var options = services.GetRequiredService<Microsoft.Extensions.Options.IOptions<DigifactOptions>>().Value;
    client.BaseAddress = new Uri(options.BaseUrl.EndsWith('/') ? options.BaseUrl : options.BaseUrl + "/");
    client.Timeout = TimeSpan.FromSeconds(120);
});

var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var jwtSecret = jwtSettings["Secret"]
    ?? throw new InvalidOperationException("JwtSettings:Secret no está configurado.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtSettings["Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

var frontendBaseUrl = builder.Configuration["FrontendBaseUrl"]?.TrimEnd('/')
    ?? "http://localhost:5173";

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins(frontendBaseUrl)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});



var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseForwardedHeaders();
app.UseHttpsRedirection();

app.UseCors("AllowReactApp");
app.UseRateLimiter();

app.UseAuthentication();
app.UseMiddleware<ModuleAccessMiddleware>();
app.UseMiddleware<BitacoraMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHub<SaleScannerHub>("/hubs/sale-scanner");

app.Run();
