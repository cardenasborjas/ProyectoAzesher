import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, FileText, Pencil, Plus, Printer, ReceiptText, Search, UserRoundSearch, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import NotificationToast from "../components/NotificationToast";
import NitValidationField from "../components/NitValidationField";
import LoadingIndicator from "../components/LoadingIndicator";
import { formatGuatemalaDateTime, guatemalaInputDate } from "../utils/guatemalaDate";

const money = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
});
const empty = { nombre: "", nit: "", telefono: "", correo: "", direccion: "", fechaNacimiento: "" };
const pageSize = 10;
const validPhone = (value) =>
  !value || /^(?:\+?502)?[2-7]\d{7}$/.test(value.replace(/[\s-]/g, ""));
const validNit = (value) => {
  const nit = value.replace(/[\s-]/g, "").toUpperCase();
  if (!nit || nit === "CF") return true;
  if (!/^\d+[0-9K]$/.test(nit)) return false;
  const body = nit.slice(0, -1);
  let sum = 0;
  for (let index = 0; index < body.length; index += 1)
    sum += Number(body[index]) * (body.length + 1 - index);
  const result = (11 - (sum % 11)) % 11;
  return nit.at(-1) === (result === 10 ? "K" : String(result));
};

export default function ClientesPage() {
  const { selectedSucursalId } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const createOpen = searchParams.get('crear') === '1';
  const closeCreate = () => setSearchParams({}, { replace: true });
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState(empty);
  const [confirm, setConfirm] = useState(false);
  const [notification, setNotification] = useState(null);
  const [editing, setEditing] = useState(null);
  const [nitValidated, setNitValidated] = useState(true);
  const [editingNitValidated, setEditingNitValidated] = useState(true);
  const [creditTarget, setCreditTarget] = useState(null);

  const load = useCallback(
    async (term = "") => {
      if (!selectedSucursalId) {
        setLoading(false);
        return [];
      }
      setLoading(true);
      try {
        const response = await axiosClient.get("/operaciones/clientes", {
          params: { query: term, idSucursal: selectedSucursalId },
        });
        const rows = response.data.data || [];
        setClients(rows);
        setPage(1);
        return rows;
      } finally {
        setLoading(false);
      }
    },
    [selectedSucursalId],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => load(query), 300);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const pages = Math.max(1, Math.ceil(clients.length / pageSize));
  const visible = useMemo(
    () => clients.slice((page - 1) * pageSize, page * pageSize),
    [clients, page],
  );
  const validate = () => {
    if (!form.nombre.trim()) return "El nombre es obligatorio.";
    if (!validPhone(form.telefono))
      return "El teléfono debe tener 8 dígitos de Guatemala y comenzar entre 2 y 7.";
    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo))
      return "El correo electrónico no es válido.";
    if (!validNit(form.nit)) return "El NIT no supera la validación local.";
    return "";
  };
  const requestSave = (event) => {
    event.preventDefault();
    const error = validate();
    if (error) setNotification({ type: "warning", message: error });
    else if (!nitValidated) setNotification({ type: "warning", message: "Valida el NIT antes de guardar el cliente." });
    else setConfirm(true);
  };
  const save = async () => {
    try {
      await axiosClient.post("/operaciones/clientes", { ...form, nit: form.nit.trim() || "CF" });
      await load(query);
      setConfirm(false);
      setForm(empty);
      setNitValidated(true);
      closeCreate();
      setNotification({
        type: "success",
        message: "Cliente creado correctamente.",
      });
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error.response?.data?.message || "No fue posible crear el cliente.",
      });
    }
  };
  const viewHistory = async (client) => {
    setSelected(client);
    setHistoryLoading(true);
    try {
      const response = await axiosClient.get(
        `/operaciones/clientes/${client.idCliente}/historial`,
        { params: { idSucursal: selectedSucursalId } },
      );
      setHistory(
        (response.data.data || []).filter(
          (row) => row.estadoFactura === "Autorizada",
        ),
      );
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error.response?.data?.message ||
          "No fue posible consultar el historial.",
      });
    } finally {
      setHistoryLoading(false);
    }
  };
  const updateClient = async () => {
    const error = (() => {
      if (!editing.nombre.trim()) return "El nombre es obligatorio.";
      if (!validPhone(editing.telefono))
        return "El teléfono debe tener 8 dígitos de Guatemala y comenzar entre 2 y 7.";
      if (editing.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.correo))
        return "El correo electrónico no es válido.";
      if (!validNit(editing.nit || ""))
        return "El NIT no supera la validación local.";
      return "";
    })();
    if (error) return setNotification({ type: "warning", message: error });
    if (!editingNitValidated) return setNotification({ type: "warning", message: "Valida el NIT antes de guardar los cambios." });
    try {
      await axiosClient.put(
        `/operaciones/clientes/${editing.idCliente}`,
        { ...editing, nit: String(editing.nit || "").trim() || "CF" },
      );
      setEditing(null);
      await load(query);
      setNotification({
        type: "success",
        message: "Cliente actualizado correctamente.",
      });
    } catch (errorResponse) {
      setNotification({
        type: "error",
        message:
          errorResponse.response?.data?.message ||
          "No fue posible actualizar el cliente.",
      });
    }
  };
  const requestCredit = async (client) => {
    try {
      const response = await axiosClient.post(`/notificaciones/solicitudes-credito/${client.idCliente}`);
      window.dispatchEvent(new Event("notifications-refresh"));
      setNotification({ type: "success", message: response.data.message });
      setCreditTarget(null);
    } catch (error) {
      setNotification({ type: "warning", message: error.response?.data?.message || "No fue posible enviar la solicitud." });
    }
  };

  return (
    <Page title="Clientes">
      <NotificationToast
        notification={notification}
        onClose={() => setNotification(null)}
      />
      <div className="flex justify-end"><button className="button-primary" onClick={() => setSearchParams({ crear: '1' })}><Plus className="h-4 w-4" />Crear cliente</button></div>
      <section className="relative min-h-64 border bg-white">
        {loading && <LoadingIndicator label="Cargando clientes…" />}
        <div className="relative border-b p-4">
          <Search className="absolute left-7 top-7 h-4 w-4 text-slate-400" />
          <input
            className="input pl-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, NIT o teléfono"
          />
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[940px] text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-4">Cliente</th>
                <th>NIT</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Edad</th>
                <th className="text-right">Compras</th>
                <th className="text-right">Total comprado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((client) => (
                <tr
                  key={client.idCliente}
                  className={
                    selected?.idCliente === client.idCliente ? "bg-teal-50" : ""
                  }
                >
                  <td className="p-4 font-semibold">{client.nombre}</td>
                  <td>{String(client.nit || "").toUpperCase() === "CF" ? "—" : client.nit || "—"}</td>
                  <td>{client.telefono || "—"}</td>
                  <td>{client.correo || "—"}</td>
                  <td>{client.edad == null ? "—" : `${client.edad} años`}</td>
                  <td className="text-right">{client.compras}</td>
                  <td className="text-right font-semibold">
                    {money.format(client.totalComprado)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setCreditTarget(client)}
                        className="rounded-full border border-[var(--branch-color)] p-2 text-[var(--branch-color)]"
                        title={client.tieneEstadoCrediticio ? "Solicitar revisión" : "Solicitar crédito"}
                        aria-label={client.tieneEstadoCrediticio ? "Solicitar revisión" : "Solicitar crédito"}
                      >
                        {client.tieneEstadoCrediticio ? <UserRoundSearch className="h-4 w-4" /> : <BadgeDollarSign className="h-4 w-4" />}
                      </button>
                      {client.tieneEstadoCrediticio && <button
                        onClick={() => navigate(`/cobros/estado-cuenta?idCliente=${client.idCliente}&cliente=${encodeURIComponent(client.nombre)}`)}
                        className="rounded-full border p-2" title="Estado de cuenta" aria-label="Estado de cuenta"
                      >
                        <FileText className="h-4 w-4" />
                      </button>}
                      <button
                        onClick={() => {
                          setEditing({ ...client, nit: String(client.nit || "").toUpperCase() === "CF" ? "" : client.nit });
                          setEditingNitValidated(!client.nit || String(client.nit).toUpperCase() === "CF");
                        }}
                        className="rounded-full border p-2" title="Editar cliente" aria-label="Editar cliente"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => viewHistory(client)}
                        className="rounded-full bg-brand-teal p-2 text-white" title="Ver facturas" aria-label="Ver facturas"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          navigate(
                            `/ventas/recibos?cliente=${encodeURIComponent(client.nombre)}`,
                          )
                        }
                        className="rounded-full border p-2" title="Ver recibos" aria-label="Ver recibos"
                      >
                        <ReceiptText className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y xl:hidden">
          {visible.map((client) => <ClientCard key={client.idCliente} client={client} selected={selected} requestCredit={setCreditTarget} navigate={navigate} viewHistory={viewHistory} edit={() => { setEditing({ ...client, nit: String(client.nit || "").toUpperCase() === "CF" ? "" : client.nit }); setEditingNitValidated(!client.nit || String(client.nit).toUpperCase() === "CF"); }} />)}
        </div>
        {!loading && !visible.length && (
          <p className="p-10 text-center text-sm text-slate-500">
            No se encontraron clientes.
          </p>
        )}
        <Pagination
          page={page}
          pages={pages}
          total={clients.length}
          setPage={setPage}
        />
      </section>
      {selected && (
        <HistoryTable
          client={selected}
          rows={history}
          loading={historyLoading}
        />
      )}
      {editing && (
        <EditClient
          data={editing}
          setData={setEditing}
          nitValidated={editingNitValidated}
          setNitValidated={setEditingNitValidated}
          cancel={() => setEditing(null)}
          accept={updateClient}
        />
      )}
      {createOpen && <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Crear cliente"><div className="gentle-enter my-5 w-full max-w-2xl rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-bold">Nuevo cliente</h2><p className="text-sm text-slate-500">Los campos con * son obligatorios. Si dejas el NIT vacío, se guardará como consumidor final.</p></div><button type="button" onClick={closeCreate} aria-label="Cerrar"><X className="h-5 w-5" /></button></header><form onSubmit={requestSave} className="grid gap-4 p-5 md:grid-cols-2"><Input required label="Nombre o razón social *" value={form.nombre} set={value => setForm({ ...form, nombre: value })} /><NitValidationField label="NIT (opcional)" value={form.nit} onChange={nit => setForm({ ...form, nit })} onValidated={(valid, result) => { setNitValidated(valid); if (valid && result && !result.isConsumerFinal) setForm(current => ({ ...current, nombre: result.name })); }} /><Input label="Teléfono (opcional)" inputMode="numeric" value={form.telefono} set={value => setForm({ ...form, telefono: value.replace(/[^\d+ -]/g, '') })} hint="8 dígitos; puede incluir +502." /><Input label="Correo electrónico (opcional)" type="email" value={form.correo} set={value => setForm({ ...form, correo: value })} /><Input label="Dirección (opcional)" value={form.direccion} set={value => setForm({ ...form, direccion: value })} /><Input label="Fecha de nacimiento (opcional)" type="date" max={guatemalaInputDate()} value={form.fechaNacimiento} set={value => setForm({ ...form, fechaNacimiento: value })} /><div className="flex justify-end gap-2 md:col-span-2"><button type="button" className="button-secondary" onClick={closeCreate}>Cancelar</button><button className="button-primary">Revisar y guardar</button></div></form></div></div>}
      {confirm && <Confirm data={form} cancel={() => setConfirm(false)} accept={save} />}
      {creditTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Confirmar solicitud de crédito"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-bold">Confirmar solicitud</h2><p className="mt-3 text-sm text-slate-600">¿Deseas enviar a administración la {creditTarget.tieneEstadoCrediticio ? "revisión del crédito" : "solicitud de crédito"} de <b>{creditTarget.nombre}</b>?</p><p className="mt-2 text-xs text-slate-500">Si ya existe una solicitud pendiente, el sistema no la duplicará y te lo indicará.</p><div className="mt-6 flex justify-end gap-2"><button type="button" className="button-secondary" onClick={() => setCreditTarget(null)}>Cancelar</button><button type="button" className="button-primary" onClick={() => requestCredit(creditTarget)}>Enviar solicitud</button></div></div></div>}
    </Page>
  );
}

function Page({ title, children }) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="page-title p-5">
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>
      {children}
    </div>
  );
}
function Input({ label, hint, value, set, ...props }) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        {...props}
        className="input mt-1"
        value={value}
        onChange={(event) => set(event.target.value)}
      />
      {hint && (
        <small className="mt-1 block font-normal text-slate-500">{hint}</small>
      )}
    </label>
  );
}

function ClientCard({ client, selected, requestCredit, navigate, viewHistory, edit }) {
  const nit = String(client.nit || "").toUpperCase() === "CF" ? "—" : client.nit || "—";
  return <article className={`space-y-4 p-4 ${selected?.idCliente === client.idCliente ? "bg-teal-50" : ""}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="break-words font-semibold text-slate-900">{client.nombre}</h2><p className="mt-1 text-xs text-slate-500">NIT: {nit}</p></div>
      <strong className="shrink-0 text-sm">{money.format(client.totalComprado)}</strong>
    </div>
    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
      <div><dt className="text-slate-500">Teléfono</dt><dd className="break-all font-semibold">{client.telefono || "—"}</dd></div>
      <div><dt className="text-slate-500">Edad</dt><dd className="font-semibold">{client.edad == null ? "—" : `${client.edad} años`}</dd></div>
      <div className="col-span-2"><dt className="text-slate-500">Correo</dt><dd className="break-all font-semibold">{client.correo || "—"}</dd></div>
    </dl>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <button onClick={() => requestCredit(client)} className="rounded-md border border-[var(--branch-color)] px-3 py-2 text-xs font-semibold text-[var(--branch-color)]">{client.tieneEstadoCrediticio ? "Solicitar revisión" : "Solicitar crédito"}</button>
      {client.tieneEstadoCrediticio && <button onClick={() => navigate(`/cobros/estado-cuenta?idCliente=${client.idCliente}&cliente=${encodeURIComponent(client.nombre)}`)} className="rounded-md border px-3 py-2 text-xs font-semibold">Estado de cuenta</button>}
      <button onClick={edit} className="rounded-md border px-3 py-2 text-xs font-semibold">Editar</button>
      <button onClick={() => viewHistory(client)} className="rounded-md bg-brand-teal px-3 py-2 text-xs font-semibold text-white">Facturas</button>
      <button onClick={() => navigate(`/ventas/recibos?cliente=${encodeURIComponent(client.nombre)}`)} className="rounded-md border px-3 py-2 text-xs font-semibold">Recibos</button>
    </div>
  </article>;
}
function HistoryTable({ client, rows, loading }) {
  const printInvoice = async (idFactura) => {
    const response = await axiosClient.get(`/facturacion/${idFactura}/pdf`, { responseType: "blob" });
    window.open(URL.createObjectURL(response.data), "_blank", "noopener,noreferrer");
  };
  return (
    <section className="border bg-white">
      <h2 className="border-b p-4 font-bold">Historial de {client.nombre}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-4">Fecha</th>
              <th>Recibo</th>
              <th>Factura</th>
              <th>Pago</th>
              <th className="text-right">Total</th>
              <th className="p-4 text-right">Pendiente</th>
              <th className="p-4 text-right">Factura</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.idVenta}>
                <td className="p-4">
                  {formatGuatemalaDateTime(row.fecha)}
                </td>
                <td>{row.numeroRecibo || "—"}</td>
                <td>{row.numeroFactura || "—"}</td>
                <td className="capitalize">{row.tipoPago}</td>
                <td className="text-right font-semibold">
                  {money.format(row.total)}
                </td>
                <td className="p-4 text-right">
                  {money.format(row.saldoPendiente || 0)}
                </td>
                <td className="p-4 text-right">
                  <button disabled={!row.idFactura || !row.numeroFactura || String(row.numeroFactura).startsWith("BOR-")} onClick={() => printInvoice(row.idFactura)} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-35"><Printer className="h-4 w-4" />Imprimir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && (
        <p className="p-8 text-center text-sm text-slate-500">
          Consultando historial…
        </p>
      )}
      {!loading && !rows.length && (
        <p className="p-8 text-center text-sm text-slate-500">
          Este cliente no tiene movimientos en esta sucursal.
        </p>
      )}
    </section>
  );
}
function Pagination({ page, pages, total, setPage }) {
  return (
    <footer className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-sm">
      <span>{total} clientes</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page === 1}
          onClick={() => setPage((value) => value - 1)}
          className="rounded-md border bg-white px-3 py-1.5 disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button
          disabled={page === pages}
          onClick={() => setPage((value) => value + 1)}
          className="rounded-md border bg-white px-3 py-1.5 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </footer>
  );
}
function Confirm({ data, cancel, accept }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md border bg-white p-6 shadow-xl">
        <div className="flex justify-between">
          <h2 className="text-lg font-bold">Confirmar cliente</h2>
          <button onClick={cancel} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <dl className="mt-5 space-y-2 text-sm">
          <Row label="Nombre" value={data.nombre} />
          <Row label="NIT" value={data.nit || "CF"} />
          <Row label="Teléfono" value={data.telefono || "Sin teléfono"} />
          <Row label="Dirección" value={data.direccion || "Sin dirección"} />
          <Row label="Nacimiento" value={data.fechaNacimiento ? new Date(`${data.fechaNacimiento.slice(0,10)}T12:00:00`).toLocaleDateString("es-GT") : "Sin registrar"} />
        </dl>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={cancel} className="rounded-md border px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={accept}
            className="rounded-md bg-brand-teal px-4 py-2 font-bold text-white"
          >
            Guardar cliente
          </button>
        </div>
      </div>
    </div>
  );
}
function EditClient({ data, setData, cancel, accept, nitValidated, setNitValidated }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-xl border bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Editar cliente</h2>
          <button onClick={cancel} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input
            required
            label="Nombre o razón social *"
            value={data.nombre || ""}
            set={(value) => setData({ ...data, nombre: value })}
          />
          <NitValidationField
            label="NIT (opcional)"
            allowConsumerFinal
            value={data.nit || "CF"}
            onChange={(nit) => setData({ ...data, nit })}
            onValidated={(valid, result) => {
              setNitValidated(valid);
              if (valid && result && !result.isConsumerFinal)
                setData((current) => ({ ...current, nombre: result.name }));
            }}
          />
          <Input
            label="Teléfono (opcional)"
            value={data.telefono || ""}
            set={(value) =>
              setData({ ...data, telefono: value.replace(/[^\d+ -]/g, "") })
            }
          />
          <Input
            label="Correo electrónico (opcional)"
            type="email"
            value={data.correo || ""}
            set={(value) => setData({ ...data, correo: value })}
          />
          <div className="md:col-span-2">
            <Input
              label="Dirección (opcional)"
              value={data.direccion || ""}
              set={(value) => setData({ ...data, direccion: value })}
            />
          </div>
          <Input label="Fecha de nacimiento (opcional)" type="date" max={guatemalaInputDate()} value={data.fechaNacimiento?.slice?.(0,10) || ""} set={(value) => setData({ ...data, fechaNacimiento: value })} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={cancel} className="rounded-md border px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={accept}
            disabled={!nitValidated}
            className="rounded-md bg-brand-teal px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
