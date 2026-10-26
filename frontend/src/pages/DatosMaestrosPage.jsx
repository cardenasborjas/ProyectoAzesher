import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, RefreshCw, Search, X } from "lucide-react";
import axiosClient from "../api/axiosClient";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
import { generateProductCode } from "../utils/productCode";

const palette = ["#008BA8", "#0F766E", "#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#D97706", "#475569"];
const money = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });
const bonusTypes = [
  ["PORCENTAJE_VENTAS", "Porcentaje sobre ventas"],
  ["META_MONTO_VENTAS", "Monto fijo al alcanzar una meta de ventas"],
  ["META_CANTIDAD_VENTAS", "Monto fijo al alcanzar una cantidad de ventas"],
  ["MONTO_FIJO", "Monto fijo por período"],
];

const catalogs = {
  sucursales: { label: "Sucursales", fields: [["nombre", "Nombre", "text", true], ["direccion", "Dirección"], ["telefono", "Teléfono"], ["colorIdentificacion", "Color", "color", true]] },
  proveedores: { label: "Proveedores", fields: [["nombre", "Nombre", "text", true], ["telefono", "Teléfono"], ["direccion", "Dirección"], ["activo", "Activo", "checkbox"]], columns: [["nombre", "Nombre"], ["telefono", "Teléfono"], ["direccion", "Dirección"], ["activo", "Estado"]], canDisable: true },
  productos: { label: "Productos", fields: [["codigo", "Código", "text", true], ["nombre", "Nombre", "text", true], ["descripcion", "Descripción"], ["precio", "Precio", "number", true], ["idCategoria", "Categoría", "select:categorias-producto", true]], columns: [["codigo", "Código"], ["nombre", "Nombre"], ["categoria", "Categoría"], ["precio", "Precio"]] },
  "categorias-producto": { label: "Categorías de producto", fields: [["nombre", "Nombre", "text", true], ["descripcion", "Descripción"], ["activo", "Activo", "checkbox"]], canDisable: true },
  "proveedor-producto": { label: "Productos por proveedor", fields: [["idProveedor", "Proveedor", "select:proveedores", true], ["idProducto", "Producto", "select:productos", true]], columns: [["proveedor", "Proveedor"], ["producto", "Producto"], ["activo", "Estado"]], canDisable: true },
  vendedores: { label: "Vendedores", fields: [["nombre", "Nombre", "text", true], ["telefono", "Teléfono"], ["idSucursal", "Sucursal", "select:sucursales", true], ["activo", "Activo", "checkbox"]], columns: [["nombre", "Nombre"], ["telefono", "Teléfono"], ["sucursal", "Sucursal"], ["activo", "Estado"]], canDisable: true },
  monedas: { label: "Monedas", fields: [["codigo", "Código", "text", true], ["nombre", "Nombre", "text", true], ["simbolo", "Símbolo", "text", true], ["activo", "Activo", "checkbox"]], canDisable: true },
  "tipos-pos": { label: "Tipos de POS", fields: [["nombre", "Nombre", "text", true], ["activo", "Activo", "checkbox"]], canDisable: true },
  "motivos-salida": { label: "Motivos de salida", fields: [["codigo", "Código interno", "text", true], ["nombre", "Nombre visible", "text", true], ["orden", "Orden", "number", true], ["activo", "Activo", "checkbox"]], canDisable: true },
  "preguntas-evaluacion": { label: "Preguntas de evaluación", fields: [["pregunta", "Pregunta", "text", true], ["orden", "Orden", "number", true], ["activo", "Activo", "checkbox"]], canDisable: true },
  "bonos-planilla": { label: "Bonos de planilla", fields: [["codigo", "Código interno", "text", true], ["nombre", "Nombre", "text", true], ["descripcion", "Descripción"], ["tipoCalculo", "Forma de cálculo", "choice", true, bonusTypes], ["porcentaje", "Porcentaje sobre ventas", "number"], ["metaMinima", "Meta mínima", "number"], ["montoBono", "Monto del bono", "number"], ["activo", "Activo", "checkbox"]], columns: [["codigo", "Código"], ["nombre", "Bono"], ["tipoCalculo", "Forma de cálculo"], ["porcentaje", "Porcentaje"], ["metaMinima", "Meta"], ["montoBono", "Monto"]], canDisable: true },
};

const normalizeRows = (rows) => (rows || []).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.charAt(0).toLowerCase() + key.slice(1), value])));

export default function DatosMaestrosPage() {
  const { updateSucursalLocal, isAdministrator } = useAuth();
  const [entity, setEntity] = useState("sucursales");
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [options, setOptions] = useState({});
  const [notification, setNotification] = useState(null);
  const config = catalogs[entity];
  const columns = useMemo(() => config.columns || config.fields.filter((field) => !field[0].startsWith("id")).map((field) => [field[0], field[1]]), [config]);

  const load = useCallback(async () => {
    try {
      const response = await axiosClient.get(`/datos-maestros/${entity}`, { params: { query } });
      setRows(normalizeRows(response.data.data));
    } catch (error) {
      setNotification({ type: "error", message: error.response?.data?.message || "No fue posible cargar los datos." });
    }
  }, [entity, query]);

  const loadOptions = useCallback(async () => {
    try {
      const entries = await Promise.all(["sucursales", "proveedores", "productos", "categorias-producto"].map(async (key) => [key, normalizeRows((await axiosClient.get(`/datos-maestros/${key}`)).data.data)]));
      setOptions(Object.fromEntries(entries));
    } catch { /* La tabla principal mostrará el error cuando corresponda. */ }
  }, []);

  useEffect(() => { const timer = window.setTimeout(load, 250); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { loadOptions(); }, [loadOptions]);

  const open = (row = null) => {
    const values = {};
    config.fields.forEach(([key, , type]) => { values[key] = row?.[key] ?? (type === "checkbox" ? true : ""); });
    if (entity === "productos" && !row) values.codigo = generateProductCode();
    setEditing(row);
    setForm(values);
  };
  const close = () => { setEditing(null); setForm(null); };

  const validateBonus = () => {
    const positive = (value) => Number(value) > 0;
    if (form.tipoCalculo === "PORCENTAJE_VENTAS" && !positive(form.porcentaje)) return "Indica un porcentaje mayor que cero.";
    if (["META_MONTO_VENTAS", "META_CANTIDAD_VENTAS"].includes(form.tipoCalculo) && (!positive(form.metaMinima) || !positive(form.montoBono))) return "Indica la meta mínima y el monto que se pagará al alcanzarla.";
    if (form.tipoCalculo === "META_CANTIDAD_VENTAS" && !Number.isInteger(Number(form.metaMinima))) return "La meta por cantidad debe ser un número entero de ventas.";
    if (form.tipoCalculo === "MONTO_FIJO" && !positive(form.montoBono)) return "Indica un monto fijo mayor que cero.";
    return "";
  };

  const save = async () => {
    for (const [key, label, , required] of config.fields) if (required && (form[key] === "" || form[key] == null)) return setNotification({ type: "warning", message: `${label} es obligatorio.` });
    if (entity === "bonos-planilla") { const error = validateBonus(); if (error) return setNotification({ type: "warning", message: error }); }
    try {
      const response = await axiosClient.post(`/datos-maestros/${entity}`, { id: editing?.id || null, datos: form });
      const savedId = editing?.id || response.data.data?.id;
      if (entity === "sucursales") updateSucursalLocal(savedId, { nombreSuc: form.nombre, colorIdentificacion: form.colorIdentificacion });
      close();
      await Promise.all([load(), loadOptions()]);
      setNotification({ type: "success", message: "Datos guardados." });
    } catch (error) {
      setNotification({ type: "error", message: error.response?.data?.errors || error.response?.data?.message || "No fue posible guardar." });
    }
  };

  const toggleActive = async (row) => {
    try {
      if (row.activo !== false) await axiosClient.delete(`/datos-maestros/${entity}/${row.id}`);
      else {
        const data = {};
        config.fields.forEach(([key]) => { data[key] = key === "activo" ? true : row[key]; });
        await axiosClient.post(`/datos-maestros/${entity}`, { id: row.id, datos: data });
      }
      await load();
      setNotification({ type: "success", message: row.activo !== false ? "Registro desactivado." : "Registro reactivado." });
    } catch (error) {
      setNotification({ type: "error", message: error.response?.data?.errors || error.response?.data?.message || "No fue posible cambiar el estado." });
    }
  };

  if (!isAdministrator) return <section className="border bg-white p-6"><h1 className="text-xl font-bold">Datos maestros</h1></section>;
  return <div className="space-y-5">
    <NotificationToast notification={notification} onClose={() => setNotification(null)} />
    <header className="page-title p-5"><h1 className="text-2xl font-bold">Datos maestros</h1></header>
    <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
      <aside className="h-fit border bg-white p-2">{Object.entries(catalogs).map(([key, item]) => <button key={key} onClick={() => { setEntity(key); setQuery(""); close(); }} className={`w-full border-l-4 px-3 py-3 text-left text-sm ${entity === key ? "border-[var(--branch-color)] bg-slate-50 font-bold text-slate-900" : "border-transparent text-slate-600 hover:bg-slate-50"}`}>{item.label}</button>)}</aside>
      <section className="min-w-0 border bg-white">
        <div className="border-b p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{config.label}</h2><button onClick={() => open()} className="button-primary"><Plus className="h-4 w-4" />Nuevo</button></div><div className="mt-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" /></div><button onClick={() => setQuery("")} className="button-secondary">Limpiar</button></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-100 text-left"><tr>{columns.map(([key, label]) => <th key={key} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr className={row.activo === false ? "bg-slate-100 text-slate-500" : ""} key={`${entity}-${row.id}-${row.idProducto || ""}`}>{columns.map(([key], index) => <td key={key} className="px-4 py-3">{formatCell(key, row[key])}{index === 0 && row.activo === false && <small className="block font-semibold text-red-600">Desactivado</small>}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => open(row)} className="rounded-full border p-2 hover:bg-slate-100" title="Editar"><Edit3 className="h-4 w-4" /></button>{config.canDisable && <button type="button" role="switch" aria-checked={row.activo !== false} onClick={() => toggleActive(row)} className={`relative h-6 w-11 rounded-full transition ${row.activo !== false ? "bg-emerald-500" : "bg-slate-300"}`} title={row.activo !== false ? "Desactivar" : "Reactivar"}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${row.activo !== false ? "left-6" : "left-1"}`} /></button>}</div></td></tr>)}</tbody></table></div>
        {!rows.length && <p className="p-8 text-center text-sm text-slate-500">No hay registros.</p>}
      </section>
    </div>
    {form && <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-950/35 p-4"><div className="my-6 w-full max-w-2xl border bg-white shadow-xl"><header className="flex items-center justify-between border-b p-4"><h3 className="font-bold">{editing ? "Editar" : "Nuevo"} · {config.label}</h3><button onClick={close}><X className="h-5 w-5" /></button></header>{entity === "bonos-planilla" && <div className="mx-5 mt-5 border-l-4 border-[var(--branch-color)] bg-slate-50 p-3 text-sm text-slate-600"><b className="block text-slate-800">¿Cómo se aplica?</b>El porcentaje utiliza el total vendido. Las reglas de meta pagan el monto indicado únicamente al alcanzar la meta. El monto fijo se suma siempre en el período.</div>}<div className="grid gap-4 p-5 sm:grid-cols-2">{config.fields.filter((field) => entity !== "bonos-planilla" || showBonusField(field[0], form.tipoCalculo)).map((field) => entity === "productos" && field[0] === "codigo" ? <label key="codigo" className="text-sm font-semibold">Código interno *<div className="mt-1 flex gap-2"><input className="input bg-slate-50 font-mono" value={form.codigo} readOnly /><button type="button" className="button-secondary shrink-0" onClick={() => setForm(current => ({ ...current, codigo: generateProductCode() }))}><RefreshCw className="h-4 w-4" />Generar código</button></div></label> : <Field key={field[0]} field={field} value={form[field[0]]} onChange={(value) => setForm({ ...form, [field[0]]: value })} options={options} />)}</div><footer className="flex justify-end gap-2 border-t p-4"><button onClick={close} className="button-secondary">Cancelar</button><button onClick={save} className="button-primary">Guardar</button></footer></div></div>}
  </div>;
}

function formatCell(key, value) {
  if (key === "colorIdentificacion") return <span className="flex items-center gap-2"><i className="h-5 w-5 rounded-sm border" style={{ backgroundColor: value }} />{value}</span>;
  if (key === "tipoCalculo") return bonusTypes.find(([code]) => code === value)?.[1] || value;
  if (key === "porcentaje") return value == null ? "—" : `${Number(value)}%`;
  if (["metaMinima", "montoBono", "precio"].includes(key)) return value == null ? "—" : money.format(Number(value));
  if (typeof value === "boolean") return value ? "Activo" : "Inactivo";
  return String(value ?? "—");
}

function showBonusField(key, type) {
  if (key === "porcentaje") return type === "PORCENTAJE_VENTAS";
  if (key === "metaMinima") return ["META_MONTO_VENTAS", "META_CANTIDAD_VENTAS"].includes(type);
  if (key === "montoBono") return ["META_MONTO_VENTAS", "META_CANTIDAD_VENTAS", "MONTO_FIJO"].includes(type);
  return true;
}

function Field({ field, value, onChange, options }) {
  const [, label, type = "text", required, choices] = field;
  if (type === "color") return <label className="sm:col-span-2 text-sm font-semibold">{label}{required && " *"}<div className="mt-2 flex flex-wrap gap-2">{palette.map((color) => <button type="button" key={color} onClick={() => onChange(color)} className={`h-8 w-8 rounded-md border-2 ${value === color ? "border-slate-900" : "border-white shadow"}`} style={{ backgroundColor: color }} title={color} />)}<input type="color" value={value || palette[0]} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-8 w-10" /></div></label>;
  if (type === "choice") return <label className="sm:col-span-2 text-sm font-semibold">{label}{required && " *"}<select className="input mt-1" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Seleccionar</option>{(choices || []).map(([code, text]) => <option key={code} value={code}>{text}</option>)}</select></label>;
  if (type.startsWith("select:")) { const source = type.split(":")[1]; return <label className="text-sm font-semibold">{label}{required && " *"}<select className="input mt-1" value={value} onChange={(event) => onChange(Number(event.target.value))}><option value="">Seleccionar</option>{(options[source] || []).filter((option) => option.activo !== false).map((option) => <option key={option.id} value={option.id}>{option.nombre || option.codigo}</option>)}</select></label>; }
  if (type === "checkbox") return <label className="flex items-center gap-2 pt-7 text-sm font-semibold"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
  return <label className="text-sm font-semibold">{label}{required && " *"}<input type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} className="input mt-1" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
