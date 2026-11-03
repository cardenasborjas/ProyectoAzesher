import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import NotificationToast from "../components/NotificationToast";
import LoadingIndicator from "../components/LoadingIndicator";
import { guatemalaInputDate, guatemalaMonthStart } from "../utils/guatemalaDate";
import { ArrowRight, Banknote, Boxes, CircleDollarSign, PackagePlus, ReceiptText, ShoppingCart, TrendingUp, TriangleAlert, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });
const compact = (value) => new Intl.NumberFormat("es-GT", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { selectedSucursalId, sucursales, user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [todayReceipts, setTodayReceipts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const branch = sucursales.find((item) => String(item.idSucursal) === String(selectedSucursalId));
  const branchColor = branch?.colorIdentificacion || "#008BA8";
  const chartColors = [branchColor, "#f59e0b", "#22c55e", "#8b5cf6", "#ef4444", "#64748b"];
  const displayName = user?.nombre || user?.unique_name || user?.name || "equipo";
  const load = useCallback(async () => {
    if (!selectedSucursalId) return;
    const date = guatemalaInputDate(); const monthStart = guatemalaMonthStart();
    const cacheKey = `dashboard:${selectedSucursalId}:${monthStart}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cached) { setReceipts(cached.receipts || []); setTodayReceipts(cached.todayReceipts || []); setInventory(cached.inventory || []); setLoading(false); }
    } catch { sessionStorage.removeItem(cacheKey); }
    setLoading(current => current && !receipts.length && !inventory.length);
    const monthRequest = axiosClient.get("/ventas/recibos", { params: { idSucursal: selectedSucursalId, fechaDesde: monthStart, fechaHasta: date } });
    const todayRequest = axiosClient.get("/ventas/recibos", { params: { idSucursal: selectedSucursalId, fechaDesde: date, fechaHasta: date } });
    const inventoryRequest = axiosClient.get("/inventario/productos", { params: { idSucursal: selectedSucursalId } });
    const [monthResult, todayResult, inventoryResult] = await Promise.allSettled([monthRequest, todayRequest, inventoryRequest]);
    const nextReceipts = monthResult.status === "fulfilled" ? monthResult.value.data.data || [] : receipts;
    const nextToday = todayResult.status === "fulfilled" ? todayResult.value.data.data || [] : todayReceipts;
    const nextInventory = inventoryResult.status === "fulfilled" ? inventoryResult.value.data.data || [] : inventory;
    setReceipts(nextReceipts); setTodayReceipts(nextToday); setInventory(nextInventory); setLoading(false);
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ receipts: nextReceipts, todayReceipts: nextToday, inventory: nextInventory, savedAt: Date.now() })); } catch { /* La caché es opcional. */ }
    if ([monthResult, todayResult, inventoryResult].some(result => result.status === "rejected")) setNotification({ type: "warning", message: "Algunos datos del resumen no pudieron actualizarse; se muestra la última información disponible." });
  }, [selectedSucursalId]);
  useEffect(() => { load(); }, [load]);
  const validMonth = receipts.filter((row) => row.estado !== "Anulado");
  const validToday = todayReceipts.filter((row) => row.estado !== "Anulado");
  const metrics = useMemo(() => ({
    today: validToday.reduce((sum, row) => sum + row.monto, 0), month: validMonth.reduce((sum, row) => sum + row.monto, 0),
    average: validMonth.length ? validMonth.reduce((sum, row) => sum + row.monto, 0) / validMonth.length : 0,
    units: inventory.reduce((sum, row) => sum + row.stock, 0), low: inventory.filter((row) => row.stock <= 5).length,
  }), [validMonth, validToday, inventory]);
  const daily = Object.values(validMonth.reduce((map, row) => { const key = new Date(row.fechaPago).toLocaleDateString("es-GT", { day: "2-digit", month: "short" }); map[key] ||= { label: key, value: 0 }; map[key].value += row.monto; return map; }, {})).slice(-12);
  const methods = Object.values(validMonth.reduce((map, row) => { const key = row.metodoPago || "Sin definir"; map[key] ||= { label: key, value: 0 }; map[key].value += row.monto; return map; }, {})).sort((a, b) => b.value - a.value);
  const sellers = Object.values(validMonth.reduce((map, row) => { const key = row.vendedorNombre || "Sin vendedor"; map[key] ||= { label: key, value: 0 }; map[key].value += row.monto; return map; }, {})).sort((a, b) => b.value - a.value).slice(0, 5);
  const shortcuts = [[ShoppingCart, "Nueva venta", "/ventas"], [ReceiptText, "Buscar recibos", "/ventas/recibos"], [Banknote, "Registrar abono", "/cobros/pagar"], [PackagePlus, "Entrada de pedido", "/inventarios/entrada-pedido"], [Users, "Clientes", "/clientes/listado"], [Boxes, "Inventario", "/inventarios/productos"]];
  return <div className="space-y-6">
    <NotificationToast notification={notification} onClose={() => setNotification(null)} />
    {loading && <div className="relative min-h-24"><LoadingIndicator label="Actualizando resumen del negocio…" /></div>}
    <header className="dashboard-welcome"><div><p className="dashboard-eyebrow">{branch?.nombreSuc || "Resumen"}</p><h1>{displayName}</h1><p>Este es el movimiento de tu negocio al día de hoy.</p></div><button onClick={load} className="button-secondary">Actualizar datos</button></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={CircleDollarSign} label="Ventas de hoy" value={money.format(metrics.today)} note={`${validToday.length} pagos recibidos`} tone="teal" />
      <Metric icon={TrendingUp} label="Ventas del mes" value={money.format(metrics.month)} note={`Promedio ${money.format(metrics.average)}`} tone="blue" />
      <Metric icon={Boxes} label="Unidades disponibles" value={metrics.units} note={`${inventory.length} productos registrados`} tone="violet" />
      <Metric icon={TriangleAlert} label="Existencia baja" value={metrics.low} note="Productos con 5 unidades o menos" tone={metrics.low ? "amber" : "green"} />
    </section>
    <section className="panel-card p-5"><div className="section-heading"><div><h2>Accesos rápidos</h2><p>Las tareas que más utilizas, a un clic.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{shortcuts.map(([Icon, label, path]) => <button key={path} onClick={() => navigate(path)} className="quick-action"><Icon className="h-5 w-5" /><span>{label}</span><ArrowRight className="ml-auto h-4 w-4" /></button>)}</div></section>
    <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <ChartCard title="Comportamiento de ventas" subtitle="Últimos movimientos del mes"><ResponsiveContainer width="100%" height={300}><AreaChart data={daily}><CartesianGrid stroke="#e7edf3" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis tickFormatter={compact} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => money.format(value)} /><Area type="monotone" dataKey="value" name="Ventas" stroke={branchColor} strokeWidth={3} fill={branchColor} fillOpacity={0.16} activeDot={{ r: 6, fill: branchColor }} /></AreaChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Formas de pago" subtitle="Distribución del mes"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={methods} dataKey="value" nameKey="label" innerRadius={68} outerRadius={100} paddingAngle={3}>{methods.map((row, index) => <Cell key={row.label} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => money.format(value)} /><Legend /></PieChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Vendedores destacados" subtitle="Comparativa por monto vendido"><ResponsiveContainer width="100%" height={280}><BarChart data={sellers} layout="vertical" margin={{ left: 16 }}><CartesianGrid stroke="#e7edf3" horizontal={false} /><XAxis type="number" tickFormatter={compact} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={105} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => money.format(value)} /><Bar dataKey="value" name="Ventas" fill={branchColor} radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartCard>
      <section className="panel-card overflow-hidden"><div className="section-heading p-5"><div><h2>Pagos de hoy</h2><p>{validToday.length} movimientos registrados.</p></div><button onClick={() => navigate("/ventas/recibos")} className="text-link">Ver todos</button></div><div className="divide-y">{validToday.slice(0, 6).map((row) => <div key={row.idRecibo} className="flex items-center justify-between gap-3 px-5 py-3"><div><b className="text-sm">{row.clienteNombre}</b><p className="text-xs capitalize text-slate-500">{row.numeroRecibo} · {row.metodoPago}</p></div><b className="text-sm text-emerald-700">{money.format(row.monto)}</b></div>)}{!validToday.length && <p className="p-8 text-center text-sm text-slate-500">Todavía no hay pagos registrados hoy.</p>}</div></section>
    </section>
  </div>;
}
function Metric({ icon: Icon, label, value, note, tone }) { return <article className={`metric-card metric-${tone}`}><div className="metric-icon"><Icon className="h-5 w-5" /></div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>; }
function ChartCard({ title, subtitle, children }) { return <section className="panel-card p-5"><div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</section>; }
