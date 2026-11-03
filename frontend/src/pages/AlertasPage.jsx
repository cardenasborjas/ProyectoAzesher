import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import LoadingIndicator from "../components/LoadingIndicator";
import { formatGuatemalaDateTime, guatemalaInputDate } from "../utils/guatemalaDate";

const pageSize = 10;
export default function AlertasPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get("/notificaciones/historial", { params: { limite: 200 } });
      const today = guatemalaInputDate();
      setRows((response.data.data || []).filter(row => guatemalaInputDate(row.fechaCreacion) === today));
      setPage(1);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);
  const open = async row => { if (!row.leida) await axiosClient.post(`/notificaciones/${row.idNotificacion}/leer`); window.dispatchEvent(new Event("notifications-refresh")); await load(); if (row.url) navigate(row.url); };
  const readAll = async () => { await axiosClient.post("/notificaciones/leer-todas"); window.dispatchEvent(new Event("notifications-refresh")); await load(); };
  return <div className="mx-auto max-w-4xl space-y-5">
    <header className="page-title flex flex-wrap items-center justify-between gap-3 p-5"><div><h1 className="text-2xl font-bold">Notificaciones de hoy</h1><p className="mt-1 text-sm text-slate-500">Avisos personales, solicitudes y decisiones del día.</p></div><button onClick={readAll} className="button-secondary"><CheckCheck className="h-4 w-4" />Marcar pendientes como leídas</button></header>
    <section className="relative min-h-40 overflow-hidden rounded-xl border bg-white shadow-sm">
      {loading && <LoadingIndicator label="Cargando notificaciones…" />}
      {visible.map(row => <button key={row.idNotificacion} onClick={() => open(row)} className={`flex w-full items-start gap-4 border-b p-4 text-left last:border-b-0 hover:bg-slate-50 ${!row.leida && !row.resuelta ? "bg-sky-50/50" : ""}`}><span className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full ${row.resuelta ? "bg-slate-100 text-slate-500" : "bg-slate-50 text-[var(--branch-color)]"}`}><Bell className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><b>{row.titulo}</b>{row.resuelta && <small className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Resuelta</small>}{!row.leida && !row.resuelta && <small className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Nueva</small>}</span><span className="mt-1 block text-sm text-slate-600">{row.mensaje}</span><small className="mt-2 block text-slate-400">{formatGuatemalaDateTime(row.fechaCreacion)}</small></span>{row.url && <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-slate-400" />}</button>)}
      {!loading && !rows.length && <div className="p-12 text-center"><Bell className="mx-auto h-8 w-8 text-[var(--branch-color)]"/><h2 className="mt-4 font-bold">Sin notificaciones hoy</h2><p className="mt-1 text-sm text-slate-500">Los avisos nuevos aparecerán aquí.</p></div>}
      {!loading && rows.length > pageSize && <footer className="flex items-center justify-between border-t bg-slate-50 p-3 text-sm"><span>Página {page} de {pageCount} · {rows.length} avisos</span><div className="flex gap-2"><button className="button-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button><button className="button-secondary" disabled={page === pageCount} onClick={() => setPage(value => value + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button></div></footer>}
    </section>
  </div>;
}
