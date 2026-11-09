import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import LoadingIndicator from "../components/LoadingIndicator";
import { formatGuatemalaDateTime, guatemalaInputDate } from "../utils/guatemalaDate";

const pageSize = 10;
export default function AlertasPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(guatemalaInputDate());
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const load = useCallback(async selectedDate => {
    setLoading(true);
    try {
      const [historyResponse, pendingResponse] = await Promise.all([
        axiosClient.get("/notificaciones/historial", { params: { limite: 500, fecha: selectedDate } }),
        axiosClient.get("/notificaciones", { params: { incluirLeidas: true, limite: 100 } }),
      ]);
      setRows(historyResponse.data.data || []);
      setPending(pendingResponse.data.data?.registros || []);
      setPage(1);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(date); }, [load]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);
  const open = async row => { if (!row.leida) await axiosClient.post(`/notificaciones/${row.idNotificacion}/leer`); window.dispatchEvent(new Event("notifications-refresh")); if (row.url) navigate(row.url); else await load(date); };
  const readAll = async () => { await axiosClient.post("/notificaciones/leer-todas"); window.dispatchEvent(new Event("notifications-refresh")); await load(date); };
  return <div className="mx-auto max-w-4xl space-y-5">
    <header className="page-title flex flex-wrap items-center justify-between gap-3 p-5"><div><h1 className="text-2xl font-bold">Historial de notificaciones</h1><p className="mt-1 text-sm text-slate-500">Consulta avisos leídos, pendientes y resueltos por fecha.</p></div><button onClick={readAll} className="button-secondary"><CheckCheck className="h-4 w-4" />Marcar pendientes como leídas</button></header>
    <section className="border bg-white p-4"><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Fecha<input type="date" className="input mt-1 w-48" value={date} max={guatemalaInputDate()} onChange={event => setDate(event.target.value)} /></label><button className="button-primary" onClick={() => load(date)} disabled={loading}><Search className="h-4 w-4" />Consultar</button><span className="text-sm text-slate-500">Se muestran también las que ya fueron leídas.</span></div></section>
    {!!pending.length && <section className="overflow-hidden rounded-xl border border-amber-200 bg-white"><div className="border-b border-amber-200 bg-amber-50 p-4"><h2 className="font-bold text-amber-900">Pendientes sin resolver</h2><p className="text-sm text-amber-700">Estas solicitudes permanecen aquí aunque sean de días anteriores.</p></div>{pending.map(row => <NotificationRow key={`pending-${row.idNotificacion}`} row={row} open={open} />)}</section>}
    <section className="relative min-h-40 overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b p-4"><h2 className="font-bold">Notificaciones del {new Date(`${date}T12:00:00`).toLocaleDateString("es-GT")}</h2></div>
      {loading && <LoadingIndicator label="Cargando notificaciones…" />}
      {visible.map(row => <NotificationRow key={row.idNotificacion} row={row} open={open} />)}
      {!loading && !rows.length && <div className="p-12 text-center"><Bell className="mx-auto h-8 w-8 text-[var(--branch-color)]"/><h2 className="mt-4 font-bold">Sin notificaciones en esta fecha</h2><p className="mt-1 text-sm text-slate-500">Selecciona otro día para consultar el historial.</p></div>}
      {!loading && rows.length > pageSize && <footer className="flex items-center justify-between border-t bg-slate-50 p-3 text-sm"><span>Página {page} de {pageCount} · {rows.length} avisos</span><div className="flex gap-2"><button className="button-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button><button className="button-secondary" disabled={page === pageCount} onClick={() => setPage(value => value + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button></div></footer>}
    </section>
  </div>;
}
function NotificationRow({ row, open }) { return <button onClick={() => open(row)} className={`flex w-full items-start gap-4 border-b p-4 text-left last:border-b-0 hover:bg-slate-50 ${!row.leida && !row.resuelta ? "bg-sky-50/50" : ""}`}><span className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full ${row.resuelta ? "bg-slate-100 text-slate-500" : "bg-slate-50 text-[var(--branch-color)]"}`}><Bell className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><b>{row.titulo}</b>{row.resuelta && <small className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Resuelta</small>}{!row.leida && !row.resuelta && <small className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Nueva</small>}{row.leida && !row.resuelta && <small className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Pendiente</small>}</span><span className="mt-1 block text-sm text-slate-600">{row.mensaje}</span><small className="mt-2 block text-slate-400">{formatGuatemalaDateTime(row.fechaCreacion)}</small></span>{row.url && <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-slate-400" />}</button>; }
