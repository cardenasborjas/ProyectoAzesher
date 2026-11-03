import { useEffect, useState } from "react";
import { Download, RotateCcw, Search, X } from "lucide-react";
import axiosClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import NotificationToast from "../components/NotificationToast";
import { useSearchParams } from "react-router-dom";
import NitValidationField from "../components/NitValidationField";
import { openBlobInNewTab } from "../utils/blobFiles";

const money = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
});
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("es-GT") : "—";

export default function CobrosPage({ mode = "list" }) {
  const { selectedSucursalId, isAdministrator } = useAuth();
  const [searchParams] = useSearchParams();
  if (mode === "statement") return <EstadoCuenta branch={selectedSucursalId} initialQuery={searchParams.get("cliente") || ""} initialClientId={Number(searchParams.get("idCliente")) || null} />;
  if (mode === "pay") return <PagarAbono branch={selectedSucursalId} />;
  if (mode === "authorize")
    return isAdministrator ? (
      <Autorizar initialClientId={Number(searchParams.get("idCliente")) || null} initialQuery={searchParams.get("cliente") || ""} />
    ) : (
      <Page title="Autorizar / denegar crédito">
        <Empty text="Esta opción está disponible únicamente para administradores." />
      </Page>
    );
  return <Listado branch={selectedSucursalId} />;
}

function Listado({ branch }) {
  const [filters, setFilters] = useState({
    query: "",
    orden: "deuda_desc",
    soloConDeuda: false,
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setFilters({ query: "", orden: "deuda_desc", soloConDeuda: false });
    setRows([]);
  }, [branch]);
  const load = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get("/cobros", {
        params: { idSucursal: branch, ...filters },
      });
      setRows(response.data.data || []);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Page title="Listado de cobros">
      <SearchBar
        value={filters.query}
        setValue={(query) => setFilters({ ...filters, query })}
        search={load}
        loading={loading}
      >
        <select
          className="input w-48"
          value={filters.orden}
          onChange={(event) =>
            setFilters({ ...filters, orden: event.target.value })
          }
        >
          <option value="deuda_desc">Mayor deuda</option>
          <option value="deuda_asc">Menor deuda</option>
          <option value="nombre_asc">Nombre A-Z</option>
          <option value="nombre_desc">Nombre Z-A</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.soloConDeuda}
            onChange={(event) =>
              setFilters({ ...filters, soloConDeuda: event.target.checked })
            }
          />
          Solo con deuda
        </label>
      </SearchBar>
      <Table
        headers={[
          <button
            key="cliente"
            onClick={() =>
              setFilters({
                ...filters,
                orden:
                  filters.orden === "nombre_asc" ? "nombre_desc" : "nombre_asc",
              })
            }
          >
            Cliente ↕
          </button>,
          "NIT",
          "Límite",
          <button
            key="saldo"
            onClick={() =>
              setFilters({
                ...filters,
                orden:
                  filters.orden === "deuda_desc" ? "deuda_asc" : "deuda_desc",
              })
            }
          >
            Saldo pendiente ↕
          </button>,
          "Disponible",
          "Cuotas vencidas",
          "Próximo pago",
        ]}
        empty={!rows.length}
      >
        {rows.map((row) => (
          <tr key={row.idCliente}>
            <Cell strong>{row.cliente}</Cell>
            <Cell>{row.nit || "CF"}</Cell>
            <Cell right>{money.format(row.limiteCredito)}</Cell>
            <Cell right strong>
              {money.format(row.saldoPendiente)}
            </Cell>
            <Cell right>{money.format(row.creditoDisponible)}</Cell>
            <Cell right>{row.cuotasVencidas}</Cell>
            <Cell>{formatDate(row.proximoVencimiento)}</Cell>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

function EstadoCuenta({ branch, initialQuery = "", initialClientId = null }) {
  const [query, setQuery] = useState(initialQuery);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [state, setState] = useState(null);
  const [range, setRange] = useState({ fechaDesde: "", fechaHasta: "" });
  useEffect(() => {
    setQuery(initialQuery);
    setClients([]);
    setSelected(null);
    setState(null);
    setRange({ fechaDesde: "", fechaHasta: "" });
    if (!branch) return;
    if (initialClientId) {
      axiosClient.get("/cobros/estado-cuenta", { params: { idSucursal: branch, idCliente: initialClientId } }).then(response => {
        const detail = response.data.data;
        if (detail?.resumen) {
          setSelected({ idCliente: detail.resumen.idCliente, cliente: detail.resumen.cliente });
          setState(detail);
        }
      });
      return;
    }
    if (!initialQuery) return;
    axiosClient.get("/cobros", { params: { idSucursal: branch, query: initialQuery, orden: "nombre_asc" } }).then(async response => {
      const found = response.data.data || [];
      setClients(found);
      if (found.length === 1) {
        setSelected(found[0]);
        const detail = await axiosClient.get("/cobros/estado-cuenta", { params: { idSucursal: branch, idCliente: found[0].idCliente } });
        setState(detail.data.data);
      }
    });
  }, [branch, initialQuery, initialClientId]);
  const search = async () => {
    const response = await axiosClient.get("/cobros", {
      params: { idSucursal: branch, query, orden: "nombre_asc" },
    });
    setClients(response.data.data || []);
    setSelected(null);
    setState(null);
  };
  const consult = async (client) => {
    setSelected(client);
    const response = await axiosClient.get("/cobros/estado-cuenta", {
      params: { idSucursal: branch, idCliente: client.idCliente, ...range },
    });
    setState(response.data.data);
  };
  const excel = async () => {
    const response = await axiosClient.get("/cobros/estado-cuenta/excel", {
      params: { idSucursal: branch, idCliente: selected.idCliente, ...range },
      responseType: "blob",
    });
    download(response.data, `estado-cuenta-${selected.cliente}.xlsx`);
  };
  const clear = () => {
    setQuery("");
    setRange({ fechaDesde: "", fechaHasta: "" });
    setClients([]);
    setSelected(null);
    setState(null);
  };
  return (
    <Page title="Estado de cuenta">
      <section className="grid gap-3 border bg-white p-5 md:grid-cols-[1fr_170px_170px_auto_auto]">
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o NIT"
        />
        <label className="text-xs font-semibold text-slate-600">Movimientos desde<DateText
          value={range.fechaDesde}
          set={(value) => setRange({ ...range, fechaDesde: value })}
        /></label>
        <label className="text-xs font-semibold text-slate-600">Movimientos hasta<DateText
          value={range.fechaHasta}
          set={(value) => setRange({ ...range, fechaHasta: value })}
        /></label>
        <button onClick={() => selected ? consult(selected) : search()} className="button-primary">
          <Search className="h-4 w-4" />
          {selected ? "Aplicar fechas" : "Buscar"}
        </button>
        <button onClick={clear} className="button-secondary">
          <RotateCcw className="h-4 w-4" />
          Limpiar
        </button>
      </section>
      {!!clients.length && !selected && <Table headers={["Cliente", "NIT", "Teléfono", "Saldo pendiente", "Crédito"]}>
        {clients.map((client) => <tr key={client.idCliente} onClick={() => consult(client)} className="cursor-pointer border-t hover:bg-cyan-50">
          <Cell strong>{client.cliente}{!client.activo && <small className="block font-bold text-red-600">{client.estadoAutorizacion || "Desactivado"}</small>}</Cell>
          <Cell>{client.nit || "CF"}</Cell><Cell>{client.telefono || "—"}</Cell>
          <Cell right strong>{money.format(client.saldoPendiente)}</Cell><Cell>{client.activo ? "Autorizado" : "Sin autorización"}</Cell>
        </tr>)}
      </Table>}
      {state?.resumen && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Límite"
              value={money.format(state.resumen.limiteCredito)}
            />
            <Metric
              label="Pendiente"
              value={money.format(state.resumen.saldoPendiente)}
            />
            <Metric
              label="Disponible"
              value={money.format(state.resumen.creditoDisponible)}
            />
          </section>
          <section className="border bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <b>{state.resumen.cliente}</b>
                <p className="text-sm text-slate-500">
                  NIT: {state.resumen.nit || "CF"} · Teléfono: {state.resumen.telefono || "—"}
                </p>
                {!state.resumen.activo && <p className="mt-1 font-semibold text-red-600">{state.resumen.estadoAutorizacion || "Crédito desactivado"}</p>}
              </div>
              <div className="flex gap-2"><button onClick={() => { setSelected(null); setState(null); }} className="button-secondary">Regresar</button><button onClick={excel} className="button-secondary">
                <Download className="h-4 w-4" />
                Excel
              </button></div>
            </header>
            <Table
              headers={[
                "Fecha",
                "Movimiento",
                "Documento",
                "Vencimiento",
                "Salida / deuda",
                "Entrada / abono",
                "Estado",
              ]}
              empty={!state.movimientos.length}
            >
              {state.movimientos.map((row) => (
                <tr key={`${row.tipo}-${row.idMovimiento}`} className={row.tipo === "Estado de crédito" ? (row.estado === "Autorizado" ? "bg-emerald-50" : "bg-red-50") : ""}>
                  <Cell>{formatDate(row.fecha)}</Cell>
                  <Cell>{row.tipo}</Cell>
                  <Cell>{row.documento}</Cell>
                  <Cell>{formatDate(row.fechaVencimiento)}</Cell>
                  <Cell right className="font-semibold text-red-600">
                    {money.format(row.debito)}
                  </Cell>
                  <Cell right className="font-semibold text-emerald-600">
                    {money.format(row.credito)}
                  </Cell>
                  <Cell><span className={row.tipo === "Estado de crédito" ? (row.estado === "Autorizado" ? "font-semibold text-emerald-700" : "font-semibold text-red-600") : ""}>{row.estado}</span></Cell>
                </tr>
              ))}
            </Table>
          </section>
        </>
      )}
    </Page>
  );
}

function PagarAbono({ branch }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    monto: "",
    metodoPago: "efectivo",
    referencia: "",
    correo: "",
    telefono: "",
  });
  const [confirm, setConfirm] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    setQuery("");
    setRows([]);
    setSelected(null);
    setForm({
      monto: "",
      metodoPago: "efectivo",
      referencia: "",
      correo: "",
      telefono: "",
    });
  }, [branch]);
  const search = async () => {
    const response = await axiosClient.get("/cobros/cuentas-pendientes", {
      params: { idSucursal: branch, query },
    });
    setRows(response.data.data || []);
    setSelected(null);
  };
  const chooseAccount = (row) => {
    setSelected(row);
    setForm((current) => ({
      ...current,
      correo: row.correo || "",
      telefono: row.telefono || "",
    }));
  };
  const requestPay = () => {
    const amount = Number(form.monto);
    if (!selected || amount <= 0 || amount > selected.saldoPendiente)
      return setNotice({
        type: "warning",
        message: "Selecciona una cuenta e ingresa un monto válido.",
      });
    setConfirm(true);
  };
  const pay = async () => {
    setConfirm(false);
    try {
      const account = selected;
      const response = await axiosClient.post("/cobros/abonos", {
        idCuenta: selected.idCuenta,
        idSucursal: Number(branch),
        monto: Number(form.monto),
        metodoPago: form.metodoPago,
        referencia: form.referencia,
        correo: form.correo,
        telefono: form.telefono,
      });
      const pdf = await axiosClient.get(
        `/cobros/abonos/${response.data.data.idAbono}/pdf`,
        { responseType: "blob" },
      );
      openBlobInNewTab(pdf.data);
      setLastPayment({ idAbono: response.data.data.idAbono, cliente: account.cliente, nit: account.nit || "CF", direccion: account.direccion || "", monto: Number(form.monto) });
      setNotice({ type: "success", message: "Abono registrado." });
      setForm({
        monto: "",
        metodoPago: "efectivo",
        referencia: "",
        correo: "",
        telefono: "",
      });
      await search();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message || "No fue posible registrar el abono.",
      });
    }
  };
  return (
    <Page title="Pagar abono">
      <NotificationToast
        notification={notice}
        onClose={() => setNotice(null)}
      />
      <SearchBar value={query} setValue={setQuery} search={search} />
      <section className="grid gap-5 xl:grid-cols-[1fr_350px]">
        <Table
          headers={[
            "Cliente",
            "Nota de crédito",
            "Próximo pago",
            "Cuotas",
            "Pendiente",
          ]}
          empty={!rows.length}
        >
          {rows.map((row) => (
            <tr
              key={row.idCuenta}
              onClick={() => chooseAccount(row)}
              className={`cursor-pointer ${selected?.idCuenta === row.idCuenta ? "bg-teal-50" : "hover:bg-slate-50"}`}
            >
              <Cell strong>{row.cliente}</Cell>
              <Cell>{row.notaCredito}</Cell>
              <Cell>{formatDate(row.proximoVencimiento)}</Cell>
              <Cell>
                {row.cuotasPagadas}/{row.numeroCuotas}
              </Cell>
              <Cell right strong>
                {money.format(row.saldoPendiente)}
              </Cell>
            </tr>
          ))}
        </Table>
        <FormPanel title="Registrar pago" selected={selected}>
          <Field label="Monto *">
            <input
              type="number"
              className="input"
              min="0.01"
              step="0.01"
              value={form.monto}
              onChange={(event) =>
                setForm({ ...form, monto: event.target.value })
              }
            />
          </Field>
          <Field label="Forma de pago">
            <select
              className="input"
              value={form.metodoPago}
              onChange={(event) =>
                setForm({ ...form, metodoPago: event.target.value })
              }
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </Field>
          <Field label="Referencia">
            <input
              className="input"
              value={form.referencia}
              onChange={(event) =>
                setForm({ ...form, referencia: event.target.value })
              }
            />
          </Field>
          <Field label="Correo">
            <input
              type="email"
              className="input"
              value={form.correo}
              onChange={(event) =>
                setForm({ ...form, correo: event.target.value })
              }
            />
          </Field>
          <Field label="Teléfono">
            <input
              className="input"
              value={form.telefono}
              onChange={(event) =>
                setForm({ ...form, telefono: event.target.value })
              }
            />
          </Field>
          <button onClick={requestPay} className="button-primary w-full">
            Registrar abono
          </button>
        </FormPanel>
      </section>
      {lastPayment && <section className="flex flex-wrap items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 p-4"><div><b>Abono registrado: {money.format(lastPayment.monto)}</b><p className="text-sm text-slate-600">Puedes emitir la factura de este pago ahora.</p></div><button className="button-primary" onClick={() => setInvoice({ nombre: lastPayment.cliente, nit: lastPayment.nit, direccion: lastPayment.direccion })}>Facturar abono</button></section>}
      {confirm && (
        <Confirm
          text={`Registrar ${money.format(Number(form.monto))} para ${selected.cliente}.`}
          close={() => setConfirm(false)}
          accept={pay}
        />
      )}
      {invoice && <InvoicePayment payment={lastPayment} form={invoice} setForm={setInvoice} close={() => setInvoice(null)} branch={branch} done={() => { setInvoice(null); setLastPayment(null); }} notify={setNotice} />}
    </Page>
  );
}

function InvoicePayment({payment,form,setForm,close,branch,done,notify}) {
  const [nitValidated,setNitValidated]=useState(!form.nit||String(form.nit).toUpperCase()==="CF");
  const save=async()=>{if(!form.nombre.trim())return notify({type:"warning",message:"El nombre del receptor es obligatorio."});if(!nitValidated)return notify({type:"warning",message:"Valida el NIT antes de autorizar la factura."});try{const response=await axiosClient.post("/facturacion/abonos",{idAbono:payment.idAbono,idSucursal:Number(branch),...form});notify({type:"info",message:response.data.message||"La factura se generará en segundo plano. Te notificaremos cuando esté lista."});window.dispatchEvent(new Event("notifications-refresh"));done(response.data.data.idFactura);}catch(error){notify({type:"error",message:error.response?.data?.message||"No fue posible facturar el abono."});}};
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-lg space-y-4 border bg-white p-6 shadow-xl"><div className="flex justify-between"><div><h2 className="text-lg font-bold">Facturar abono</h2><p className="text-sm text-slate-500">Monto: {money.format(payment.monto)}</p></div><button onClick={close}><X className="h-5 w-5"/></button></div><Field label="Nombre receptor *"><input className="input" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></Field><NitValidationField value={form.nit||'CF'} onChange={nit=>setForm({...form,nit})} onValidated={(valid,result)=>{setNitValidated(valid);if(valid&&result&&!result.isConsumerFinal)setForm(current=>({...current,nombre:result.name}));}}/><Field label="Dirección"><input className="input" value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})}/></Field><div className="flex justify-end gap-2"><button className="button-secondary" onClick={close}>Cancelar</button><button disabled={!nitValidated} className="button-primary disabled:opacity-45" onClick={save}>Autorizar factura</button></div></section></div>;
}

function Autorizar({ initialClientId = null, initialQuery = "" }) {
  const { user } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    limiteCredito: "",
    diasMaximosPago: 30,
    fechaVencimientoAutorizacion: "",
    observaciones: "",
    activo: true,
  });
  const [notice, setNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const search = async (term = query, targetId = null) => {
    const response = await axiosClient.get("/cobros/autorizaciones", {
      params: { query: term },
    });
    const data = response.data.data || [];
    setRows(data);
    const target = targetId ? data.find((row) => Number(row.idCliente) === Number(targetId)) : null;
    if (target) choose(target);
  };
  const choose = (row) => {
    setSelected(row);
    setForm({
      limiteCredito: row.limiteCredito || "",
      diasMaximosPago: row.diasMaximosPago || 30,
      fechaVencimientoAutorizacion:
        row.fechaVencimientoAutorizacion?.slice(0, 10) || "",
      observaciones: row.observaciones || "",
      activo: row.idClienteCredito ? row.activo : true,
    });
  };
  useEffect(() => {
    let active = true;
    axiosClient.get("/cobros/autorizaciones", { params: { query: initialQuery } }).then((response) => {
      if (!active) return;
      const data = response.data.data || [];
      setRows(data);
      const target = initialClientId ? data.find((row) => Number(row.idCliente) === Number(initialClientId)) : null;
      if (target) {
        setSelected(target);
        setForm({
          limiteCredito: target.limiteCredito || "",
          diasMaximosPago: target.diasMaximosPago || 30,
          fechaVencimientoAutorizacion: target.fechaVencimientoAutorizacion?.slice(0, 10) || "",
          observaciones: target.observaciones || "",
          activo: target.idClienteCredito ? target.activo : true,
        });
      }
    });
    return () => { active = false; };
  }, [initialClientId, initialQuery]);
  const requestSave = (active) => {
    if (!selected)
      return setNotice({ type: "warning", message: "Selecciona un cliente." });
    const limit = Number(form.limiteCredito);
    if (!limit || Number(form.diasMaximosPago) <= 0)
      return setNotice({
        type: "warning",
        message: "Completa el límite y los días máximos de pago.",
      });
    if (active && limit < Number(selected.saldoPendiente))
      return setNotice({
        type: "warning",
        message: `El límite no puede ser menor que la deuda actual de ${money.format(selected.saldoPendiente)}.`,
      });
    setConfirmation({ active });
  };
  const save = async () => {
    const active = confirmation.active;
    setConfirmation(null);
    try {
      await axiosClient.post("/cobros/autorizaciones", {
        idCliente: selected.idCliente,
        limiteCredito: Number(form.limiteCredito),
        diasMaximosPago: Number(form.diasMaximosPago),
        fechaVencimientoAutorizacion: form.fechaVencimientoAutorizacion || null,
        observaciones: form.observaciones,
        activo: active,
      });
      window.dispatchEvent(new Event("notifications-refresh"));
      setNotice({
        type: "success",
        message: active
          ? "Autorización guardada."
          : "Crédito denegado; la deuda existente se conserva.",
      });
      setSelected(null);
      await search();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "No fue posible guardar.",
      });
    }
  };
  return (
    <Page title="Autorizar / denegar crédito">
      <NotificationToast
        notification={notice}
        onClose={() => setNotice(null)}
      />
      <SearchBar value={query} setValue={setQuery} search={search} />
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div><div className="hidden md:block"><Table
          headers={["Cliente", "NIT", "Límite", "Deuda", "Estado"]}
          empty={!rows.length}
        >
          {rows.map((row) => (
            <tr
              key={row.idCliente}
              onClick={() => choose(row)}
              className={`cursor-pointer ${selected?.idCliente === row.idCliente ? "bg-teal-50" : "hover:bg-slate-50"}`}
            >
              <Cell strong>{row.cliente}</Cell>
              <Cell>{row.nit || "CF"}</Cell>
              <Cell right>
                {row.limiteCredito ? money.format(row.limiteCredito) : "—"}
              </Cell>
              <Cell right>{money.format(row.saldoPendiente)}</Cell>
              <Cell>{row.estadoAutorizacion}</Cell>
            </tr>
          ))}
        </Table></div><div className="space-y-3 md:hidden">{rows.map((row) => <button key={row.idCliente} onClick={() => choose(row)} className={`w-full rounded-xl border p-4 text-left ${selected?.idCliente === row.idCliente ? "border-[var(--branch-color)] bg-slate-50" : "bg-white"}`}><span className="block font-semibold">{row.cliente}</span><small className="text-slate-500">NIT: {row.nit || "CF"}</small><span className="mt-3 grid grid-cols-2 gap-2 text-xs"><span>Deuda<b className="block text-sm">{money.format(row.saldoPendiente)}</b></span><span>Estado<b className="block text-sm">{row.estadoAutorizacion}</b></span></span></button>)}{!rows.length && <Empty />}</div></div>
        <FormPanel title="Decisión de crédito" selected={selected}>
          <Field label="Límite *">
            <input
              type="number"
              className="input"
              value={form.limiteCredito}
              onChange={(event) =>
                setForm({ ...form, limiteCredito: event.target.value })
              }
            />
          </Field>
          <Field label="Días máximos de pago *">
            <input
              type="number"
              className="input"
              value={form.diasMaximosPago}
              onChange={(event) =>
                setForm({ ...form, diasMaximosPago: event.target.value })
              }
            />
          </Field>
          <Field label="Vigencia">
            <DateText
              value={form.fechaVencimientoAutorizacion}
              set={(value) =>
                setForm({ ...form, fechaVencimientoAutorizacion: value })
              }
            />
          </Field>
          <Field label="Observaciones">
            <textarea
              className="input h-20 py-2"
              value={form.observaciones}
              onChange={(event) =>
                setForm({ ...form, observaciones: event.target.value })
              }
            />
          </Field>
          {selected && (
            <div
              className={`border-l-4 p-3 text-sm ${selected.estadoAutorizacion === "Autorizado" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-400 bg-slate-50 text-slate-700"}`}
            >
              <b>Estado actual: {selected.estadoAutorizacion}</b>
              <p className="mt-1">
                Deuda vigente: {money.format(selected.saldoPendiente)}. Denegar
                evita nuevas ventas a crédito, pero conserva esta deuda y su
                historial.
              </p>
            </div>
          )}
          <div className="grid gap-2 border-t pt-4 sm:grid-cols-2">
            {selected?.idClienteCredito &&
              selected.estadoAutorizacion !== "Denegado" && (
                <button
                  onClick={() => requestSave(false)}
                  className="border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50"
                >
                  Denegar crédito
                </button>
              )}
            <button
              onClick={() => requestSave(true)}
              className="button-primary sm:col-start-2"
            >
              {selected?.estadoAutorizacion === "Denegado"
                ? "Volver a autorizar"
                : "Revisar autorización"}
            </button>
          </div>
        </FormPanel>
      </section>
      {confirmation && (
        <AuthorizationConfirm
          client={selected}
          form={form}
          active={confirmation.active}
          username={user?.unique_name || user?.name || "Usuario actual"}
          close={() => setConfirmation(null)}
          accept={save}
        />
      )}
    </Page>
  );
}

function Page({ title, children }) {
  return (
    <div className="space-y-5">
      <header className="page-title p-5">
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>
      {children}
    </div>
  );
}
function SearchBar({ value, setValue, search, loading, children }) {
  return (
    <section className="flex flex-wrap items-center gap-3 border bg-white p-5">
      <input
        className="input min-w-64 flex-1"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Nombre, NIT o documento"
      />
      {children}
      <button onClick={search} disabled={loading} className="button-primary">
        <Search className="h-4 w-4" />
        Buscar
      </button>
    </section>
  );
}
function Table({ headers, children, empty }) {
  return (
    <div className="overflow-x-auto border bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="p-4">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
      {empty && <Empty />}
    </div>
  );
}
function Cell({ children, right, strong, className = "" }) {
  return (
    <td
      className={`p-4 ${right ? "text-right" : ""} ${strong ? "font-bold" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
function Metric({ label, value }) {
  return (
    <div className="border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="block text-sm font-semibold">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
function DateText({ value, set }) {
  const display = (iso) =>
    iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
      : "";
  const [text, setText] = useState(display(value));
  useEffect(() => setText(display(value)), [value]);
  const commit = () => {
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return setText(display(value));
    const iso = `${match[3]}-${match[2]}-${match[1]}`;
    const date = new Date(`${iso}T12:00:00`);
    if (
      Number.isNaN(date.getTime()) ||
      date.getDate() !== Number(match[1]) ||
      date.getMonth() + 1 !== Number(match[2])
    )
      return setText(display(value));
    set(iso);
  };
  return (
    <input
      className="input"
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      value={text}
      onChange={(event) =>
        setText(event.target.value.replace(/[^\d/]/g, "").slice(0, 10))
      }
      onBlur={commit}
    />
  );
}
function FormPanel({ title, selected, children }) {
  return (
    <aside className="h-fit border bg-white p-5">
      <h2 className="font-bold">{title}</h2>
      {selected ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-semibold">{selected.cliente}</p>
          {children}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Selecciona una fila.</p>
      )}
    </aside>
  );
}
function Empty({ text = "Sin resultados. Utiliza los campos de búsqueda." }) {
  return <p className="p-8 text-center text-sm text-slate-500">{text}</p>;
}
function Confirm({ text, close, accept }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md border bg-white p-6">
        <div className="flex justify-between">
          <b>Confirmar abono</b>
          <button onClick={close}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-4 text-sm">{text}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={close} className="button-secondary">
            Cancelar
          </button>
          <button onClick={accept} className="button-primary">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
function AuthorizationConfirm({
  client,
  form,
  active,
  username,
  close,
  accept,
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg border bg-white p-6 shadow-xl">
        <div className="flex justify-between">
          <h2 className="text-lg font-bold">
            {active ? "Confirmar autorización" : "Confirmar denegación"}
          </h2>
          <button onClick={close}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <Summary label="Cliente" value={client.cliente} />
          <Summary
            label="Límite"
            value={money.format(Number(form.limiteCredito))}
          />
          <Summary
            label="Deuda actual"
            value={money.format(client.saldoPendiente)}
          />
          <Summary
            label="Días máximos"
            value={`${form.diasMaximosPago} días`}
          />
          <Summary
            label="Vigencia"
            value={
              form.fechaVencimientoAutorizacion
                ? formatDate(form.fechaVencimientoAutorizacion)
                : "Sin vencimiento"
            }
          />
          <Summary label="Estado" value={active ? "Autorizado" : "Denegado"} />
          <Summary label="Autoriza" value={username} />
        </dl>
        {!active && (
          <p className="mt-4 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
            La deuda existente se mantendrá, pero el cliente dejará de estar
            disponible para nuevas ventas a crédito.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={close} className="button-secondary">
            Cancelar
          </button>
          <button
            onClick={accept}
            className={
              active
                ? "button-primary"
                : "button-secondary border-red-300 text-red-600"
            }
          >
            {active ? "Autorizar" : "Denegar crédito"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Summary({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
function download(blob, name) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = name;
  anchor.click();
}
