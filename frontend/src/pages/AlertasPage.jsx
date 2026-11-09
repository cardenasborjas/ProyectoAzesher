import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import LoadingIndicator from "../components/LoadingIndicator";
import { formatGuatemalaDateTime, guatemalaInputDate } from "../utils/guatemalaDate";

const pageSize = 10;

export default function AlertasPage() {
  const navigate = useNavigate();
  const today = guatemalaInputDate();
  const [range, setRange] = useState({ fechaDesde: today, fechaHasta: today });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async (selectedRange) => {
    setLoading(true);
    try {
      const response = await axiosClient.get("/notificaciones/historial", { params: { limite: 500, ...selectedRange } });
      setRows(response.data.data || []);
      setPage(1);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(range); }, [load]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);
  const open = async (row) => {
    if (!row.leida) await axiosClient.post(`/notificaciones/${row.idNotificacion}/leer`);
    window.dispatchEvent(new Event("notifications-refresh"));
    if (row.url) navigate(row.url);
  };
  const consult = () => { if (range.fechaDesde <= range.fechaHasta) load(range); };

  return <div className="mx-auto max-w-4xl space-y-5">
    <header className="page-title p-5"><h1 className="text-2xl font-bold">Historial de notificaciones</h1><p className="mt-1 text-sm text-slate-500">Consulta las notificaciones recibidas en un rango de fechas.</p></header>
    <section className="border bg-white p-4"><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Desde<input type="date" className="input mt-1 w-48" value={range.fechaDesde} max={today} onChange={event => setRange(current => ({ ...current, fechaDesde: event.target.value }))} /></label><label className="text-sm font-semibold">Hasta<input type="date" className="input mt-1 w-48" value={range.fechaHasta} max={today} onChange={event => setRange(current => ({ ...current, fechaHasta: event.target.value }))} /></label><button className="button-primary" onClick={consult} disabled={loading || range.fechaDesde > range.fechaHasta}><Search className="h-4 w-4" />Consultar</button></div>{range.fechaDesde > range.fechaHasta && <p className="mt-2 text-sm font-semibold text-red-600">La fecha inicial no puede ser posterior a la fecha final.</p>}</section>
    <section className="relative min-h-40 overflow-hidden rounded-xl border bg-white shadow-sm">
      {loading && <LoadingIndicator label="Cargando notificaciones…" />}
      {visible.map(row => <NotificationRow key={row.idNotificacion} row={row} open={open} />)}
      {!loading && !rows.length && <div className="p-12 text-center"><Bell className="mx-auto h-8 w-8 text-[var(--branch-color)]"/><h2 className="mt-4 font-bold">Sin notificaciones en este período</h2><p className="mt-1 text-sm text-slate-500">Selecciona otro rango de fechas para consultar el historial.</p></div>}
      {!loading && rows.length > pageSize && <footer className="flex items-center justify-between border-t bg-slate-50 p-3 text-sm"><span>Página {page} de {pageCount} · {rows.length} notificaciones</span><div className="flex gap-2"><button className="button-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button><button className="button-secondary" disabled={page === pageCount} onClick={() => setPage(value => value + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button></div></footer>}
    </section>
  </div>;
}

function NotificationRow({ row, open }) {
  return <button onClick={() => open(row)} className={`flex w-full items-start gap-4 border-b p-4 text-left last:border-b-0 hover:bg-slate-50 ${!row.leida ? "bg-sky-50/50" : ""}`}><span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 text-[var(--branch-color)]"><Bell className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b>{row.titulo}</b><span className="mt-1 block text-sm text-slate-600">{row.mensaje}</span><small className="mt-2 block text-slate-400">{formatGuatemalaDateTime(row.fechaCreacion)}</small></span>{row.url && <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-slate-400" />}</button>;
}
