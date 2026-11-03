import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Camera, Search, Trash2, Plus, Building2, Smartphone, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { buildReceiptPdfPayload, buildReceiptPreview, validateAddItem, validateGenerateReceipt } from '../middleware/ventasValidations';
import { getSalesDraft, saveSalesDraft } from '../state/ventasDraftStore';
import NotificationToast from '../components/NotificationToast';
import PaymentMethodsPanel from '../components/PaymentMethodsPanel';
import CreditCustomerModal from '../components/CreditCustomerModal';
import PhoneScannerModal from '../components/PhoneScannerModal';
import MobileCameraScannerModal from '../components/MobileCameraScannerModal';
import { guatemalaInputDate } from '../utils/guatemalaDate';

const money = new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
});

export default function VentasPage() {
    const initialDraft = getSalesDraft();
    const navigate = useNavigate();
    const { selectedSucursalId, sucursales, setIsSucursalLocked } = useAuth();
    const [productQuery, setProductQuery] = useState(() => initialDraft?.productQuery ?? '');
    const [productResults, setProductResults] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(() => initialDraft?.selectedProduct ?? null);
    const [quantity, setQuantity] = useState(() => initialDraft?.quantity ?? 1);
    const [cartItems, setCartItems] = useState(() => initialDraft?.cartItems ?? []);

    const [clientQuery, setClientQuery] = useState(() => initialDraft?.clientQuery ?? '');
    const [clientResults, setClientResults] = useState([]);
    const [selectedClient, setSelectedClient] = useState(() => initialDraft?.selectedClient ?? null);
    const [customer, setCustomer] = useState(() => initialDraft?.customer ?? { nit: '', nombre: '', domicilio: '', telefono: '' });

    const [paymentMethod, setPaymentMethod] = useState(() => initialDraft?.paymentMethod ?? 'efectivo');
    const [paymentDetails, setPaymentDetails] = useState(() => initialDraft?.paymentDetails ?? {
        currencyId: null, currencyCode: '', posId: null, reference: '', transferDate: '',
        transferBase64: null, transferMime: null, transferFileName: '',
        credit: { customer: null, installments: 1, hasInitialPayment: false, initialAmount: 0, schedule: [] },
    });
    const [currencies, setCurrencies] = useState([]);
    const [posTypes, setPosTypes] = useState([]);
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const [notification, setNotification] = useState(null);
    const [sellers, setSellers] = useState([]);
    const [selectedSellerId, setSelectedSellerId] = useState(() => initialDraft?.selectedSellerId ?? '');
    const [barcode, setBarcode] = useState('');
    const [readingBarcode, setReadingBarcode] = useState(false);
    const [phoneScannerOpen, setPhoneScannerOpen] = useState(false);
    const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
    const cartItemsRef = useRef(cartItems);

    const total = useMemo(() => cartItems.reduce((sum, item) => sum + item.subtotal, 0), [cartItems]);
    const selectedBranch = useMemo(() => sucursales.find((branch) => String(branch.idSucursal) === String(selectedSucursalId)), [sucursales, selectedSucursalId]);
    const effectiveSucursalId = selectedSucursalId;
    const saleBranch = useMemo(
        () => sucursales.find((branch) => String(branch.idSucursal) === String(effectiveSucursalId)),
        [sucursales, effectiveSucursalId],
    );
    const selectedSeller = useMemo(() => sellers.find((seller) => String(seller.idVendedor) === selectedSellerId), [sellers, selectedSellerId]);
    const showPaymentError = useCallback((message) => setNotification({ message, type: 'error' }), []);

    useEffect(() => {
        const loadPaymentCatalogs = async () => {
            try {
                const [currencyResponse, posResponse] = await Promise.all([
                    axiosClient.get('/catalogo/monedas'), axiosClient.get('/catalogo/tipos-pos'),
                ]);
                const currencyData = currencyResponse.data?.data ?? [];
                setCurrencies(currencyData);
                setPosTypes(posResponse.data?.data ?? []);
                setPaymentDetails((current) => current.currencyId ? current : {
                    ...current,
                    currencyId: currencyData.find((item) => item.codigo === 'GTQ')?.idMoneda ?? currencyData[0]?.idMoneda ?? null,
                    currencyCode: currencyData.find((item) => item.codigo === 'GTQ')?.codigo ?? currencyData[0]?.codigo ?? '',
                });
            } catch {
                setNotification({ message: 'No fue posible cargar los catálogos de pago.', type: 'error' });
            }
        };
        loadPaymentCatalogs();
    }, []);

    const creditInstallments = paymentDetails.credit.installments;
    const creditInitialAmount = paymentDetails.credit.initialAmount;
    useEffect(() => {
        const count = Math.max(1, Number(creditInstallments || 1));
        const pending = Math.max(0, total - Number(creditInitialAmount || 0));
        const baseAmount = Math.floor((pending / count) * 100) / 100;
        setPaymentDetails((current) => {
            const schedule = Array.from({ length: count }, (_, index) => {
                const existing = current.credit.schedule[index];
                const date = new Date();
                date.setMonth(date.getMonth() + index + 1);
                const amount = index === count - 1 ? Number((pending - baseAmount * (count - 1)).toFixed(2)) : baseAmount;
                return { number: index + 1, date: existing?.date || guatemalaInputDate(date), amount };
            });
            return { ...current, credit: { ...current.credit, schedule } };
        });
    }, [creditInstallments, creditInitialAmount, total]);

    useEffect(() => {
        setIsSucursalLocked(cartItems.length > 0);
        cartItemsRef.current = cartItems;
    }, [cartItems, setIsSucursalLocked]);

    useEffect(() => () => setIsSucursalLocked(false), [setIsSucursalLocked]);

    useEffect(() => {

        if (!effectiveSucursalId) {
            setSellers([]);
            return;
        }

        const loadSellers = async () => {
            try {
                const response = await axiosClient.get('/catalogo/vendedores', {
                    params: { idSucursal: effectiveSucursalId },
                });
                const branchSellers = response.data?.data ?? [];
                setSellers(branchSellers);
                setSelectedSellerId((currentId) => (
                    branchSellers.some((seller) => String(seller.idVendedor) === String(currentId)) ? currentId : ''
                ));
            } catch (error) {
                setSellers([]);
                setNotification({
                    message: error.response?.data?.message || 'No fue posible cargar los vendedores de esta sucursal.',
                    type: 'error',
                });
            }
        };
        loadSellers();
    }, [effectiveSucursalId]);

    useEffect(() => {
        const term = productQuery.trim();

        if (term.length < 2) {
            setProductResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                const response = await axiosClient.get('/catalogo/productos', {
                    params: { query: term, idSucursal: selectedSucursalId || null },
                });

                setProductResults(response.data?.data ?? []);
            } catch {
                setProductResults([]);
            }
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [productQuery, selectedSucursalId]);

    useEffect(() => {
        const term = clientQuery.trim();

        if (term.length < 2) {
            setClientResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                const response = await axiosClient.get('/catalogo/clientes', {
                    params: { query: term },
                });

                setClientResults(response.data?.data ?? []);
            } catch {
                setClientResults([]);
            }
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [clientQuery]);

    useEffect(() => {
        const creditCustomer = paymentDetails.credit.customer;
        if (paymentMethod === 'credito' && creditCustomer) {
            setCustomer((current) => ({
                ...current,
                nit: creditCustomer.nit || '',
                nombre: creditCustomer.nombre || '',
                domicilio: creditCustomer.direccion || '',
                telefono: creditCustomer.telefono || '',
            }));
            setSelectedClient(creditCustomer);
        }
    }, [paymentMethod, paymentDetails.credit.customer]);

    const selectProduct = (product) => {
        setSelectedProduct(product);
        setProductQuery(`${product.idProducto} - ${product.nombre}`);
        setProductResults([]);
        setNotification(null);
    };

    const selectClient = (client) => {
        setSelectedClient(client);
        setCustomer({
            nit: client.nit || '',
            nombre: client.nombre || '',
            domicilio: client.direccion || '',
            telefono: client.telefono || '',
        });
        setClientQuery(`${client.nit || ''} - ${client.nombre}`.trim());
        setClientResults([]);
        setNotification(null);
    };

    const addProductToCart = (product, qty = 1, source = 'Producto') => {
        const currentItems = cartItemsRef.current;
        const existingIndex = currentItems.findIndex((item) => item.idProducto === product.idProducto);
        const nextItems = [...currentItems];
        if (existingIndex >= 0) {
            const currentItem = nextItems[existingIndex];
            const updatedQuantity = currentItem.cantidad + qty;
            if (Number.isFinite(Number(product.stock)) && updatedQuantity > Number(product.stock)) {
                setNotification({
                    message: `Solo hay ${product.stock} unidades disponibles en esta sucursal.`,
                    type: 'warning',
                });
                return false;
            }
            nextItems[existingIndex] = {
                ...currentItem,
                cantidad: updatedQuantity,
                subtotal: updatedQuantity * currentItem.precioUnitario,
            };
        } else {
            nextItems.push({
                idProducto: product.idProducto,
                nombre: product.nombre,
                precioUnitario: Number(product.precio),
                cantidad: qty,
                subtotal: Number(product.precio) * qty,
                idSucursal: product.idSucursal ?? selectedSucursalId ?? null,
                nombreSucursal: product.nombreSucursal || selectedBranch?.nombreSuc || '',
            });
        }
        cartItemsRef.current = nextItems;
        setCartItems(nextItems);
        setNotification({ message: `${source} agregado al pedido.`, type: 'success' });
        return true;
    };

    const addItem = () => {
        const validationMessage = validateAddItem({ selectedProduct, quantity });
        if (validationMessage) {
            setNotification({ message: validationMessage, type: 'warning' });
            return;
        }
        if (!addProductToCart(selectedProduct, Number(quantity))) return;
        setSelectedProduct(null);
        setProductQuery('');
        setQuantity(1);
        setProductResults([]);
    };

    const addBarcode = async rawCode => {
        const code = String(rawCode || '').trim();
        if (!effectiveSucursalId) {
            setNotification({ message: 'Selecciona una sucursal antes de escanear.', type: 'warning' });
            return;
        }
        if (!code) return;
        setReadingBarcode(true);
        try {
            const response = await axiosClient.get('/catalogo/productos/por-codigo', { params: { codigo: code, idSucursal: effectiveSucursalId } });
            const product = response.data?.data;
            if (product && addProductToCart(product, 1, 'Producto escaneado')) setBarcode('');
        } catch (error) {
            setNotification({ message: error.response?.data?.message || 'No se encontró un producto con ese código.', type: 'error' });
        } finally {
            setReadingBarcode(false);
        }
    };

    const readBarcode = event => {
        event?.preventDefault();
        addBarcode(barcode);
    };

    const receivePhoneProduct = product => {
        addProductToCart(product, 1, 'Producto enviado desde el teléfono');
    };

    const clearSale = () => {
        clearSalesDraft();
        cartItemsRef.current = [];
        setCartItems([]); setProductQuery(''); setProductResults([]); setSelectedProduct(null); setQuantity(1); setBarcode('');
        setClientQuery(''); setClientResults([]); setSelectedClient(null); setCustomer({ nit: 'CF', nombre: '', domicilio: '', telefono: '' });
        setPaymentMethod('efectivo'); setSelectedSellerId('');
        setPaymentDetails(current => ({ currencyId: current.currencyId, currencyCode: current.currencyCode, posId: null, reference: '', transferDate: '', transferBase64: null, transferMime: null, transferFileName: '', credit: { customer: null, installments: 1, hasInitialPayment: false, initialAmount: 0, schedule: [] } }));
        setNotification({ type: 'success', message: 'Los datos de la venta fueron limpiados.' });
    };

    const removeItem = (idProducto) => {
        const nextItems = cartItemsRef.current.filter((item) => item.idProducto !== idProducto);
        cartItemsRef.current = nextItems;
        setCartItems(nextItems);
    };

    const handleGenerateReceipt = async () => {
        const validation = validateGenerateReceipt({
            cartItems,
            customer,
            paymentMethod,
            selectedClient,
            paymentDetails,
            selectedSeller,
        });

        if (!validation.isValid) {
            setNotification({ message: validation.message, type: 'warning' });
            return;
        }

        const receiptPreview = buildReceiptPreview({
            customer: validation.customer,
            paymentMethod,
            paymentDetails,
            total,
            cartItems,
            selectedSeller,
            selectedClient,
            selectedBranch: saleBranch,
        });

        saveSalesDraft({
            productQuery,
            selectedProduct,
            quantity,
            cartItems,
            clientQuery,
            selectedClient,
            customer,
            paymentMethod,
            paymentDetails,
            selectedSellerId,
        });

        navigate('/ventas/recibo-preview', {
            state: {
                receiptDraft: receiptPreview,
                receiptPayload: buildReceiptPdfPayload({ receipt: receiptPreview }),
            },
        });
    };

    return (
        <div className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">
            <header className="page-title flex items-center justify-between gap-3 p-5"><h1 className="text-2xl font-bold">Venta</h1><button type="button" onClick={clearSale} className="button-secondary"><RotateCcw className="h-4 w-4" />Limpiar datos</button></header>
            <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
                <section className="min-w-0 space-y-4 sm:space-y-6">
                    <div className=" border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Buscar producto</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-xs text-slate-500">Total a pagar</p>
                                    <p className="text-lg font-bold text-slate-900">{money.format(total)}</p>
                                </div>
                                <div className="rounded-full bg-teal-50 p-3 text-brand-teal"><Search className="h-5 w-5" /></div>
                            </div>
                        </div>

                        <form onSubmit={readBarcode} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="hidden flex-col gap-2 lg:flex lg:flex-row lg:items-end">
                                <label className="flex-1">
                                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Lector de código de barras</span>
                                    <span className="relative block">
                                        <Barcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                        <input autoFocus value={barcode} onChange={event => setBarcode(event.target.value)} placeholder="Escanea aquí con el lector USB o Bluetooth" autoComplete="off" className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-3 font-mono text-sm outline-none focus:border-[var(--branch-color)] focus:ring-2 focus:ring-cyan-100" />
                                    </span>
                                </label>
                                <button type="submit" disabled={readingBarcode || !barcode.trim()} className="button-primary h-11 justify-center px-5 disabled:opacity-50"><Barcode className="h-4 w-4" />{readingBarcode ? 'Buscando…' : 'Agregar código'}</button>
                                <button type="button" onClick={() => setPhoneScannerOpen(true)} disabled={!effectiveSucursalId} className="button-secondary h-11 justify-center px-5 disabled:opacity-50"><Smartphone className="h-4 w-4" />Usar teléfono</button>
                            </div>
                            <p className="mt-2 hidden text-xs text-slate-500 lg:block">El lector físico escribe el código y lo agrega al enviar Enter. El teléfono puede conectarse por QR o por enlace.</p>
                            <div className="space-y-2 lg:hidden">
                                <label className="block text-sm font-semibold text-slate-700" htmlFor="mobile-barcode">Código del producto</label>
                                <input id="mobile-barcode" value={barcode} onChange={event => setBarcode(event.target.value)} placeholder="Escanea o escribe el código" autoComplete="off" inputMode="text" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm outline-none focus:border-[var(--branch-color)]" />
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="submit" disabled={readingBarcode || !barcode.trim()} className="button-primary h-12 justify-center disabled:opacity-50"><Barcode className="h-4 w-4" />{readingBarcode ? 'Buscando…' : 'Agregar'}</button>
                                    <button type="button" onClick={() => setCameraScannerOpen(true)} disabled={!effectiveSucursalId} className="button-secondary h-12 justify-center disabled:opacity-50"><Camera className="h-4 w-4" />Usar cámara</button>
                                </div>
                            </div>
                        </form>

                        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.7fr)_minmax(5rem,0.7fr)] md:grid-cols-[minmax(0,1.7fr)_minmax(5rem,0.7fr)_auto]">
                            <div className="relative">
                                <input
                                    value={productQuery}
                                    onChange={(event) => {
                                        setProductQuery(event.target.value);
                                        setSelectedProduct(null);
                                    }}
                                    Placeholder="Buscar producto por ID o nombre"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white"
                                />
                                {productResults.length > 0 && (
                                    <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                                        {productResults.map((product) => (
                                            <button
                                                key={product.idProducto}
                                                type="button"
                                                onClick={() => selectProduct(product)}
                                                className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 last:border-b-0"
                                            >
                                                <div>
                                                    <p className="font-medium text-slate-900">{product.idProducto} - {product.nombre}</p>
                                                    <p className="text-xs text-slate-500">{product.descripcion || 'Sin descripción'}</p>
                                                </div>
                                                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-brand-teal">
                                                    {money.format(product.precio)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(event) => setQuantity(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={addItem}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-teal px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-100 transition hover:bg-teal-700 sm:col-span-2 md:col-span-1 md:w-auto"
                            >
                                <Plus className="h-4 w-4" />
                                Agregar
                            </button>
                        </div>

                        {selectedProduct && (
                            <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-teal-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-teal-900">{selectedProduct.idProducto} - {selectedProduct.nombre}</p>
                                    <p className="text-xs text-teal-700">Precio unitario: {money.format(selectedProduct.precio)}</p>
                                    <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Sucursal: {selectedProduct.nombreSucursal || selectedBranch?.nombreSuc || 'Sin sucursal'}</p>
                                </div>
                                <div className="text-sm font-semibold text-teal-900">Subtotal: {money.format(Number(selectedProduct.precio) * Number(quantity || 0))}</div>
                            </div>
                        )}
                    </div>

                    <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Pedido</h2>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{cartItems.length} líneas</span>
                        </div>

                        <div className="hidden overflow-x-auto lg:block">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3">Producto</th>
                                        <th className="px-5 py-3">Sucursal</th>
                                        <th className="px-5 py-3">Cantidad</th>
                                        <th className="px-5 py-3">Precio</th>
                                        <th className="px-5 py-3">Subtotal</th>
                                        <th className="px-5 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {cartItems.length === 0 ? (
                                        <tr>
                                            <td className="px-5 py-8 text-slate-500" colSpan="6">
                                                Aún no agregas productos al pedido.
                                            </td>
                                        </tr>
                                    ) : (
                                        cartItems.map((item) => (
                                            <tr key={item.idProducto}>
                                                <td className="px-5 py-4 font-medium text-slate-900">{item.nombre}</td>
                                                <td className="px-5 py-4 text-slate-700">{item.nombreSucursal || selectedBranch?.nombreSuc || 'Sin sucursal'}</td>
                                                <td className="px-5 py-4 text-slate-700">{item.cantidad}</td>
                                                <td className="px-5 py-4 text-slate-700">{money.format(item.precioUnitario)}</td>
                                                <td className="px-5 py-4 font-semibold text-slate-900">{money.format(item.subtotal)}</td>
                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.idProducto)}
                                                        className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Eliminar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="divide-y divide-slate-100 lg:hidden">
                            {cartItems.length === 0 ? <p className="px-4 py-8 text-sm text-slate-500">Aún no agregas productos al pedido.</p> : cartItems.map((item) => (
                                <article key={item.idProducto} className="space-y-3 p-4">
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="min-w-0"><h3 className="break-words text-sm font-semibold text-slate-900">{item.nombre}</h3><p className="mt-1 text-xs text-slate-500">{item.nombreSucursal || selectedBranch?.nombreSuc || 'Sin sucursal'}</p></div>
                                        <button type="button" onClick={() => removeItem(item.idProducto)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-red-200 text-red-600" aria-label={`Eliminar ${item.nombre}`}><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                                        <div><span className="block text-slate-500">Cantidad</span><b>{item.cantidad}</b></div>
                                        <div><span className="block text-slate-500">Precio</span><b>{money.format(item.precioUnitario)}</b></div>
                                        <div className="text-right"><span className="block text-slate-500">Subtotal</span><b>{money.format(item.subtotal)}</b></div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>

                    <PaymentMethodsPanel
                        method={paymentMethod}
                        onMethodChange={(method) => {
                            setPaymentMethod(method);
                            setPaymentDetails((current) => ({ ...current, reference: '' }));
                            setNotification(null);
                            if (method === 'credito') setIsCreditModalOpen(true);
                        }}
                        currencies={currencies}
                        posTypes={posTypes}
                        details={paymentDetails}
                        onDetailsChange={setPaymentDetails}
                        onOpenCredit={() => setIsCreditModalOpen(true)}
                        onError={(message) => setNotification({ message, type: 'warning' })}
                    />
                </section>

                <aside className="min-w-0 space-y-4 sm:space-y-6">
                    <div className="border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Cliente y facturación</h2>
                                <p className="text-sm text-slate-500">Busca un cliente del catálogo o registra sus datos básicos.</p>
                            </div>
                            <Building2 className="h-5 w-5 text-brand-teal" />
                        </div>

                        <div className="mt-4 space-y-3">
                            <div className="relative">
                                <input
                                    value={clientQuery}
                                    onChange={(event) => {
                                        setClientQuery(event.target.value);
                                        setSelectedClient(null);
                                    }}
                                    placeholder="Buscar cliente por NIT o nombre"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white"
                                />
                                {clientResults.length > 0 && (
                                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                                        {clientResults.map((client) => (
                                            <button
                                                key={client.idCliente}
                                                type="button"
                                                onClick={() => selectClient(client)}
                                                className="flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 last:border-b-0"
                                            >
                                                <p className="font-medium text-slate-900">{client.nombre}</p>
                                                <p className="text-xs text-slate-500">
                                                    NIT: {client.nit || 'CF'} · {client.direccion || 'Sin dirección'}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <input
                                value={customer.nombre}
                                onChange={(event) => setCustomer((current) => ({ ...current, nombre: event.target.value }))}
                                placeholder="Nombre del cliente"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white"
                            />

                            <input
                                value={customer.telefono}
                                onChange={(event) => setCustomer((current) => ({ ...current, telefono: event.target.value }))}
                                placeholder="Teléfono"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white"
                            />

                            <textarea
                                value={customer.domicilio}
                                onChange={(event) => setCustomer((current) => ({ ...current, domicilio: event.target.value }))}
                                placeholder="Domicilio"
                                rows={3}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white"
                            />
                        </div>
                    </div>

                    <div className="border border-slate-200 bg-white p-5 shadow-sm">
                        <label htmlFor="seller" className="block text-sm font-semibold text-slate-900">
                            Seleccionar vendedor <span className="text-red-600" aria-hidden="true">*</span>
                        </label>
                        <select
                            id="seller"
                            required
                            value={selectedSellerId}
                            onChange={(event) => {
                                setSelectedSellerId(event.target.value);
                                setNotification(null);
                            }}
                            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
                        >
                            <option value="">{effectiveSucursalId ? 'Selecciona un vendedor' : 'Selecciona una sucursal o agrega un producto'}</option>
                            {sellers.map((seller) => (
                                <option key={seller.idVendedor} value={seller.idVendedor}>{seller.nombre}</option>
                            ))}
                        </select>
                        {effectiveSucursalId && sellers.length === 0 && (
                            <p className="mt-2 text-sm text-slate-500">No hay vendedores asignados a esta sucursal.</p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleGenerateReceipt}
                        disabled={cartItems.length === 0}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        Generar recibo
                    </button>

                </aside>
            </div>

            <NotificationToast notification={notification} onClose={() => setNotification(null)} />
            <CreditCustomerModal
                open={isCreditModalOpen}
                onClose={() => setIsCreditModalOpen(false)}
                value={paymentDetails.credit}
                onChange={(credit) => setPaymentDetails((current) => ({ ...current, credit }))}
                total={total}
                onError={showPaymentError}
            />
            <PhoneScannerModal
                open={phoneScannerOpen}
                idSucursal={effectiveSucursalId}
                onClose={() => setPhoneScannerOpen(false)}
                onProductScanned={receivePhoneProduct}
                onNotify={(type, message) => setNotification({ type, message })}
            />
            <MobileCameraScannerModal
                open={cameraScannerOpen}
                onClose={() => setCameraScannerOpen(false)}
                onDetected={addBarcode}
            />

            <div className="border border-brand-teal bg-white px-6 py-4 text-slate-900 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">Total actual</span>
                    <span className="text-3xl font-bold">{money.format(total)}</span>
                </div>
            </div>
        </div>
    );
}
