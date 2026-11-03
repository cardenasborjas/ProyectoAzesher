using Core.DTOs.Interfaces;
using Core.Models;
using Microsoft.AspNetCore.Mvc;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Core.DTOs;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Core.Services;
using Core.Integrations.Digifact;

namespace Core.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class VentasController(IVentaProviderDTO ventaProvider, IDigifactClient digifact) : ControllerBase
    {
        private readonly IVentaProviderDTO _ventaProvider = ventaProvider;
        private readonly IDigifactClient _digifact = digifact;

        private class ReciboPdfData
        {
            public string NumeroRecibo { get; set; } = string.Empty;
            public DateTime? FechaPago { get; set; }
            public string NumeroFactura { get; set; } = string.Empty;
            public DateTime? FechaVenta { get; set; }
            public string ClienteNombre { get; set; } = string.Empty;
            public string ClienteNit { get; set; } = "CF";
            public string? ClienteDomicilio { get; set; }
            public string? ClienteTelefono { get; set; }
            public string VendedorNombre { get; set; } = string.Empty;
            public string? SucursalNombre { get; set; }
            public string MetodoPago { get; set; } = string.Empty;
            public string? ReferenciaPago { get; set; }
            public string EstadoRecibo { get; set; } = string.Empty;
            public string? Moneda { get; set; }
            public string? TipoPos { get; set; }
            public DateTime? FechaTransferencia { get; set; }
            public decimal? SaldoPendiente { get; set; }
            public decimal? MontoInicial { get; set; }
            public int? NumeroCuotas { get; set; }
            public DateTime? PrimeraCuotaFecha { get; set; }
            public decimal? PrimeraCuotaMonto { get; set; }
            public decimal Total { get; set; }
            public List<ReciboPdfDetalleData> Detalles { get; set; } = new();
        }

        private class ReciboPdfDetalleData
        {
            public string ProductoNombre { get; set; } = string.Empty;
            public int Cantidad { get; set; }
            public decimal PrecioUnitario { get; set; }
            public decimal Subtotal { get; set; }
        }

        [HttpGet("recibos/{idRecibo:int}")]
        public async Task<IActionResult> ObtenerRecibo(int idRecibo)
        {
            try
            {
                var recibo = await _ventaProvider.ObtenerReciboVentaAsync(idRecibo);
                if (recibo is null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = $"No se encontro recibo con id {idRecibo}."
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Recibo obtenido correctamente.",
                    Data = recibo
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No fue posible obtener el recibo.",
                    Errors = ex.Message
                });
            }
        }

        [HttpGet("recibos/{idRecibo:int}/pdf")]
        public async Task<IActionResult> ObtenerReciboPdf(int idRecibo)
        {
            try
            {
                var recibo = await _ventaProvider.ObtenerReciboVentaAsync(idRecibo);
                if (recibo is null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = $"No se encontro recibo con id {idRecibo}."
                    });
                }

                var pdfData = new ReciboPdfData
                {
                    NumeroRecibo = recibo.NumeroRecibo,
                    FechaPago = recibo.FechaPago,
                    NumeroFactura = recibo.NumeroFactura,
                    FechaVenta = recibo.FechaVenta,
                    ClienteNombre = recibo.ClienteNombre,
                    ClienteNit = recibo.ClienteNit ?? "CF",
                    ClienteDomicilio = recibo.ClienteDomicilio,
                    ClienteTelefono = recibo.ClienteTelefono,
                    VendedorNombre = recibo.VendedorNombre,
                    SucursalNombre = recibo.SucursalNombre,
                    MetodoPago = recibo.MetodoPago,
                    ReferenciaPago = recibo.NumeroComprobante,
                    EstadoRecibo = recibo.EstadoRecibo,
                    Moneda = recibo.MonedaNombre,
                    TipoPos = recibo.TipoPosNombre,
                    FechaTransferencia = recibo.FechaTransferencia,
                    SaldoPendiente = recibo.SaldoPendiente,
                    MontoInicial = recibo.MontoInicial,
                    NumeroCuotas = recibo.NumeroCuotas,
                    PrimeraCuotaFecha = recibo.PrimeraCuotaFecha,
                    PrimeraCuotaMonto = recibo.PrimeraCuotaMonto,
                    Total = recibo.Monto,
                    Detalles = recibo.Detalles.Select(x => new ReciboPdfDetalleData
                    {
                        ProductoNombre = x.ProductoNombre,
                        Cantidad = x.Cantidad,
                        PrecioUnitario = x.PrecioUnitario,
                        Subtotal = x.Subtotal
                    }).ToList()
                };

                var pdfBytes = GenerarReciboPdf(pdfData);

                var fileName = $"recibo-{recibo.NumeroRecibo}.pdf";
                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No fue posible generar el PDF del recibo.",
                    Errors = ex.Message
                });
            }
        }

        [Authorize]
        [HttpGet("recibos")]
        public async Task<IActionResult> BuscarRecibos(
            [FromQuery] int? idSucursal,
            [FromQuery] string? query = null,
            [FromQuery] DateTime? fechaDesde = null,
            [FromQuery] DateTime? fechaHasta = null,
            [FromQuery] string tipoDocumento = "recibo",
            [FromQuery] string metodoPago = "")
        {
            var sucursal = ResolverSucursal(idSucursal);
            if (!sucursal.HasValue)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Debes seleccionar una sucursal." });

            var recibos = await _ventaProvider.BuscarRecibosAsync(sucursal.Value, query ?? string.Empty, fechaDesde, fechaHasta, tipoDocumento, metodoPago);
            return Ok(new ApiResponse<IEnumerable<ReciboConsultaDTO>>
            {
                Success = true,
                Message = "Recibos obtenidos correctamente.",
                Data = recibos
            });
        }

        [Authorize]
        [HttpPost("recibos/{idRecibo:int}/anular")]
        public async Task<IActionResult> AnularRecibo(int idRecibo, [FromBody] AnularReciboRequestDTO request)
        {
            try
            {
                var idUsuarioClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(idUsuarioClaim, out var idUsuario)) return Unauthorized();
                var sucursal = ResolverSucursal(request.IdSucursal);
                if (!sucursal.HasValue)
                    return BadRequest(new ApiResponse<object> { Success = false, Message = "Debes seleccionar una sucursal." });

                await _ventaProvider.AnularReciboAsync(idRecibo, sucursal.Value, idUsuario, request.Motivo);
                return Ok(new ApiResponse<object> { Success = true, Message = "Recibo anulado correctamente." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        [Authorize]
        [HttpGet("recibos/{idRecibo:int}/docx")]
        public async Task<IActionResult> ObtenerReciboDocx(int idRecibo)
        {
            var recibo = await _ventaProvider.ObtenerReciboVentaAsync(idRecibo);
            if (recibo is null) return NotFound();
            var bytes = VentaDocumentExportService.GenerateDocx(recibo);
            return File(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", $"{recibo.NumeroRecibo}.docx");
        }

        [Authorize]
        [HttpGet("recibos/{idRecibo:int}/excel")]
        public async Task<IActionResult> ObtenerDetalleExcel(int idRecibo)
        {
            var recibo = await _ventaProvider.ObtenerReciboVentaAsync(idRecibo);
            if (recibo is null) return NotFound();
            var bytes = VentaDocumentExportService.GenerateXlsx(recibo);
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"detalle-{recibo.NumeroRecibo}.xlsx");
        }

        [HttpPost("recibos/pdf-temporal")]
        public IActionResult GenerarReciboPdfTemporal([FromBody] ReciboTemporalRequestDTO request)
        {
            try
            {
                if (request.Detalles is null || request.Detalles.Count == 0)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "El recibo debe incluir al menos un detalle."
                    });
                }

                if (string.IsNullOrWhiteSpace(request.ClienteNombre))
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "El nombre del cliente es obligatorio."
                    });
                }

                if (!request.IdVendedor.HasValue || request.IdVendedor.Value <= 0)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Debes seleccionar un vendedor."
                    });
                }

                var pdfData = new ReciboPdfData
                {
                    NumeroRecibo = request.NumeroRecibo,
                    FechaPago = request.FechaPago ?? DateTime.Now,
                    NumeroFactura = string.IsNullOrWhiteSpace(request.NumeroFactura) ? "PENDIENTE" : request.NumeroFactura,
                    FechaVenta = request.FechaVenta ?? DateTime.Now,
                    ClienteNombre = request.ClienteNombre,
                    ClienteNit = string.IsNullOrWhiteSpace(request.ClienteNit) ? "CF" : request.ClienteNit,
                    ClienteDomicilio = request.ClienteDomicilio,
                    ClienteTelefono = request.ClienteTelefono,
                    VendedorNombre = request.VendedorNombre,
                    SucursalNombre = request.SucursalNombre,
                    MetodoPago = request.MetodoPago,
                    ReferenciaPago = request.ReferenciaPago,
                    EstadoRecibo = "Pendiente",
                    Moneda = request.MonedaNombre,
                    TipoPos = request.TipoPosNombre,
                    FechaTransferencia = request.FechaTransferencia,
                    SaldoPendiente = request.MetodoPago == "credito" ? request.Total - request.MontoInicial : null,
                    MontoInicial = request.MetodoPago == "credito" ? request.MontoInicial : null,
                    NumeroCuotas = request.NumeroCuotas,
                    PrimeraCuotaFecha = request.Cuotas.OrderBy(x => x.NumeroCuota).FirstOrDefault()?.FechaVencimiento,
                    PrimeraCuotaMonto = request.Cuotas.OrderBy(x => x.NumeroCuota).FirstOrDefault()?.Monto,
                    Total = request.Total,
                    Detalles = request.Detalles.Select(x => new ReciboPdfDetalleData
                    {
                        ProductoNombre = x.ProductoNombre,
                        Cantidad = x.Cantidad,
                        PrecioUnitario = x.PrecioUnitario,
                        Subtotal = x.Subtotal
                    }).ToList()
                };

                var pdfBytes = GenerarReciboPdf(pdfData);
                var fileName = $"recibo-{pdfData.NumeroRecibo}.pdf";

                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No fue posible generar el PDF temporal del recibo.",
                    Errors = ex.Message
                });
            }
        }

        [Authorize]
        [HttpPost("recibos")]
        public async Task<IActionResult> GuardarRecibo([FromBody] ReciboTemporalRequestDTO request)
        {
            try
            {
                if (request.Detalles is null || request.Detalles.Count == 0)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "El recibo debe incluir al menos un detalle."
                    });
                }

                if (string.IsNullOrWhiteSpace(request.ClienteNombre))
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "El nombre del cliente es obligatorio."
                    });
                }

                var nitValidation = await _digifact.ValidateNitAsync(request.ClienteNit, HttpContext.RequestAborted);
                if (!nitValidation.IsValid)
                    return BadRequest(new ApiResponse<object> { Success = false, Message = nitValidation.Message });
                request.ClienteNit = nitValidation.Nit;
                if (!nitValidation.IsConsumerFinal) request.ClienteNombre = nitValidation.Name;

                var idUsuarioClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(idUsuarioClaim, out var idUsuario))
                {
                    return Unauthorized(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "No fue posible identificar al usuario autenticado."
                    });
                }

                var idSucursalClaim = User.FindFirst("id_sucursal")?.Value;
                var idSucursal = request.IdSucursal;
                if (int.TryParse(idSucursalClaim, out var idSucursalAutenticada) && idSucursalAutenticada > 0)
                {
                    idSucursal = idSucursalAutenticada;
                }

                if (!idSucursal.HasValue || idSucursal.Value <= 0)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Debes seleccionar una sucursal para la venta."
                    });
                }

                var idRecibo = await _ventaProvider.GuardarReciboAsync(request, idUsuario, idSucursal.Value);
                var recibo = await _ventaProvider.ObtenerReciboVentaAsync(idRecibo);

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Recibo guardado correctamente.",
                    Data = recibo
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (DigifactException ex)
            {
                return StatusCode(ex.StatusCode is >= 400 and < 600 ? ex.StatusCode.Value : 502,
                    new ApiResponse<object> { Success = false, Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "No fue posible guardar el recibo.",
                    Errors = ex.Message
                });
            }
        }

        private static byte[] GenerarReciboPdf(ReciboPdfData data)
        {
            QuestPDF.Settings.License = LicenseType.Community;
            var logoBytes = LoadLogoBytes();
            var isCredit = data.MetodoPago.Equals("credito", StringComparison.OrdinalIgnoreCase);
            var headerColor = isCredit ? "#475569" : "#0f766e";
            var accentColor = isCredit ? "#334155" : "#0f766e";

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(24);
                    page.DefaultTextStyle(x => x.FontSize(10).FontColor(Colors.Grey.Darken3));
                    page.PageColor(Colors.White);

                    page.Header().PaddingBottom(12).Column(col =>
                    {
                        col.Item().Background(headerColor).Padding(18).Row(row =>
                        {
                            row.ConstantItem(88).Height(60).AlignMiddle().AlignCenter().Element(container =>
                            {
                                if (logoBytes is not null)
                                {
                                    container.Image(logoBytes).FitArea();
                                }
                                else
                                {
                                    container.AlignCenter().Text("AZE-SHER'S").Bold().FontColor(Colors.White);
                                }
                            });

                            row.RelativeItem().Column(headerColumn =>
                            {
                                headerColumn.Item().Text(isCredit ? "NOTA DE CRÉDITO" : "RECIBO DE PAGO").Bold().FontSize(22).FontColor(Colors.White);
                                headerColumn.Item().Text("Revisa si el recibo esta correcto antes de autorizarlo.").FontSize(10).FontColor(Colors.White);
                            });

                            row.ConstantItem(170).AlignMiddle().AlignRight().Column(numberColumn =>
                            {
                                numberColumn.Item().Text(isCredit ? "Nota No." : "Recibo No.").FontSize(10).FontColor("#e2e8f0");
                                numberColumn.Item().Text(string.IsNullOrWhiteSpace(data.NumeroRecibo) ? "PENDIENTE DE GUARDAR" : data.NumeroRecibo).Bold().FontSize(18).FontColor(isCredit ? "#f8fafc" : "#60a5fa");
                                numberColumn.Item().Text($"Fecha pago: {data.FechaPago:dd/MM/yyyy HH:mm}").FontSize(9).FontColor(Colors.White);
                            });
                        });
                        if (data.EstadoRecibo == "Anulado")
                            col.Item().Background(Colors.Red.Darken2).Padding(8).AlignCenter().Text("DOCUMENTO ANULADO").Bold().FontColor(Colors.White);
                    });

                    page.Content().Border(1).BorderColor(Colors.Grey.Darken1).Padding(14).Column(col =>
                    {
                        col.Spacing(12);

                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Background(Colors.Grey.Lighten4).Padding(14).Column(info =>
                            {
                                info.Item().Text("Cliente").Bold().FontColor(accentColor);
                                info.Item().Text($"{data.ClienteNombre}");
                                info.Item().Text($"NIT: {data.ClienteNit}");
                                if (!string.IsNullOrWhiteSpace(data.ClienteDomicilio))
                                {
                                    info.Item().Text($"Dirección: {data.ClienteDomicilio}");
                                }
                                if (!string.IsNullOrWhiteSpace(data.ClienteTelefono))
                                {
                                    info.Item().Text($"Teléfono: {data.ClienteTelefono}");
                                }
                            });

                            row.ConstantItem(18);

                            row.RelativeItem().Background("#f8fafc").Padding(14).Column(info =>
                            {
                                info.Item().Text("Datos de venta").Bold().FontColor(accentColor);
                                info.Item().Text($"Factura: {data.NumeroFactura}");
                                info.Item().Text($"Sucursal: {data.SucursalNombre ?? "Sin sucursal"}");
                                info.Item().Text($"Vendedor: {data.VendedorNombre}");
                                info.Item().Text($"Pago: {data.MetodoPago}");
                                if (!string.IsNullOrWhiteSpace(data.ReferenciaPago))
                                {
                                    info.Item().Text($"Referencia: {data.ReferenciaPago}");
                                }
                                if (!string.IsNullOrWhiteSpace(data.TipoPos)) info.Item().Text($"POS: {data.TipoPos}");
                                if (data.FechaTransferencia.HasValue) info.Item().Text($"Fecha transferencia: {data.FechaTransferencia:dd/MM/yyyy}");
                                if (!string.IsNullOrWhiteSpace(data.Moneda)) info.Item().Text($"Moneda: {data.Moneda}");
                                if (data.SaldoPendiente.HasValue)
                                {
                                    info.Item().Text($"Monto pendiente: Q {data.SaldoPendiente:0.00}");
                                    info.Item().Text($"Pago inicial: Q {data.MontoInicial ?? 0:0.00}");
                                    info.Item().Text($"Cuotas: {data.NumeroCuotas}");
                                    if (data.PrimeraCuotaFecha.HasValue)
                                        info.Item().Text($"Primera cuota: Q {data.PrimeraCuotaMonto:0.00} - {data.PrimeraCuotaFecha:dd/MM/yyyy}");
                                }
                            });
                        });

                        col.Item().Background(Colors.White).Border(1).BorderColor(Colors.Grey.Lighten2).Padding(12).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(4);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(2);
                                columns.RelativeColumn(2);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Grey.Lighten4).Padding(6).Text("Producto").Bold();
                                header.Cell().Background(Colors.Grey.Lighten4).Padding(6).Text("Cant.").Bold();
                                header.Cell().Background(Colors.Grey.Lighten4).Padding(6).AlignRight().Text("P. Unit").Bold();
                                header.Cell().Background(Colors.Grey.Lighten4).Padding(6).AlignRight().Text("Subtotal").Bold();
                            });

                            foreach (var item in data.Detalles)
                            {
                                table.Cell().Padding(6).Text(item.ProductoNombre);
                                table.Cell().Padding(6).Text(item.Cantidad.ToString());
                                table.Cell().Padding(6).AlignRight().Text($"Q {item.PrecioUnitario:0.00}");
                                table.Cell().Padding(6).AlignRight().Text($"Q {item.Subtotal:0.00}");
                            }
                        });

                        if (isCredit)
                        {
                            col.Item().AlignRight().Background(Colors.Grey.Lighten4).Border(1).BorderColor(Colors.Grey.Lighten2).Padding(14).Column(total =>
                            {
                                total.Item().AlignRight().Text($"Monto recibido: Q {data.MontoInicial ?? 0:0.00}").Bold().FontSize(14).FontColor(accentColor);
                                total.Item().AlignRight().Text($"Restante: Q {data.SaldoPendiente ?? data.Total:0.00}").Bold().FontSize(13).FontColor(Colors.Grey.Darken2);
                            });
                        }
                        else
                        {
                            col.Item().AlignRight().Background("#f0fdfa").Border(1).BorderColor("#99f6e4").Padding(14).Text($"Monto pagado: Q {data.Total:0.00}").Bold().FontSize(14).FontColor(accentColor);
                        }
                    });

                    page.Footer().PaddingTop(8).AlignCenter().Text("Documento generado por Sistema de Ventas").Italic().FontSize(9).FontColor(Colors.Grey.Darken1);
                });
            }).GeneratePdf();
        }

        private static byte[]? LoadLogoBytes()
        {
            var candidatePaths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "Assets", "logo.png"),
                Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "frontend", "src", "assets", "logo.png")),
                Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "frontend", "src", "assets", "logo.png")),
                Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "frontend", "src", "assets", "logo.png")),
            };

            foreach (var candidatePath in candidatePaths)
            {
                if (System.IO.File.Exists(candidatePath))
                {
                    return System.IO.File.ReadAllBytes(candidatePath);
                }
            }

            return null;
        }

        private int? ResolverSucursal(int? sucursalSolicitada)
        {
            var claim = User.FindFirst("id_sucursal")?.Value;
            return int.TryParse(claim, out var sucursalUsuario) && sucursalUsuario > 0
                ? sucursalUsuario
                : sucursalSolicitada is > 0 ? sucursalSolicitada : null;
        }
    }
}
