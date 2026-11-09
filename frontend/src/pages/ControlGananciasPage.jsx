import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Search, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import axiosClient from '../api/axiosClient';
import LoadingIndicator from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';
import { guatemalaDaysAgo, guatemalaInputDate } from '../utils/guatemalaDate';

const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const empty = { ventas: 0, costoVentas: 0, utilidadBruta: 0, gastosOperativos: 0, utilidadNeta: 0, margenBrutoPorcentaje: 0, cuentasPorCobrar: 0, compras: 0 };

export default function ControlGananciasPage() {
  const { selectedSucursalId } = useAuth();
  const [range, setRange] = useState(() => ({ fechaDesde: guatemalaDaysAgo(30), fechaHasta: guatemalaInputDate() }));
  const [summary, setSummary] = useState(empty);
  const [sales, setSales] = useState([]);
  const [cash, setCash] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!selectedSucursalId) return;
    if (range.fechaDesde > range.fechaHasta) return setError('La fecha inicial no puede ser posterior a la final.');
    setLoading(true); setError('');
    try {
      const params = { idSucursal: selectedSucursalId, ...range };
      const [profit, salesResult, cashResult] = await Promise.all([
        axiosClient.get('/operaciones/reportes/utilidad/resumen', { params }),
        axiosClient.get('/operaciones/reportes/ventas', { params }),
        axiosClient.get('/operaciones/reportes/caja', { params }),
      ]);
      setSummary({ ...empty, ...(profit.data.data || {}) });
      setSales(salesResult.data.data || []);
      setCash(cashResult.data.data || []);
    } catch (requestError) { setError(requestError.response?.data?.message || 'No fue posible calcular el flujo de dinero.'); }
    finally { setLoading(false); }
  }, [selectedSucursalId, range]);
  useEffect(() => { load(); }, [selectedSucursalId]);
  const chart = useMemo(() => [
    { nombre: 'Ingresos', monto: summary.ventas },
    { nombre: 'Costo vendido', monto: summary.costoVentas },
    { nombre: 'Gastos', monto: summary.gastosOperativos },
    { nombre: 'Ganancia neta', monto: summary.utilidadNeta },
  ], [summary]);
  const ledger = useMemo(() => [
    ...sales.map(row => ({ fecha: row.fecha, concepto: row.categoria || 'Venta', debe: 0, haber: Number(row.total || 0), tipo: 'Ingreso' })),
    ...cash.map(row => ({ fecha: row.fecha, concepto: row.categoria || 'Movimiento de caja', debe: Number(row.total || 0) < 0 ? Math.abs(Number(row.total)) : 0, haber: Number(row.total || 0) > 0 ? Number(row.total) : 0, tipo: 'Caja' })),
  ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)), [sales, cash]);
  return <div className="space-y-5">
    <header className="page-title p-5"><h1 className="text-2xl font-bold">Control de ganancias</h1><p className="mt-1 text-sm text-slate-500">Ingresos, costos históricos de venta, gastos y flujo de dinero de la sucursal.</p></header>
    <section className="border bg-white p-5"><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Desde<input type="date" className="input mt-1 w-44" value={range.fechaDesde} onChange={event => setRange({ ...range, fechaDesde: event.target.value })} /></label><label className="text-sm font-semibold">Hasta<input type="date" className="input mt-1 w-44" value={range.fechaHasta} onChange={event => setRange({ ...range, fechaHasta: event.target.value })} /></label><button disabled={loading} onClick={load} className="button-primary"><Search className="h-4 w-4" />Consultar</button></div>{error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}</section>
    {loading && <div className="relative min-h-32"><LoadingIndicator label="Calculando ganancias y flujo de caja…" /></div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card icon={TrendingUp} label="Ingresos por ventas" value={summary.ventas} /><Card icon={TrendingDown} label="Costo histórico vendido" value={summary.costoVentas} /><Card icon={WalletCards} label="Ganancia neta" value={summary.utilidadNeta} emphasis /><Card icon={BarChart3} label="Margen bruto" value={summary.margenBrutoPorcentaje} percent /></section>
    <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><div className="border bg-white p-5"><h2 className="font-bold">Composición del resultado</h2><p className="mb-4 text-sm text-slate-500">El costo corresponde al guardado en cada detalle de venta cuando se realizó la operación.</p><ResponsiveContainer width="100%" height={300}><BarChart data={chart}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="nombre" /><YAxis /><Tooltip formatter={value => money.format(value)} /><Bar dataKey="monto" name="Monto" fill="var(--branch-color)" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div><div className="border bg-white p-5"><h2 className="font-bold">Control financiero</h2><dl className="mt-4 divide-y text-sm"><Line label="Ventas" value={summary.ventas} /><Line label="Costo de ventas" value={summary.costoVentas} /><Line label="Utilidad bruta" value={summary.utilidadBruta} strong /><Line label="Gastos operativos" value={summary.gastosOperativos} /><Line label="Utilidad neta" value={summary.utilidadNeta} strong /><Line label="Compras del período" value={summary.compras} /><Line label="Cuentas por cobrar" value={summary.cuentasPorCobrar} /></dl></div></section>
    <section className="overflow-hidden border bg-white"><div className="border-b p-4"><h2 className="font-bold">Registro de entradas y salidas</h2><p className="text-sm text-slate-500">Vista de control tipo debe/haber; no sustituye un libro contable fiscal.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-100 text-left"><tr><th className="p-4">Fecha</th><th>Concepto</th><th>Tipo</th><th className="text-right">Debe (salida)</th><th className="p-4 text-right">Haber (entrada)</th></tr></thead><tbody className="divide-y">{ledger.map((row,index) => <tr key={`${row.fecha}-${row.concepto}-${index}`}><td className="p-4">{row.fecha ? new Date(row.fecha).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' }) : '—'}</td><td>{row.concepto}</td><td>{row.tipo}</td><td className="text-right text-red-600">{row.debe ? money.format(row.debe) : '—'}</td><td className="p-4 text-right text-emerald-700">{row.haber ? money.format(row.haber) : '—'}</td></tr>)}</tbody></table></div>{!loading && !ledger.length && <p className="p-8 text-center text-sm text-slate-500">No hay movimientos en el período seleccionado.</p>}</section>
  </div>;
}
function Card({ icon: Icon, label, value, percent, emphasis }) { return <article className={`border bg-white p-4 ${emphasis ? 'border-l-4 border-l-[var(--branch-color)]' : ''}`}><Icon className="h-5 w-5 text-[var(--branch-color)]" /><p className="mt-3 text-sm text-slate-500">{label}</p><strong className="mt-1 block text-2xl">{percent ? `${Number(value || 0).toFixed(2)}%` : money.format(value || 0)}</strong></article>; }
function Line({ label, value, strong }) { return <div className={`flex justify-between gap-3 py-3 ${strong ? 'font-bold' : ''}`}><dt>{label}</dt><dd>{money.format(value || 0)}</dd></div>; }
