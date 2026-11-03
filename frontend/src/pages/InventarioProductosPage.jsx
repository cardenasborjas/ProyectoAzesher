import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, Barcode, Download, FileSpreadsheet, History, PackageX, Pencil, Search, X } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import NotificationToast from '../components/NotificationToast';
import ProductBarcodeModal from '../components/ProductBarcodeModal';
import { useAuth } from '../context/AuthContext';

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const dateTime = new Intl.DateTimeFormat('es-GT', { dateStyle: 'short', timeStyle: 'short' });

export default function InventarioProductosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedSucursalId, sucursales, isAdministrator } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [notification, setNotification] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(new Date());
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState(null);
  const [priceEditor, setPriceEditor] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  const branch = useMemo(() => sucursales.find(item => String(item.idSucursal) === String(selectedSucursalId)), [selectedSucursalId, sucursales]);
  const totals = useMemo(() => ({
    units: products.reduce((sum, product) => sum + product.stock, 0),
    low: products.filter(product => product.stock > 0 && product.stock <= 5).length,
    empty: products.filter(product => product.stock <= 0).length,
    value: products.reduce((sum, product) => sum + product.stock * product.precio, 0),
  }), [products]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadInventory = useCallback(async (query = '') => {
    if (!selectedSucursalId) return;
    setLoading(true);
    try {
      const response = await axiosClient.get('/inventario/productos', { params: { idSucursal: selectedSucursalId, query } });
      const inventory = response.data.data ?? [];
      setProducts(inventory);
      setSelectedProduct(current => current && inventory.some(item => item.idProducto === current.idProducto) ? current : null);
      setLastUpdated(new Date());
    } catch (error) {
      setProducts([]);
      setNotification({ type: 'error', message: error.response?.data?.message || 'No fue posible cargar el inventario.' });
    } finally {
      setLoading(false);
    }
  }, [selectedSucursalId]);

  useEffect(() => {
    setSearch('');
    setAppliedSearch('');
    setSelectedProduct(null);
    setMovements([]);
    loadInventory('');
  }, [loadInventory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = search.trim();
      setAppliedSearch(query);
      loadInventory(query);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, loadInventory]);

  useEffect(() => {
    const productId = Number(searchParams.get('producto'));
    if (!productId || !products.length || priceEditor) return;
    const product = products.find(item => item.idProducto === productId);
    if (product) { setPriceEditor(product); setNewPrice(String(product.precioSolicitado ?? product.precio)); }
  }, [products, searchParams, priceEditor]);

  const openPrice = (event, product) => {
    event?.stopPropagation();
    if (isAdministrator && !product.idSolicitudPrecio) {
      navigate(`/configuracion/datos-maestros?entidad=productos&editar=${product.idProducto}`);
      return;
    }
    setPriceEditor(product);
    setNewPrice(String(product.precioSolicitado ?? product.precio));
  };
  const closePrice = () => { setPriceEditor(null); setNewPrice(''); if (searchParams.has('producto')) { const next = new URLSearchParams(searchParams); next.delete('producto'); next.delete('solicitudPrecio'); setSearchParams(next, { replace: true }); } };
  const savePrice = async () => {
    const price = Number(newPrice);
    if (!Number.isFinite(price) || price <= 0) return setNotification({ type: 'warning', message: 'Ingresa un precio de venta mayor que cero.' });
    if (priceEditor.costoUltimaCompra != null && price <= Number(priceEditor.costoUltimaCompra)) return setNotification({ type: 'warning', message: 'El precio de venta debe ser mayor que el último costo de compra.' });
    setSavingPrice(true);
    try { const response = await axiosClient.put(`/inventario/productos/${priceEditor.idProducto}/precio`, { precio: price }); setNotification({ type: 'success', message: response.data.message }); closePrice(); await loadInventory(appliedSearch); window.dispatchEvent(new Event('notifications-refresh')); }
    catch (error) { setNotification({ type: 'error', message: error.response?.data?.message || 'No fue posible procesar el cambio de precio.' }); }
    finally { setSavingPrice(false); }
  };
  const resolvePrice = async aprobar => {
    setSavingPrice(true);
    try { const response = await axiosClient.post(`/inventario/productos/precio-solicitudes/${priceEditor.idSolicitudPrecio}/resolver`, { aprobar }); setNotification({ type: 'success', message: response.data.message }); closePrice(); await loadInventory(appliedSearch); window.dispatchEvent(new Event('notifications-refresh')); }
    catch (error) { setNotification({ type: 'error', message: error.response?.data?.message || 'No fue posible resolver la solicitud.' }); }
    finally { setSavingPrice(false); }
  };

  const selectProduct = async product => {
    if (selectedProduct?.idProducto === product.idProducto) {
      setSelectedProduct(null);
      setMovements([]);
      return;
    }
    setSelectedProduct(product);
    setMovements([]);
    setLoadingMovements(true);
    try {
      const response = await axiosClient.get('/inventario/movimientos', { params: { idSucursal: selectedSucursalId, idProducto: product.idProducto, pagina: 1, tamanoPagina: 10 } });
      setMovements(response.data.data?.registros || []);
    } catch (error) {
      setNotification({ type: 'error', message: error.response?.data?.message || 'No fue posible cargar los movimientos del producto.' });
    } finally {
      setLoadingMovements(false);
    }
  };

  const downloadReport = async format => {
    setExporting(format);
    try {
      const response = await axiosClient.get(`/inventario/reporte/${format}`, { params: { idSucursal: selectedSucursalId, query: appliedSearch }, responseType: 'blob' });
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `inventario_${branch?.nombreSuc || branch?.nombre || selectedSucursalId}_${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotification({ type: 'success', message: `Reporte ${extension.toUpperCase()} generado correctamente.` });
    } catch (error) {
      setNotification({ type: 'error', message: error.response?.data?.message || 'No fue posible generar el reporte.' });
    } finally {
      setExporting('');
    }
  };

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <NotificationToast notification={notification} onClose={() => setNotification(null)} />
    <section className="page-title p-5 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Inventario · {branch?.nombreSuc || branch?.nombre || 'Sucursal'}</h1><p className="mt-1 text-sm text-slate-500">Selecciona un producto para consultar sus movimientos recientes.</p></div><div className="min-w-[260px] border-l-4 border-[var(--branch-color)] bg-white/60 px-4 py-3 text-sm"><span className="font-semibold text-slate-800">{dateTime.format(now)}</span><span className="mt-1 block text-xs text-slate-500">Actualizado: {lastUpdated ? dateTime.format(lastUpdated) : 'Pendiente'}</span></div></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Productos" value={products.length} detail={`${totals.units} unidades`} /><Metric label="Valor registrado" value={currency.format(totals.value)} detail="Según precio actual" /><Metric label="Existencia baja" value={totals.low} detail="Entre 1 y 5 unidades" /><Metric label="Sin existencias" value={totals.empty} detail="Productos con stock cero" /></section>
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex w-full max-w-2xl gap-2"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100" placeholder="Código, nombre o descripción del producto" /></label></div><div className="flex gap-2"><button disabled={loading || exporting !== ''} onClick={() => downloadReport('pdf')} className="button-secondary"><Download className="h-4 w-4" />{exporting === 'pdf' ? 'Generando…' : 'PDF'}</button><button disabled={loading || exporting !== ''} onClick={() => downloadReport('excel')} className="button-secondary"><FileSpreadsheet className="h-4 w-4" />{exporting === 'excel' ? 'Generando…' : 'Excel'}</button></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">Código</th><th className="px-5 py-3">Producto</th><th className="px-5 py-3">Descripción</th><th className="px-5 py-3 text-right">Último costo</th><th className="px-5 py-3 text-right">Precio venta</th><th className="px-5 py-3 text-center">Existencia</th><th className="px-5 py-3 text-right">Valor</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Precio</th></tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? <tr><td colSpan="9" className="px-5 py-16 text-center text-slate-500">Consultando inventario…</td></tr> : products.length === 0 ? <tr><td colSpan="9" className="px-5 py-16 text-center"><PackageX className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-semibold text-slate-700">No se encontró existencia para esta búsqueda</p><p className="mt-1 text-xs text-slate-500">Verifica el código o consulta el listado completo.</p></td></tr> : products.map(product => <tr key={product.idInventario} onClick={() => selectProduct(product)} className={`cursor-pointer transition ${selectedProduct?.idProducto === product.idProducto ? 'bg-cyan-50 ring-1 ring-inset ring-[var(--branch-color)]' : 'hover:bg-slate-50'}`} title="Seleccionar para ver movimientos"><td className="px-5 py-4 font-mono text-xs text-slate-500">{product.codigo || `#${product.idProducto}`}</td><td className="px-5 py-4 font-semibold text-slate-900">{product.nombre}</td><td className="max-w-xs truncate px-5 py-4 text-slate-500" title={product.descripcion}>{product.descripcion || '—'}</td><td className="px-5 py-4 text-right text-slate-600">{product.costoUltimaCompra == null ? '—' : currency.format(product.costoUltimaCompra)}</td><td className="px-5 py-4 text-right"><b>{currency.format(product.precio)}</b>{product.idSolicitudPrecio && <span className="mt-1 block text-xs text-amber-700">Solicitud: {currency.format(product.precioSolicitado)}</span>}</td><td className="px-5 py-4 text-center text-base font-bold text-slate-800">{product.stock}</td><td className="px-5 py-4 text-right font-medium">{currency.format(product.stock * product.precio)}</td><td className="px-5 py-4"><StockBadge stock={product.stock} /></td><td className="px-5 py-4 text-right"><button type="button" onClick={event => openPrice(event, product)} className="button-secondary ml-auto whitespace-nowrap"><Pencil className="h-4 w-4" />{product.idSolicitudPrecio && isAdministrator ? 'Revisar' : 'Cambiar'}</button></td></tr>)}
      </tbody></table></div>
      {selectedProduct && <RecentMovements product={selectedProduct} rows={movements} loading={loadingMovements} canViewAll={isAdministrator} onBarcodes={() => setBarcodeProduct(selectedProduct)} close={() => { setSelectedProduct(null); setMovements([]); }} viewAll={() => navigate(`/bitacora?tab=productos&producto=${selectedProduct.idProducto}&buscar=${encodeURIComponent(selectedProduct.nombre)}`)} />}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500"><span>{appliedSearch ? `Resultado para “${appliedSearch}”` : 'Listado completo de la sucursal'}</span><span>{products.length} registros</span></div>
    </section>
    {barcodeProduct && <ProductBarcodeModal product={barcodeProduct} onClose={() => setBarcodeProduct(null)} onChanged={() => loadInventory(appliedSearch)} onNotify={(type, message) => setNotification({ type, message })} />}
    {priceEditor && <PriceModal product={priceEditor} value={newPrice} setValue={setNewPrice} admin={isAdministrator} saving={savingPrice} close={closePrice} save={savePrice} resolve={resolvePrice} />}
  </div>;
}

function PriceModal({ product, value, setValue, admin, saving, close, save, resolve }) {
  const pendingReview = admin && product.idSolicitudPrecio;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><section className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><header className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{pendingReview ? 'Revisar cambio de precio' : admin ? 'Cambiar precio de venta' : 'Solicitar cambio de precio'}</h2><p className="mt-1 text-sm text-slate-500">{product.nombre}</p></div><button onClick={close}><X className="h-5 w-5" /></button></header><div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm"><div><span className="block text-slate-500">Último costo</span><b>{product.costoUltimaCompra == null ? 'Sin compras' : currency.format(product.costoUltimaCompra)}</b></div><div><span className="block text-slate-500">Precio actual</span><b>{currency.format(product.precio)}</b></div></div>{pendingReview && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{product.solicitantePrecio} solicita cambiarlo a <b>{currency.format(product.precioSolicitado)}</b>.</p>}<label className="mt-4 block text-sm font-semibold">Nuevo precio de venta<input type="number" min="0.01" step="0.01" value={value} disabled={pendingReview} onChange={event => setValue(event.target.value)} className="input mt-1" /></label><p className="mt-2 text-xs text-slate-500">Debe ser mayor que el último costo de compra para mantener una ganancia positiva.</p><footer className="mt-6 flex flex-wrap justify-end gap-2"><button className="button-secondary" onClick={close}>Cancelar</button>{pendingReview ? <><button disabled={saving} className="rounded-md border border-red-200 px-4 py-2 font-semibold text-red-600" onClick={() => resolve(false)}>Rechazar</button><button disabled={saving} className="button-primary" onClick={() => resolve(true)}>Aprobar cambio</button></> : <button disabled={saving} className="button-primary" onClick={save}>{admin ? 'Guardar precio' : 'Enviar solicitud'}</button>}</footer></section></div>;
}

function RecentMovements({ product, rows, loading, canViewAll, onBarcodes, close, viewAll }) {
  return <section className="border-t-2 border-[var(--branch-color)] bg-slate-50 p-5"><header className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--branch-color)]">Últimos movimientos</p><h2 className="mt-1 text-lg font-bold text-slate-900">{product.nombre}</h2><p className="text-xs text-slate-500">{product.codigo || `Producto #${product.idProducto}`} · Existencia actual: {product.stock}</p></div><div className="flex flex-wrap gap-2"><button className="button-primary" onClick={onBarcodes}><Barcode className="h-4 w-4" />Códigos de barras</button>{canViewAll && <button className="button-secondary" onClick={viewAll}><History className="h-4 w-4" />Ver histórico completo</button>}<button className="rounded-full border bg-white p-2" onClick={close} title="Cerrar"><X className="h-4 w-4" /></button></div></header>{loading ? <p className="py-8 text-center text-sm text-slate-500">Cargando movimientos…</p> : rows.length ? <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-100 text-left"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Movimiento</th><th className="px-4 py-3">Cantidad</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Detalle</th><th className="px-4 py-3">Usuario</th></tr></thead><tbody className="divide-y">{rows.map(row => <MovementRow key={row.idMovimiento} row={row} />)}</tbody></table></div> : <p className="rounded-lg border bg-white py-8 text-center text-sm text-slate-500">Este producto todavía no tiene movimientos registrados.</p>}</section>;
}

function MovementRow({ row }) {
  const incoming = row.direccion === 'Entrada';
  const Icon = incoming ? ArrowDownCircle : ArrowUpCircle;
  return <tr><td className="whitespace-nowrap px-4 py-3">{dateTime.format(new Date(row.fecha))}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-2 font-semibold ${incoming ? 'text-emerald-700' : 'text-red-600'}`}><Icon className="h-4 w-4" />{row.tipo}</span></td><td className={`px-4 py-3 font-bold ${incoming ? 'text-emerald-700' : 'text-red-600'}`}>{incoming ? '+' : '-'}{row.cantidad}</td><td className="px-4 py-3 font-mono text-xs">{row.documento || '—'}</td><td className="max-w-sm px-4 py-3 text-slate-600">{row.detalle || '—'}</td><td className="px-4 py-3">{row.usuario || 'Sistema'}</td></tr>;
}

function Metric({ label, value, detail }) { return <div className="border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; }
function StockBadge({ stock }) { if (stock <= 0) return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Sin existencias</span>; if (stock <= 5) return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Existencia baja</span>; return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Disponible</span>; }
