import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, FilePlus2, FileText, Search, Table2, Trash2, Printer, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import NotificationToast from '../components/NotificationToast';
import ConfirmCancelModal from '../components/ConfirmCancelModal';
import NitValidationField from '../components/NitValidationField';
import { downloadBlob, openBlobInNewTab } from '../utils/blobFiles';
import LoadingIndicator from '../components/LoadingIndicator';

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

export default function RecibosPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { selectedSucursalId } = useAuth();
    const [filters, setFilters] = useState({ query: searchParams.get('recibo') || searchParams.get('cliente') || '', fechaDesde: '', fechaHasta: '', tipoDocumento: ['nota','abono'].includes(searchParams.get('tipo')) ? searchParams.get('tipo') : 'recibo', metodoPago: '' });
    const filtersRef = useRef(filters);
    const [receipts, setReceipts] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [invoiceTarget, setInvoiceTarget] = useState(null);
    const [invoiceForm, setInvoiceForm] = useState({ nombre: '', nit: 'CF', direccion: '' });
    const [invoiceNitValidated, setInvoiceNitValidated] = useState(true);
    const [sort, setSort] = useState({ key: 'fechaPago', direction: 'desc' });
    const [page, setPage] = useState(1);
    const autoSearched = useRef(false);

    useEffect(() => { filtersRef.current = filters; }, [filters]);
    useEffect(() => { setReceipts([]); setSelectedIds([]); }, [selectedSucursalId]);
    const selected = useMemo(() => receipts.filter(receipt => selectedIds.includes(receipt.idRecibo)), [receipts, selectedIds]);
    const sortedReceipts = useMemo(() => [...receipts].sort((a, b) => {
        const left = sort.key === 'fechaPago' ? new Date(a.fechaPago).getTime() : sort.key === 'monto' ? Number(a.monto) : String(a[sort.key] || '').toLowerCase();
        const right = sort.key === 'fechaPago' ? new Date(b.fechaPago).getTime() : sort.key === 'monto' ? Number(b.monto) : String(b[sort.key] || '').toLowerCase();
        return (left > right ? 1 : left < right ? -1 : 0) * (sort.direction === 'asc' ? 1 : -1);
    }), [receipts, sort]);
    const pageCount = Math.max(1, Math.ceil(sortedReceipts.length / 10));
    const visibleReceipts = sortedReceipts.slice((page - 1) * 10, page * 10);
    const changeSort = key => { setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1); };
    const single = selected.length === 1 ? selected[0] : null;

    const loadReceipts = useCallback(async () => {
        if (!selectedSucursalId) return;
        setLoading(true);
        try {
            const current = filtersRef.current;
            if (current.tipoDocumento === 'abono') {
                const response = await axiosClient.get('/cobros/abonos', { params: { idSucursal: selectedSucursalId, query: current.query, fechaDesde: current.fechaDesde || null, fechaHasta: current.fechaHasta || null, metodoPago: current.metodoPago } });
                setReceipts((response.data?.data ?? []).map(row => ({ ...row, idRecibo: -row.idAbono, numeroRecibo: row.numeroAbono, fechaPago: row.fecha, clienteNombre: row.cliente, clienteNit: row.nit, estado: 'Registrado', tipoAbono: true })));
            } else {
                const response = await axiosClient.get('/ventas/recibos', { params: { idSucursal: selectedSucursalId, query: current.query, fechaDesde: current.fechaDesde || null, fechaHasta: current.fechaHasta || null, tipoDocumento: current.tipoDocumento, metodoPago: current.metodoPago } });
                setReceipts(response.data?.data ?? []);
            }
            setSelectedIds([]);
            setPage(1);
        } catch (error) { setNotification({ message: error.response?.data?.message || 'No fue posible cargar los documentos.', type: 'error' }); }
        finally { setLoading(false); }
    }, [selectedSucursalId]);
    useEffect(() => {
        if (!selectedSucursalId || autoSearched.current || !(searchParams.get('recibo') || searchParams.get('cliente'))) return;
        autoSearched.current = true;
        loadReceipts();
    }, [selectedSucursalId, searchParams, loadReceipts]);
    const selectDocumentType = tipoDocumento => {
        const next = { ...filters, tipoDocumento, metodoPago: tipoDocumento === 'nota' ? 'credito' : '' };
        setFilters(next); filtersRef.current = next; setReceipts([]); setSelectedIds([]);
    };
    const toggle = id => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    const toggleAll = () => setSelectedIds(selectedIds.length === receipts.length ? [] : receipts.map(receipt => receipt.idRecibo));

    const exportSelected = async format => {
        if (!selected.length) return;
        setExporting(true);
        try {
            const files = await Promise.all(selected.map(receipt => axiosClient.get(receipt.tipoAbono ? `/cobros/abonos/${receipt.idAbono}/pdf` : `/ventas/recibos/${receipt.idRecibo}/${format}`, { responseType: 'blob' })));
            files.forEach((response, index) => {
                if (format === 'pdf') {
                    openBlobInNewTab(response.data, `${selected[index].numeroRecibo}.pdf`);
                } else {
                    downloadBlob(response.data, format === 'docx' ? `${selected[index].numeroRecibo}.docx` : `detalle-${selected[index].numeroRecibo}.xlsx`);
                }
            });
        } catch {
            setNotification({ message: 'No fue posible generar todos los documentos seleccionados.', type: 'error' });
        } finally { setExporting(false); }
    };
    const viewInvoice = async receipt => {
        setExporting(true);
        try { const response = await axiosClient.get(`/facturacion/${receipt.idFactura}/pdf`, { responseType: 'blob' }); openBlobInNewTab(response.data, `${receipt.numeroFactura || receipt.numeroRecibo || 'factura'}.pdf`); }
        catch { setNotification({ message: 'No fue posible abrir la factura.', type: 'error' }); }
        finally { setExporting(false); }
    };
    const cancelReceipt = async () => {
        setCancelling(true);
        try {
            await axiosClient.post(`/ventas/recibos/${cancelTarget.idRecibo}/anular`, { idSucursal: Number(selectedSucursalId), motivo: cancelReason.trim() });
            setCancelTarget(null); setCancelReason(''); setNotification({ message: 'Documento anulado y productos devueltos al inventario.', type: 'success' }); await loadReceipts();
        } catch (error) { setNotification({ message: error.response?.data?.errors || error.response?.data?.message || 'No fue posible anular el documento.', type: 'error' }); }
        finally { setCancelling(false); }
    };
    const invoicePayment = async () => {
        if (!invoiceNitValidated) return setNotification({ type: 'warning', message: 'Valida el NIT antes de autorizar la factura.' });
        try {
            const response = await axiosClient.post('/facturacion/abonos', { idAbono: invoiceTarget.idAbono, idSucursal: Number(selectedSucursalId), ...invoiceForm });
            setInvoiceTarget(null); setNotification({ type: 'info', message: response.data.message || 'La factura se generará en segundo plano. Te notificaremos cuando esté lista.' });
            window.dispatchEvent(new Event('notifications-refresh')); await loadReceipts();
        } catch (error) { setNotification({ type: 'error', message: error.response?.data?.message || 'No fue posible facturar el abono.' }); }
    };

    const isNote = filters.tipoDocumento === 'nota';
    const isPayment = filters.tipoDocumento === 'abono';
    return <div className="space-y-5">
        {exporting && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35" role="status" aria-live="polite"><div className="relative min-h-32 w-full max-w-sm rounded-xl bg-white shadow-2xl"><LoadingIndicator label="Generando documento…" /></div></div>}
        <header className="page-title p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><h1 className="text-xl font-semibold text-slate-900">{isNote ? 'Cuentas por cobrar' : isPayment ? 'Recibos de abono' : 'Recibos'}</h1><span className="text-sm text-slate-500">{receipts.length} resultados</span></div></header>
        <section className="border bg-white">
            <div className="flex border-b"><button onClick={() => selectDocumentType('recibo')} className={`px-5 py-3 text-sm font-semibold ${!isNote && !isPayment ? 'border-b-2 border-brand-teal text-brand-teal' : 'text-slate-500'}`}>Recibos</button><button onClick={() => selectDocumentType('abono')} className={`px-5 py-3 text-sm font-semibold ${isPayment ? 'border-b-2 border-brand-teal text-brand-teal' : 'text-slate-500'}`}>Recibos de abono</button><button onClick={() => selectDocumentType('nota')} className={`px-5 py-3 text-sm font-semibold ${isNote ? 'border-b-2 border-brand-teal text-brand-teal' : 'text-slate-500'}`}>Cuentas por cobrar</button></div>
            <div className="grid gap-3 p-5 lg:grid-cols-[1fr_160px_160px_170px_auto]"><input value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder="Cliente, NIT o número" className="input" /><input type="date" value={filters.fechaDesde} onChange={event => setFilters({ ...filters, fechaDesde: event.target.value })} className="input" /><input type="date" value={filters.fechaHasta} onChange={event => setFilters({ ...filters, fechaHasta: event.target.value })} className="input" /><select disabled={isNote} value={filters.metodoPago} onChange={event => setFilters({ ...filters, metodoPago: event.target.value })} className="input"><option value="">Todos los pagos</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="cheque">Cheque</option><option value="tarjeta">Tarjeta</option></select><button type="button" onClick={loadReceipts} className="button-primary"><Search className="h-4 w-4" />Buscar</button></div>
        </section>
        <section className="border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="w-12 p-4"><input type="checkbox" checked={receipts.length > 0 && selectedIds.length === receipts.length} onChange={toggleAll} aria-label="Seleccionar todos" /></th><ReceiptSortHead label="Número" field="numeroRecibo" sort={sort} set={changeSort} /><ReceiptSortHead label="Fecha" field="fechaPago" sort={sort} set={changeSort} /><ReceiptSortHead label="Cliente" field="clienteNombre" sort={sort} set={changeSort} /><ReceiptSortHead label="Pago" field="metodoPago" sort={sort} set={changeSort} /><ReceiptSortHead label="Monto" field="monto" sort={sort} set={changeSort} right /><ReceiptSortHead label="Estado" field="estado" sort={sort} set={changeSort} /></tr></thead>
                <tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="7" className="p-8 text-center text-slate-500">Buscando…</td></tr> : receipts.length === 0 ? <tr><td colSpan="7" className="p-8 text-center text-slate-500">Define los filtros y presiona Buscar.</td></tr> : visibleReceipts.map(receipt => { const active = selectedIds.includes(receipt.idRecibo); return <tr key={receipt.idRecibo} onClick={() => toggle(receipt.idRecibo)} className={`cursor-pointer ${active ? 'bg-teal-50' : 'hover:bg-slate-50'} ${receipt.estado === 'Anulado' ? 'text-slate-500' : ''}`}><td className="p-4"><input type="checkbox" checked={active} onChange={() => toggle(receipt.idRecibo)} onClick={event => event.stopPropagation()} aria-label={`Seleccionar ${receipt.numeroRecibo}`} /></td><td className="p-4"><span className="font-semibold text-slate-900">{receipt.numeroRecibo}</span>{receipt.esFacturada && <small className="block text-slate-500">{receipt.numeroFactura}</small>}</td><td className="p-4">{new Date(receipt.fechaPago).toLocaleString('es-GT')}</td><td className="p-4"><span className="font-medium">{receipt.clienteNombre}</span><small className="block">{receipt.clienteNit || 'CF'}</small></td><td className="p-4 capitalize">{receipt.metodoPago}</td><td className="p-4 text-right font-semibold">{money.format(receipt.monto)}</td><td className="p-4">{receipt.estado}</td></tr>; })}</tbody>
            </table></div>
            <footer className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3">
                <div className="text-sm font-medium text-slate-600"><span>{selected.length ? `${selected.length} seleccionado${selected.length === 1 ? '' : 's'}` : `${receipts.length} resultados`}</span><div className="mt-2 flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border bg-white px-2 py-1 disabled:opacity-40">Anterior</button><span>Página {page} de {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(page + 1)} className="rounded border bg-white px-2 py-1 disabled:opacity-40">Siguiente</button></div></div>
                <div className="flex flex-wrap justify-end gap-2"><Action icon={Printer} label="Imprimir PDF" disabled={!selected.length || exporting} onClick={() => exportSelected('pdf')} /><Action icon={FileText} label="Word" disabled={!selected.length || exporting || isPayment} onClick={() => exportSelected('docx')} /><Action icon={Table2} label="Excel" disabled={!selected.length || exporting || isPayment} onClick={() => exportSelected('excel')} />{single && !isNote && single.estado !== 'Anulado' && (single.esFacturada ? <Action icon={Eye} label="Ver factura" onClick={() => viewInvoice(single)} primary /> : isPayment ? <Action icon={FilePlus2} label="Generar factura" onClick={() => { setInvoiceTarget(single); setInvoiceForm({ nombre: single.clienteNombre, nit: single.clienteNit || 'CF', direccion: '' }); setInvoiceNitValidated(!single.clienteNit || String(single.clienteNit).toUpperCase() === 'CF'); }} primary /> : <Action icon={FilePlus2} label="Generar factura" onClick={() => navigate(`/ventas/facturas/crear?recibo=${encodeURIComponent(single.numeroRecibo)}`)} primary />)}{single && !isPayment && single.estado !== 'Anulado' && !single.esFacturada && <Action icon={Trash2} label="Anular" danger onClick={() => { setCancelTarget(single); setCancelReason(''); }} />}</div>
            </footer>
        </section>
        <NotificationToast notification={notification} onClose={() => setNotification(null)} />
        <ConfirmCancelModal receipt={cancelTarget} reason={cancelReason} onReasonChange={setCancelReason} onCancel={() => setCancelTarget(null)} onConfirm={cancelReceipt} loading={cancelling} />
        {invoiceTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-lg space-y-4 border bg-white p-6 shadow-xl"><div className="flex justify-between"><div><h2 className="text-lg font-bold">Facturar recibo de abono</h2><p className="text-sm text-slate-500">{invoiceTarget.numeroRecibo} · {money.format(invoiceTarget.monto)}</p></div><button onClick={() => setInvoiceTarget(null)}><X className="h-5 w-5" /></button></div><label className="text-sm font-semibold">Nombre receptor *<input className="input mt-1" value={invoiceForm.nombre} onChange={e => setInvoiceForm({ ...invoiceForm, nombre: e.target.value })} /></label><NitValidationField value={invoiceForm.nit||'CF'} onChange={nit=>setInvoiceForm({...invoiceForm,nit})} onValidated={(valid,result)=>{setInvoiceNitValidated(valid);if(valid&&result&&!result.isConsumerFinal)setInvoiceForm(current=>({...current,nombre:result.name}));}}/><label className="text-sm font-semibold">Dirección<input className="input mt-1" value={invoiceForm.direccion} onChange={e => setInvoiceForm({ ...invoiceForm, direccion: e.target.value })} /></label><div className="flex justify-end gap-2"><button className="button-secondary" onClick={() => setInvoiceTarget(null)}>Cancelar</button><button disabled={!invoiceNitValidated} className="button-primary disabled:opacity-45" onClick={invoicePayment}>Autorizar e imprimir</button></div></section></div>}
    </div>;
}

function Action({ icon: Icon, label, primary, danger, ...props }) {
    return <button type="button" {...props} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${primary ? 'border-brand-teal bg-brand-teal text-white' : danger ? 'border-red-200 bg-white text-red-600' : 'border-slate-300 bg-white text-slate-700'}`}><Icon className="h-4 w-4" />{label}</button>;
}

function ReceiptSortHead({ label, field, sort, set, right = false }) {
    const Icon = sort.key !== field ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
    return <th className={`p-4 ${right ? 'text-right' : ''}`}><button type="button" onClick={() => set(field)} className="inline-flex items-center gap-1 whitespace-nowrap">{label}<Icon className="h-3.5 w-3.5 opacity-60" /></button></th>;
}
