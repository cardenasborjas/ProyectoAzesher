import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileDown, Search, WalletCards, X } from "lucide-react";
import axiosClient from "../api/axiosClient";
import LoadingIndicator from "../components/LoadingIndicator";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
import { formatGuatemalaDateTime, guatemalaInputDate } from "../utils/guatemalaDate";

const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });

export default function HistorialEntradasPage() {
  const { selectedSucursalId, sucursales } = useAuth();
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState({});
  const [paymentEntry, setPaymentEntry] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [notice, setNotice] = useState(null);
  const branch = sucursales.find(item => String(item.idSucursal) === String(selectedSucursalId));

  const load = useCallback(async (term = "") => {
    if (!selectedSucursalId) return;
    setLoading(true);
    try {
      const response = await axiosClient.get("/inventario/entradas", { params: { idSucursal: selectedSucursalId, query: term } });
      setEntries(response.data.data || []);
    } catch (error) { setNotice({ type: "error", message: error.response?.data?.message || "No fue posible cargar las entradas." }); }
    finally { setLoading(false); }
  }, [selectedSucursalId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async entry => {
    if (selected === entry.idCompra) return setSelected(null);
    setSelected(entry.idCompra);
    if (details[entry.idCompra]) return;
    try {
      const response = await axiosClient.get(`/inventario/entradas/${entry.idCompra}`, { params: { idSucursal: selectedSucursalId } });
      setDetails(current => ({ ...current, [entry.idCompra]: response.data.data || [] }));
    } catch (error) { setNotice({ type: "error", message: error.response?.data?.message || "No fue posible consultar los productos." }); }
  };

  const pdf = async (event, entry) => {
    event.stopPropagation(); setDownloading(entry.idCompra);
    try {
      const response = await axiosClient.get(`/inventario/entradas/${entry.idCompra}/pdf`, { params: { idSucursal: selectedSucursalId }, responseType: "blob" });
      const url = URL.createObjectURL(response.data); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `entrada-productos-${entry.numeroPedido}.pdf`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch { setNotice({ type: "error", message: "No fue posible descargar la entrada." }); }
    finally { setDownloading(null); }
  };

  return <div className="space-y-5">
    <NotificationToast notification={notice} onClose={() => setNotice(null)} />
    <header className="page-title p-5"><h1 className="text-2xl font-bold">Historial de entradas · {branch?.nombreSuc || branch?.nombre}</h1><p className="mt-1 text-sm text-slate-500">Consulta pedidos recibidos, saldos pendientes y pagos realizados a proveedores.</p></header>
    <section className="relative min-h-60 border bg-white">
      {loading && <LoadingIndicator label="Cargando entradas…" />}
      <div className="flex gap-2 border-b p-4"><input className="input" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === "Enter" && load(query)} placeholder="Pedido o proveedor" /><button className="button-primary" onClick={() => load(query)}><Search className="h-4 w-4" />Buscar</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-100 text-left"><tr><th className="p-4">Pedido</th><th>Proveedor</th><th>Fecha</th><th>Forma original</th><th className="text-right">Total</th><th className="text-right">Pagado</th><th className="text-right">Saldo</th><th>Estado</th><th className="p-4 text-right">Acciones</th></tr></thead><tbody className="divide-y">
        {entries.map(entry => <Fragment key={entry.idCompra}><tr onClick={() => toggle(entry)} className={`cursor-pointer hover:bg-slate-50 ${selected === entry.idCompra ? "bg-teal-50" : ""}`}><td className="p-4 font-semibold"><span className="inline-flex items-center gap-2">{selected === entry.idCompra ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{entry.numeroPedido}</span></td><td>{entry.proveedorNombre}</td><td>{formatGuatemalaDateTime(entry.fecha)}</td><td className="capitalize">{entry.metodoPago}</td><td className="text-right font-bold">{money.format(entry.total)}</td><td className="text-right text-emerald-700">{money.format(entry.totalPagado)}</td><td className="text-right font-bold">{money.format(entry.saldoPendiente)}</td><td><Status value={entry.estadoPago} /></td><td className="p-4"><div className="flex justify-end gap-2">{entry.saldoPendiente > 0 && <button type="button" className="button-primary" onClick={event => { event.stopPropagation(); setPaymentEntry(entry); }}><WalletCards className="h-4 w-4" />Registrar pago</button>}<button type="button" className="button-secondary" disabled={downloading === entry.idCompra} onClick={event => pdf(event, entry)}><FileDown className="h-4 w-4" />PDF</button></div></td></tr>{selected === entry.idCompra && <tr><td colSpan="9" className="bg-slate-50 p-4"><Products rows={details[entry.idCompra]} /></td></tr>}</Fragment>)}
        {!loading && !entries.length && <tr><td colSpan="9" className="p-10 text-center text-slate-500">No hay entradas para mostrar.</td></tr>}
      </tbody></table></div>
    </section>
    {paymentEntry && <PaymentModal entry={paymentEntry} branchId={selectedSucursalId} close={() => setPaymentEntry(null)} saved={async () => { setPaymentEntry(null); await load(query); setNotice({ type: "success", message: "Pago del pedido registrado." }); }} notify={setNotice} />}
  </div>;
}

function PaymentModal({ entry, branchId, close, saved, notify }) {
  const [form, setForm] = useState({ monto: entry.saldoPendiente, metodoPago: "efectivo", fecha: guatemalaInputDate(), referencia: "", observaciones: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const amount = Number(form.monto);
    if (amount <= 0 || amount > Number(entry.saldoPendiente)) return notify({ type: "warning", message: "El monto debe ser mayor que cero y no superar el saldo pendiente." });
    setSaving(true);
    try { await axiosClient.post(`/inventario/entradas/${entry.idCompra}/pagos`, { ...form, monto: amount, idSucursal: Number(branchId), fecha: `${form.fecha}T12:00:00` }); await saved(); }
    catch (error) { notify({ type: "error", message: error.response?.data?.message || "No fue posible registrar el pago." }); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-lg bg-white shadow-xl"><header className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-bold">Registrar pago</h2><p className="text-sm text-slate-500">{entry.numeroPedido} · Saldo {money.format(entry.saldoPendiente)}</p></div><button onClick={close}><X className="h-5 w-5" /></button></header><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Monto *"><input type="number" min="0.01" max={entry.saldoPendiente} step="0.01" className="input" value={form.monto} onChange={event => setForm({ ...form, monto: event.target.value })} /></Field><Field label="Fecha *"><input type="date" className="input" value={form.fecha} onChange={event => setForm({ ...form, fecha: event.target.value })} /></Field><Field label="Forma de pago *"><select className="input" value={form.metodoPago} onChange={event => setForm({ ...form, metodoPago: event.target.value })}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option></select></Field><Field label="Referencia"><input className="input" value={form.referencia} onChange={event => setForm({ ...form, referencia: event.target.value })} /></Field><label className="sm:col-span-2 text-sm font-semibold">Observaciones<textarea className="input mt-1 h-20 py-2" value={form.observaciones} onChange={event => setForm({ ...form, observaciones: event.target.value })} /></label></div><footer className="flex justify-end gap-2 border-t p-4"><button className="button-secondary" onClick={close}>Cancelar</button><button className="button-primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Registrar pago"}</button></footer></section></div>;
}

function Products({ rows }) { if (!rows) return <p className="text-sm text-slate-500">Cargando productos…</p>; return <div><p className="mb-2 text-xs font-bold uppercase text-slate-500">Productos recibidos</p>{rows.map(item => <div key={item.idProducto} className="grid grid-cols-[1fr_auto_auto] gap-4 border-t py-2 text-sm"><span>{item.productoNombre}</span><span>{item.cantidad} unidades</span><b>{money.format(item.subtotal)}</b></div>)}</div>; }
function Status({ value }) { const paid = value === "Pagado"; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paid ? "bg-emerald-100 text-emerald-700" : value === "Pago parcial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{value}</span>; }
function Field({ label, children }) { return <label className="text-sm font-semibold">{label}<span className="mt-1 block">{children}</span></label>; }
