import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ExternalLink, Printer, Search, Trash2, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { formatGuatemalaDateTime, guatemalaInputDate, guatemalaMonthStart } from '../utils/guatemalaDate';
import { useAuth } from '../context/AuthContext';
import NotificationToast from '../components/NotificationToast';
import { openBlobInNewTab } from '../utils/blobFiles';

const firstDay = () => guatemalaMonthStart();
const today = () => guatemalaInputDate();
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

export default function FacturasPage() {
    const { selectedSucursalId } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const autoLoaded = useRef(false);
    const [filters, setFilters] = useState({ query: '', fechaDesde: firstDay(), fechaHasta: today() });
    const [rows, setRows] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [notification, setNotification] = useState(null);
    const [sort, setSort] = useState({ key: 'fechaEmision', direction: 'desc' });
    const [page, setPage] = useState(1);
    const selected = useMemo(() => rows.filter(row => selectedIds.includes(row.idFactura)), [rows, selectedIds]);
    const total = useMemo(() => rows.reduce((sum, row) => sum + row.total, 0), [rows]);
    const sortedRows = useMemo(() => [...rows].sort((a, b) => {
        const left = sort.key === 'fechaEmision' ? new Date(a.fechaEmision).getTime() : sort.key === 'total' ? Number(a.total) : String(a[sort.key] || '').toLowerCase();
        const right = sort.key === 'fechaEmision' ? new Date(b.fechaEmision).getTime() : sort.key === 'total' ? Number(b.total) : String(b[sort.key] || '').toLowerCase();
        return (left > right ? 1 : left < right ? -1 : 0) * (sort.direction === 'asc' ? 1 : -1);
    }), [rows, sort]);
    const pageCount = Math.max(1, Math.ceil(sortedRows.length / 10));
    const visibleRows = sortedRows.slice((page - 1) * 10, page * 10);
    const changeSort = key => { setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1); };

    useEffect(() => { setRows([]); setSelectedIds([]); }, [selectedSucursalId]);
    const load = async (selectId = null) => {
        if (!selectedSucursalId) return;
        setLoading(true);
        try {
            const response = await axiosClient.get('/facturacion', { params: { idSucursal: selectedSucursalId, ...filters } });
            const results = response.data.data || [];
            setRows(results); setPage(1); setSelectedIds(selectId && results.some(row => row.idFactura === selectId) ? [selectId] : []);
        } finally { setLoading(false); }
    };
    useEffect(() => {
        const id = Number(searchParams.get('factura'));
        if (!selectedSucursalId || !id || autoLoaded.current) return;
        autoLoaded.current = true;
        setLoading(true);
        axiosClient.get('/facturacion', { params: { idSucursal: selectedSucursalId, query: '', fechaDesde: firstDay(), fechaHasta: today() } })
            .then(response => { const results = response.data.data || []; setRows(results); setSelectedIds(results.some(row => row.idFactura === id) ? [id] : []); })
            .finally(() => setLoading(false));
    }, [selectedSucursalId, searchParams]);
    const toggle = id => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    const toggleAll = () => setSelectedIds(selectedIds.length === rows.length ? [] : rows.map(row => row.idFactura));
    const printSelected = async () => {
        if (!selected.length) return;
        setPrinting(true);
        try {
            const responses = await Promise.all(selected.map(row => axiosClient.get(`/facturacion/${row.idFactura}/pdf`, { responseType: 'blob' })));
            responses.forEach(response => openBlobInNewTab(response.data));
        } catch { setNotification({ type: 'error', message: 'No fue posible obtener los PDF seleccionados.' }); }
        finally { setPrinting(false); }
    };
    const cancelInvoice = async () => {
        if (!cancelTarget || !cancelReason.trim()) return;
        setCancelling(true);
        try {
            await axiosClient.post(`/facturacion/${cancelTarget.idFactura}/anular`, { motivo: cancelReason.trim() });
            setCancelTarget(null); setCancelReason(''); setSelectedIds([]);
            setNotification({ type: 'success', message: 'Factura anulada correctamente en Digifact.' });
            await load();
        } catch (error) {
            setNotification({ type: 'error', message: error.response?.data?.message || 'No fue posible anular la factura.' });
        } finally { setCancelling(false); }
    };

    return <div className="space-y-5">
        <NotificationToast notification={notification} onClose={() => setNotification(null)} />
        <header className="page-title p-5">
            <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Facturas</h1><p className="text-2xl font-bold text-brand-teal">{money.format(total)}</p></div>
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_170px_170px_auto]"><input className="input" value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder="Factura, recibo, NIT o receptor" /><input type="date" className="input" value={filters.fechaDesde} onChange={event => setFilters({ ...filters, fechaDesde: event.target.value })} /><input type="date" className="input" value={filters.fechaHasta} onChange={event => setFilters({ ...filters, fechaHasta: event.target.value })} /><button onClick={() => load()} disabled={loading} className="button-primary"><Search className="h-4 w-4" />{loading ? 'Buscando…' : 'Buscar'}</button></div>
        </header>
        <section className="border bg-white">
            <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead className="bg-slate-100 text-left"><tr><th className="w-12 p-4"><input type="checkbox" checked={rows.length > 0 && selectedIds.length === rows.length} onChange={toggleAll} aria-label="Seleccionar todas" /></th><InvoiceSortHead label="Factura" field="numeroFactura" sort={sort} set={changeSort} /><InvoiceSortHead label="Fecha" field="fechaEmision" sort={sort} set={changeSort} /><InvoiceSortHead label="Receptor" field="nombreReceptor" sort={sort} set={changeSort} /><InvoiceSortHead label="Recibo" field="numeroRecibo" sort={sort} set={changeSort} /><InvoiceSortHead label="Total" field="total" sort={sort} set={changeSort} right /></tr></thead>
                <tbody className="divide-y">{loading ? <tr><td colSpan="6" className="p-8 text-center text-slate-500">Buscando…</td></tr> : rows.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-slate-500">Define los filtros y presiona Buscar.</td></tr> : visibleRows.map(row => { const active = selectedIds.includes(row.idFactura); return <tr key={row.idFactura} onClick={() => toggle(row.idFactura)} className={`cursor-pointer ${active ? 'bg-teal-50' : 'hover:bg-slate-50'}`}><td className="p-4"><input type="checkbox" checked={active} onChange={() => toggle(row.idFactura)} onClick={event => event.stopPropagation()} aria-label={`Seleccionar ${row.numeroFactura}`} /></td><td><b>{row.numeroFactura}</b><small className="block text-slate-500">{row.tipoOrigen === 'Abono' ? 'Factura de abono' : row.numeroAutorizacion}</small></td><td>{new Date(row.fechaEmision).toLocaleString('es-GT')}</td><td>{row.nombreReceptor}<small className="block">{row.nitReceptor}</small></td><td>{row.numeroRecibo || 'Abono'}</td><td className="p-4 text-right font-bold">{money.format(row.total)}</td></tr>; })}</tbody>
            </table></div>
            <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-2 text-sm"><span>{rows.length} facturas</span><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border bg-white px-2 py-1 disabled:opacity-40">Anterior</button><span>Página {page} de {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(page + 1)} className="rounded border bg-white px-2 py-1 disabled:opacity-40">Siguiente</button></div></div>
            <footer className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3"><span className="text-sm font-medium text-slate-600">{selected.length ? `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}` : 'Selecciona una o varias facturas'}</span><div className="flex flex-wrap gap-2"><button onClick={printSelected} disabled={!selected.length || printing} className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"><Printer className="h-4 w-4" />Imprimir PDF</button><button onClick={() => navigate(`/ventas/recibos?recibo=${encodeURIComponent(selected[0].numeroRecibo)}`)} disabled={selected.length !== 1} className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"><ExternalLink className="h-4 w-4" />Ver recibo</button><button onClick={() => { setCancelTarget(selected[0]); setCancelReason(''); }} disabled={selected.length !== 1 || selected[0]?.estado !== 'Autorizada'} className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" />Anular factura</button></div></footer>
        </section>
        {cancelTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><section className="w-full max-w-lg border bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">Anular factura FEL</h2><p className="mt-1 text-sm text-slate-500">{cancelTarget.numeroFactura} · {money.format(cancelTarget.total)}</p></div><button onClick={() => setCancelTarget(null)} aria-label="Cerrar"><X className="h-5 w-5" /></button></div><div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">La solicitud se enviará primero a Digifact. El sistema solo marcará la factura como anulada cuando el certificador la acepte.</div><label className="mt-4 block text-sm font-semibold">Motivo de anulación *<textarea className="input mt-1 h-28 py-2" value={cancelReason} onChange={event => setCancelReason(event.target.value)} maxLength={500} /></label><div className="mt-5 flex justify-end gap-2"><button className="button-secondary" onClick={() => setCancelTarget(null)}>Cancelar</button><button disabled={cancelling || !cancelReason.trim()} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-45" onClick={cancelInvoice}>{cancelling ? 'Anulando…' : 'Confirmar anulación'}</button></div></section></div>}
    </div>;
}

function InvoiceSortHead({ label, field, sort, set, right = false }) {
    const Icon = sort.key !== field ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
    return <th className={`p-3 ${right ? 'text-right' : ''}`}><button type="button" onClick={() => set(field)} className="inline-flex items-center gap-1 whitespace-nowrap">{label}<Icon className="h-3.5 w-3.5 text-slate-400" /></button></th>;
}
