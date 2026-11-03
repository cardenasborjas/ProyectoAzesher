import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { guatemalaInputDate, guatemalaMonthStart } from '../utils/guatemalaDate';
import { useAuth } from '../context/AuthContext';

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const initialRange = () => ({ fechaDesde: guatemalaMonthStart(), fechaHasta: guatemalaInputDate() });
export default function ReportesPage() {
    const { selectedSucursalId } = useAuth();
    const [dates, setDates] = useState(initialRange);
    const [sets, setSets] = useState({ ventas: [], inventario: [], cobros: [], caja: [] });
    const [utility, setUtility] = useState({ ventas: 0, costoVentas: 0, utilidadBruta: 0, gastosOperativos: 0, utilidadNeta: 0, margenBrutoPorcentaje: 0, cuentasPorCobrar: 0, compras: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async range => {
        if (!selectedSucursalId) return;
        setLoading(true); setError('');
        try {
            const types = ['ventas', 'inventario', 'cobros', 'caja'];
            const [responses, utilityResponse] = await Promise.all([Promise.all(types.map(type => axiosClient.get(`/operaciones/reportes/${type}`, { params: { idSucursal: selectedSucursalId, ...range } }))), axiosClient.get('/operaciones/reportes/utilidad/resumen', { params: { idSucursal: selectedSucursalId, ...range } })]);
            setSets(Object.fromEntries(types.map((type, index) => [type, responses[index].data.data || []])));
            setUtility(utilityResponse.data.data || {});
        } catch (requestError) { setError(requestError.response?.data?.message || 'No fue posible consultar los reportes.'); }
        finally { setLoading(false); }
    }, [selectedSucursalId]);
    useEffect(() => { setSets({ ventas: [], inventario: [], cobros: [], caja: [] }); setUtility({}); }, [selectedSucursalId]);
    const consult = () => { if (dates.fechaDesde > dates.fechaHasta) { setError('La fecha inicial no puede ser posterior a la fecha final.'); return; } load(dates); };
    const metrics = useMemo(() => ({ ventas: sets.ventas.reduce((sum, row) => sum + row.total, 0), inventario: sets.inventario.reduce((sum, row) => sum + row.total, 0), cobros: sets.cobros.reduce((sum, row) => sum + row.total, 0), unidades: sets.inventario.reduce((sum, row) => sum + row.registros, 0) }), [sets]);
    const csv = () => { const rows = [['Grupo', 'Fecha/Código', 'Categoría', 'Registros', 'Total'], ...Object.entries(sets).flatMap(([group, data]) => data.map(row => [group, row.codigo || row.fecha || '', row.categoria, row.registros, row.total]))]; const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([rows.map(row => row.join(',')).join('\n')], { type: 'text/csv' })); anchor.download = 'reporte-consolidado.csv'; anchor.click(); };
    return <div className="space-y-5">
        <header className="page-title p-5"><h1 className="text-2xl font-bold">Reportes</h1></header>
        <section className="border bg-white p-5"><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Desde<input type="date" className="input mt-1 w-44" value={dates.fechaDesde} onChange={event => setDates(current => ({ ...current, fechaDesde: event.target.value }))} /></label><label className="text-sm font-semibold">Hasta<input type="date" className="input mt-1 w-44" value={dates.fechaHasta} onChange={event => setDates(current => ({ ...current, fechaHasta: event.target.value }))} /></label><button disabled={loading} onClick={consult} className="flex h-10 items-center gap-2 rounded-md bg-brand-teal px-4 text-white disabled:opacity-50"><Search className="h-4 w-4" />{loading ? 'Consultando…' : 'Consultar'}</button><button onClick={csv} className="flex h-10 items-center gap-2 rounded-md border px-4"><Download className="h-4 w-4" />Excel CSV</button><button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-md border px-4"><Printer className="h-4 w-4" />PDF</button></div>{error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}</section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Ventas" value={money.format(metrics.ventas)} /><Metric label="Inventario" value={money.format(metrics.inventario)} /><Metric label="Cuentas por cobrar" value={money.format(metrics.cobros)} /><Metric label="Unidades" value={metrics.unidades} /></section>
        <section className="border bg-white p-5"><div className="mb-4"><h2 className="text-lg font-bold">Rentabilidad del período</h2><p className="text-sm text-slate-500">La utilidad utiliza el costo guardado al momento de cada venta y las salidas manuales de caja como gastos operativos.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Ventas" value={money.format(utility.ventas || 0)} /><Metric label="Costo de ventas" value={money.format(utility.costoVentas || 0)} /><Metric label="Utilidad bruta" value={money.format(utility.utilidadBruta || 0)} /><Metric label="Margen bruto" value={`${Number(utility.margenBrutoPorcentaje || 0).toFixed(2)}%`} /><Metric label="Gastos operativos" value={money.format(utility.gastosOperativos || 0)} /><Metric label="Utilidad neta" value={money.format(utility.utilidadNeta || 0)} /><Metric label="Compras" value={money.format(utility.compras || 0)} /><Metric label="Cuentas por cobrar" value={money.format(utility.cuentasPorCobrar || 0)} /></div></section>
        <section className="grid gap-5 xl:grid-cols-2"><Group title="Ventas e inventario" rows={[...sets.ventas, ...sets.inventario.slice(0, 8)]} /><Group title="Cartera e inventario" rows={[...sets.cobros, ...sets.inventario.slice(0, 8)]} /><Group title="Caja" rows={sets.caja} /><Group title="Inventario" rows={sets.inventario} /></section>
    </div>;
}
function Metric({ label, value }) { return <div className="border bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-brand-teal">{value}</p></div>; }
function Group({ title, rows }) { return <div className="overflow-hidden border bg-white"><h2 className="border-b p-4 font-bold">{title}</h2><div className="max-h-80 divide-y overflow-auto">{rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-sm"><span>{row.categoria}<small className="block text-slate-500">{row.codigo || row.fecha && new Date(row.fecha).toLocaleDateString('es-GT')}</small></span><span className="text-right"><b>{money.format(row.total)}</b><small className="block">{row.registros}</small></span></div>)}</div>{!rows.length && <p className="p-6 text-sm text-slate-500">Sin datos para el período.</p>}</div>; }
