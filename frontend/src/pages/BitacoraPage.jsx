import { useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, PackageSearch, RotateCcw, Search, ScrollText, UserRoundSearch } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import NotificationToast from '../components/NotificationToast';
import { useAuth } from '../context/AuthContext';
import { formatGuatemalaDateTime, guatemalaInputDate } from '../utils/guatemalaDate';

const now = new Date();
const today = guatemalaInputDate(now);
const monthStart = `${today.slice(0, 7)}-01`;
const activityInitial = { texto: '', idUsuario: '', idSucursal: '', modulo: '', accion: '', resultado: '', fechaDesde: monthStart, fechaHasta: today };
const modules = ['Seguridad', 'Ventas', 'Inventarios', 'Facturación', 'Cobros', 'Operaciones', 'Trabajadores', 'Datos maestros'];
const formatDate = formatGuatemalaDateTime;
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

export default function BitacoraPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = requestedTab === 'productos' || requestedTab === 'trabajadores' ? requestedTab : 'usuarios';
  return <div className="space-y-5">
    <header className="page-title p-5"><h1 className="text-2xl font-bold">Bitácora e histórico</h1><p className="mt-1 text-sm text-slate-500">Consulta las acciones de usuarios y el recorrido de los productos.</p></header>
    <nav className="flex flex-wrap gap-2 border-b bg-white px-4 pt-3"><Tab active={tab === 'usuarios'} onClick={() => setSearchParams({ tab: 'usuarios' })} icon={ScrollText}>Acciones de usuarios</Tab><Tab active={tab === 'productos'} onClick={() => setSearchParams({ tab: 'productos' })} icon={PackageSearch}>Movimientos de productos</Tab><Tab active={tab === 'trabajadores'} onClick={() => setSearchParams({ tab: 'trabajadores' })} icon={UserRoundSearch}>Histórico de trabajadores</Tab></nav>
    {tab === 'productos' ? <ProductMovements initialProductId={Number(searchParams.get('producto')) || ''} initialQuery={searchParams.get('buscar') || ''} /> : tab === 'trabajadores' ? <WorkerHistory /> : <UserActivity />}
  </div>;
}

function Tab({ active, onClick, icon: Icon, children }) { return <button onClick={onClick} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${active ? 'border-[var(--branch-color)] text-[var(--branch-color)]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Icon className="h-4 w-4" />{children}</button>; }

function UserActivity() {
  const { sucursales } = useAuth();
  const [filters, setFilters] = useState(activityInitial);
  const [applied, setApplied] = useState(activityInitial);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null);
  const size = 25;
  const load = useCallback(async (selected, requestedPage) => {
    try {
      const params = { ...selected, pagina: requestedPage, tamanoPagina: size };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const response = await axiosClient.get('/bitacora', { params });
      setRows(response.data.data?.registros || []);
      setTotal(response.data.data?.total || 0);
    } catch (error) { setNotice({ type: 'error', message: error.response?.data?.message || 'No fue posible consultar la bitácora.' }); }
  }, []);
  useEffect(() => { load(applied, page); }, [applied, page, load]);
  const search = () => { setPage(1); setApplied({ ...filters }); };
  const clear = () => { setFilters(activityInitial); setApplied(activityInitial); setPage(1); };
  const pages = Math.max(1, Math.ceil(total / size));
  return <><NotificationToast notification={notice} onClose={() => setNotice(null)} /><section className="border bg-white p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input className="input" value={filters.texto} onChange={e => setFilters({ ...filters, texto: e.target.value })} placeholder="Usuario, ruta o detalle" /><select className="input" value={filters.idSucursal} onChange={e => setFilters({ ...filters, idSucursal: e.target.value })}><option value="">Todas las sucursales</option>{sucursales.map(s => <option key={s.idSucursal} value={s.idSucursal}>{s.nombreSuc}</option>)}</select><select className="input" value={filters.modulo} onChange={e => setFilters({ ...filters, modulo: e.target.value })}><option value="">Todos los módulos</option>{modules.map(item => <option key={item} value={item}>{item}</option>)}</select><select className="input" value={filters.resultado} onChange={e => setFilters({ ...filters, resultado: e.target.value })}><option value="">Todos los resultados</option><option value="Exitoso">Exitosos</option><option value="Fallido">Fallidos</option></select><input className="input" value={filters.accion} onChange={e => setFilters({ ...filters, accion: e.target.value })} placeholder="Acción" /><DateFilter label="Desde" value={filters.fechaDesde} set={value => setFilters({ ...filters, fechaDesde: value })} /><DateFilter label="Hasta" value={filters.fechaHasta} set={value => setFilters({ ...filters, fechaHasta: value })} /><FilterButtons search={search} clear={clear} /></div></section><section className="overflow-x-auto border bg-white"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-100 text-left"><tr>{['Fecha','Usuario','Sucursal','Módulo','Descripción','Resultado','IP'].map(h => <th className="px-3 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.idBitacora} className="border-t hover:bg-slate-50"><td className="whitespace-nowrap px-3 py-3">{formatDate(row.fecha)}</td><td className="px-3 py-3 font-semibold">{row.usuario}</td><td className="px-3 py-3">{row.sucursal || '—'}</td><td className="px-3 py-3">{row.modulo}</td><td className="max-w-[390px] px-3 py-3"><b className="block">{row.accion}</b><small className="text-slate-500">{row.detalle || row.ruta}</small></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.resultado === 'Exitoso' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{row.resultado}</span><small className="ml-2 text-slate-500">{row.codigoHttp}</small></td><td className="px-3 py-3">{row.direccionIp || '—'}</td></tr>)}</tbody></table>{!rows.length && <Empty />}<Pagination page={page} pages={pages} total={total} setPage={setPage} /></section></>;
}

function ProductMovements({ initialProductId, initialQuery }) {
  const { sucursales } = useAuth();
  const makeInitial = () => ({ query: initialQuery, idProducto: initialProductId, idSucursal: '', tipo: '', fechaDesde: '', fechaHasta: '' });
  const [filters, setFilters] = useState(makeInitial);
  const [applied, setApplied] = useState(makeInitial);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null);
  const size = 30;
  const load = useCallback(async (selected, requestedPage) => {
    try {
      const params = { ...selected, pagina: requestedPage, tamanoPagina: size };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const response = await axiosClient.get('/inventario/movimientos', { params });
      setRows(response.data.data?.registros || []);
      setTotal(response.data.data?.total || 0);
    } catch (error) { setNotice({ type: 'error', message: error.response?.data?.message || 'No fue posible consultar los movimientos de productos.' }); }
  }, []);
  useEffect(() => { load(applied, page); }, [applied, page, load]);
  const search = () => { setPage(1); setApplied({ ...filters }); };
  const clear = () => { const empty = { query: '', idProducto: '', idSucursal: '', tipo: '', fechaDesde: '', fechaHasta: '' }; setFilters(empty); setApplied(empty); setPage(1); };
  const pages = Math.max(1, Math.ceil(total / size));
  return <><NotificationToast notification={notice} onClose={() => setNotice(null)} /><section className="border bg-white p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input className="input" value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value, idProducto: '' })} placeholder="Producto, código, documento o detalle" /><select className="input" value={filters.idSucursal} onChange={e => setFilters({ ...filters, idSucursal: e.target.value })}><option value="">Todas las sucursales</option>{sucursales.map(s => <option key={s.idSucursal} value={s.idSucursal}>{s.nombreSuc}</option>)}</select><select className="input" value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })}><option value="">Todos los movimientos</option><option value="entrada">Todas las entradas</option><option value="salida">Todas las salidas</option><option value="entrada de pedido">Entradas de pedido</option><option value="venta">Ventas</option><option value="anulación de venta">Anulaciones</option><option value="traslado enviado">Traslados enviados</option><option value="traslado recibido">Traslados recibidos</option><option value="salida de inventario">Salidas manuales</option></select><div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600"><b>{total}</b> movimientos encontrados</div><DateFilter label="Desde" value={filters.fechaDesde} set={value => setFilters({ ...filters, fechaDesde: value })} /><DateFilter label="Hasta" value={filters.fechaHasta} set={value => setFilters({ ...filters, fechaHasta: value })} /><div className="xl:col-span-2"><FilterButtons search={search} clear={clear} /></div></div></section><section className="overflow-x-auto border bg-white"><table className="w-full min-w-[1180px] text-sm"><thead className="bg-slate-100 text-left"><tr>{['Fecha','Producto','Sucursal','Movimiento','Cantidad','Documento','Detalle','Usuario'].map(h => <th className="px-3 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <ProductMovementRow key={row.idMovimiento} row={row} />)}</tbody></table>{!rows.length && <Empty text="No hay movimientos de productos para los filtros seleccionados." />}<Pagination page={page} pages={pages} total={total} setPage={setPage} /></section></>;
}

function ProductMovementRow({ row }) {
  const incoming = row.direccion === 'Entrada';
  const Icon = incoming ? ArrowDownCircle : ArrowUpCircle;
  return <tr className="border-t hover:bg-slate-50"><td className="whitespace-nowrap px-3 py-3">{formatDate(row.fecha)}</td><td className="px-3 py-3"><b className="block">{row.producto}</b><small className="font-mono text-slate-500">{row.codigo || `#${row.idProducto}`}</small></td><td className="px-3 py-3">{row.sucursal}</td><td className="px-3 py-3"><span className={`inline-flex items-center gap-2 font-semibold ${incoming ? 'text-emerald-700' : 'text-red-600'}`}><Icon className="h-4 w-4" />{row.tipo}</span></td><td className={`px-3 py-3 text-base font-bold ${incoming ? 'text-emerald-700' : 'text-red-600'}`}>{incoming ? '+' : '-'}{row.cantidad}</td><td className="px-3 py-3 font-mono text-xs">{row.documento || '—'}</td><td className="max-w-[360px] px-3 py-3 text-slate-600">{row.detalle || '—'}</td><td className="px-3 py-3">{row.usuario || 'Sistema'}</td></tr>;
}

function WorkerHistory() {
  const { sucursales } = useAuth();
  const initial = { query: '', idSucursal: '', tipo: '', fechaDesde: '', fechaHasta: '' };
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null);
  const size = 30;
  const load = useCallback(async (selected, requestedPage) => {
    try {
      const params = { ...selected, pagina: requestedPage, tamanoPagina: size };
      Object.keys(params).forEach(key => params[key] === '' && delete params[key]);
      const response = await axiosClient.get('/trabajadores/historico', { params });
      setRows(response.data.data?.registros || []);
      setTotal(response.data.data?.total || 0);
    } catch (error) { setNotice({ type: 'error', message: error.response?.data?.message || 'No fue posible consultar el histórico de trabajadores.' }); }
  }, []);
  useEffect(() => { load(applied, page); }, [applied, page, load]);
  const search = () => { setPage(1); setApplied({ ...filters }); };
  const clear = () => { setFilters(initial); setApplied(initial); setPage(1); };
  const pages = Math.max(1, Math.ceil(total / size));
  return <><NotificationToast notification={notice} onClose={() => setNotice(null)} /><section className="border bg-white p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input className="input" value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} placeholder="Trabajador, recibo, cliente o detalle" /><select className="input" value={filters.idSucursal} onChange={e => setFilters({ ...filters, idSucursal: e.target.value })}><option value="">Todas las sucursales</option>{sucursales.map(s => <option key={s.idSucursal} value={s.idSucursal}>{s.nombreSuc}</option>)}</select><select className="input" value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })}><option value="">Todos los eventos</option><option value="registro">Registros</option><option value="edición">Ediciones</option><option value="desactivación">Desactivaciones</option><option value="reactivación">Reactivaciones</option><option value="cambio de sucursal">Cambios de sucursal</option><option value="venta">Ventas</option><option value="evaluación">Evaluaciones</option></select><div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600"><b>{total}</b> eventos encontrados</div><DateFilter label="Desde" value={filters.fechaDesde} set={value => setFilters({ ...filters, fechaDesde: value })} /><DateFilter label="Hasta" value={filters.fechaHasta} set={value => setFilters({ ...filters, fechaHasta: value })} /><div className="xl:col-span-2"><FilterButtons search={search} clear={clear} /></div></div></section><section className="overflow-x-auto border bg-white"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-slate-100 text-left"><tr>{['Fecha','Trabajador','Sucursal','Evento','Documento / período','Información','Estado','Registrado por'].map(h => <th className="px-3 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <WorkerHistoryRow key={row.idEvento} row={row} />)}</tbody></table>{!rows.length && <Empty text="No hay eventos de trabajadores para los filtros seleccionados." />}<Pagination page={page} pages={pages} total={total} setPage={setPage} /></section></>;
}

function WorkerHistoryRow({ row }) {
  const negative = row.tipo === 'Desactivación' || row.estado === 'Anulado' || row.estado === 'Inactivo';
  return <tr className="border-t hover:bg-slate-50"><td className="whitespace-nowrap px-3 py-3">{formatDate(row.fecha)}</td><td className="px-3 py-3 font-semibold">{row.trabajador}</td><td className="px-3 py-3">{row.sucursal || '—'}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${negative ? 'bg-red-100 text-red-700' : row.tipo === 'Venta' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{row.tipo}</span></td><td className="px-3 py-3 font-mono text-xs">{row.documento || '—'}</td><td className="max-w-[360px] px-3 py-3"><span className="text-slate-600">{row.detalle || '—'}</span>{row.monto != null && <b className="mt-1 block text-emerald-700">{money.format(row.monto)}</b>}{row.puntuacion != null && <b className="mt-1 block text-blue-700">{Number(row.puntuacion).toFixed(2)} / 5</b>}</td><td className={`px-3 py-3 font-semibold ${negative ? 'text-red-600' : ''}`}>{row.estado || '—'}</td><td className="px-3 py-3">{row.usuario || 'Sistema'}</td></tr>;
}

function DateFilter({ label, value, set }) { return <label className="text-xs font-semibold text-slate-600">{label}<input className="input mt-1" type="date" value={value} onChange={e => set(e.target.value)} /></label>; }
function FilterButtons({ search, clear }) { return <div className="flex h-full items-end gap-2"><button className="button-primary flex-1" onClick={search}><Search className="h-4 w-4" />Consultar</button><button className="button-secondary" onClick={clear}><RotateCcw className="h-4 w-4" />Limpiar</button></div>; }
function Empty({ text = 'No hay movimientos para los filtros seleccionados.' }) { return <p className="p-10 text-center text-slate-500">{text}</p>; }
function Pagination({ page, pages, total, setPage }) { return <footer className="flex items-center justify-between border-t px-4 py-3 text-sm"><span>{total} registros</span><div className="flex items-center gap-2"><button className="rounded-full border p-2 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="h-4 w-4" /></button><span>Página {page} de {pages}</span><button className="rounded-full border p-2 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight className="h-4 w-4" /></button></div></footer>; }
