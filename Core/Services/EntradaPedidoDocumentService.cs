using Core.DTOs;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Core.Services;

public static class EntradaPedidoDocumentService
{
    private const string Accent = "#008BA8";
    private const string Navy = "#183B56";

    public static byte[] GeneratePdf(IReadOnlyCollection<EntradaPedidoProductoDTO> rows)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var head = rows.First();
        var logo = LoadLogo();
        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4); page.Margin(26);
            page.DefaultTextStyle(style => style.FontSize(10).FontColor(Colors.Grey.Darken3));
            page.Content().Border(1.5f).BorderColor(Navy).Padding(22).Column(column =>
            {
                column.Spacing(16);
                column.Item().Row(row =>
                {
                    row.ConstantItem(105).Height(58).Element(box => { if (logo is not null) box.Image(logo).FitArea(); else box.Text("AZE-SHER'S").Bold().FontColor(Accent); });
                    row.RelativeItem().PaddingLeft(18).Column(title => { title.Item().Text("ENTRADA DE PRODUCTOS").Bold().FontSize(21).FontColor(Navy); title.Item().Text("Recepción de inventario").FontSize(9).FontColor(Colors.Grey.Darken1); });
                    row.ConstantItem(150).AlignRight().Column(number => { number.Item().Text("DOCUMENTO").FontSize(8).FontColor(Colors.Grey.Darken1); number.Item().Text(head.NumeroPedido).Bold().FontSize(13).FontColor(Accent); });
                });
                column.Item().Height(4).Background(Accent);
                column.Item().Border(1).BorderColor(Colors.Grey.Lighten2).Background("#F8FAFC").Padding(12).Row(row =>
                {
                    Info(row.RelativeItem(), "SUCURSAL", head.SucursalNombre);
                    Info(row.RelativeItem(), "PROVEEDOR", head.ProveedorNombre);
                    Info(row.RelativeItem().AlignRight(), "FECHA", $"{head.Fecha:dd/MM/yyyy HH:mm}");
                });
                column.Item().Row(row => { row.RelativeItem().Text(text => { text.Span("Forma de pago: ").Bold(); text.Span(head.MetodoPago); }); row.ConstantItem(150).AlignRight().Text(text => { text.Span("Unidades: ").Bold(); text.Span(rows.Sum(item => item.Cantidad).ToString()); }); });
                if (!string.IsNullOrWhiteSpace(head.Observaciones)) column.Item().BorderLeft(3).BorderColor(Accent).Background("#F0F9FB").Padding(10).Text(text => { text.Span("Observaciones: ").Bold(); text.Span(head.Observaciones); });
                column.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns => { columns.ConstantColumn(70); columns.RelativeColumn(); columns.ConstantColumn(52); columns.ConstantColumn(68); columns.ConstantColumn(68); columns.ConstantColumn(76); });
                    table.Header(header => { foreach (var title in new[] { "Código", "Producto", "Cantidad", "Costo compra", "Precio venta", "Subtotal" }) header.Cell().Background(Navy).Border(0.5f).BorderColor(Colors.White).Padding(6).Text(title).Bold().FontSize(8).FontColor(Colors.White); });
                    foreach (var item in rows) { Cell(table).Text(item.Codigo ?? item.IdProducto.ToString()); Cell(table).Text(item.ProductoNombre); Cell(table).AlignRight().Text(item.Cantidad.ToString()); Cell(table).AlignRight().Text($"Q {item.CostoUnitario:0.00}"); Cell(table).AlignRight().Text($"Q {item.PrecioVenta:0.00}"); Cell(table).AlignRight().Text($"Q {item.Subtotal:0.00}").Bold(); }
                });
                column.Item().BorderTop(1).BorderColor(Navy).PaddingTop(10).AlignRight().Text($"TOTAL Q {head.Total:0.00}").Bold().FontSize(16);
                column.Item().PaddingTop(36).Row(row => { Signature(row.RelativeItem(), "Entrega proveedor"); row.ConstantItem(42); Signature(row.RelativeItem(), "Recibe"); });
            });
            page.Footer().PaddingTop(7).Row(row => { row.RelativeItem().Text("Documento interno de entrada de inventario").FontSize(8).FontColor(Colors.Grey.Darken1); row.RelativeItem().AlignRight().Text(text => { text.Span("Página "); text.CurrentPageNumber(); text.Span(" de "); text.TotalPages(); }); });
        })).GeneratePdf();
    }

    private static IContainer Cell(TableDescriptor table) => table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8);
    private static void Info(IContainer container, string label, string value) => container.Column(info => { info.Item().Text(label).Bold().FontSize(8).FontColor(Accent); info.Item().Text(value).Bold().FontSize(11); });
    private static void Signature(IContainer container, string label) => container.AlignCenter().BorderTop(1).BorderColor(Navy).PaddingTop(6).Text(label).Bold();
    private static byte[]? LoadLogo() { var path = Path.Combine(AppContext.BaseDirectory, "Assets", "logo.png"); return File.Exists(path) ? File.ReadAllBytes(path) : null; }
}
