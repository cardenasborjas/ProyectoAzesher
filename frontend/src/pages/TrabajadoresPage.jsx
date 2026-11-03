import { useCallback, useEffect, useMemo, useState } from "react";
import axiosClient from "../api/axiosClient";
import NotificationToast from "../components/NotificationToast";
import { useAuth } from "../context/AuthContext";
import { ChevronDown, ChevronUp, ChevronsUpDown, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { isStrongPassword, passwordHint } from "../utils/passwordPolicy";
import { formatGuatemalaDateTime, guatemalaInputDate, guatemalaMonthStart } from "../utils/guatemalaDate";
import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
});
const today = guatemalaInputDate();
const monthStart = guatemalaMonthStart();
const passwordExpiry = new Date(Date.now() + 90 * 86400000)
  .toISOString()
  .slice(0, 10);
const validEmail = (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const emptyWorker = {
  nombre: "",
  telefono: "",
  correo: "",
  dpi: "",
  puesto: "Vendedor",
  fechaIngreso: today,
  idSucursal: "",
  activo: true,
};
const emptyUser = {
  nombre: "",
  apellidos: "",
  telefono: "",
  username: "",
  password: "",
  correo: "",
  fechaExpiracionPassword: passwordExpiry,
  rol: "Encargado",
  idSucursal: "",
  activo: true,
  permisos: [],
};
const emptyPasswordChange = { passwordActual: "", passwordNueva: "", confirmacion: "" };

export default function TrabajadoresPage({ mode = "register" }) {
  if (mode === "kpis") return <Kpis />;
  if (mode === "evaluation") return <Evaluation />;
  if (mode === "sales") return <Sales />;
  if (mode === "users") return <Register key="users" initialTab="users" singleTab />;
  return <Register key="workers" initialTab="workers" singleTab />;
}

function Register({ initialTab = "workers", singleTab = false }) {
  const { sucursales, selectedSucursalId, isAdministrator } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [worker, setWorker] = useState({
    ...emptyWorker,
    idSucursal: selectedSucursalId,
  });
  const [systemUser, setSystemUser] = useState(emptyUser);
  const [notice, setNotice] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [workerModal, setWorkerModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [adminPassword, setAdminPassword] = useState(emptyPasswordChange);
  const load = useCallback(async () => {
    const workerResponse = await axiosClient.get("/trabajadores", {
      params: { idSucursal: selectedSucursalId },
    });
    setWorkers(workerResponse.data.data || []);
    if (isAdministrator) {
      const [userResponse, moduleResponse] = await Promise.all([
        axiosClient.get("/trabajadores/usuarios"),
        axiosClient.get("/trabajadores/modulos"),
      ]);
      setUsers(userResponse.data.data || []);
      setModules(moduleResponse.data.data || []);
    }
  }, [selectedSucursalId, isAdministrator]);
  useEffect(() => {
    load().catch(() =>
      setNotice({
        type: "error",
        message: "No fue posible cargar el personal.",
      }),
    );
  }, [load]);
  const saveWorker = async () => {
    if (!worker.nombre.trim() || !worker.idSucursal)
      return setNotice({
        type: "warning",
        message: "Completa el nombre y la sucursal.",
      });
    if (worker.telefono && !/^\d{8}$/.test(worker.telefono))
      return setNotice({
        type: "warning",
        message: "El teléfono debe contener exactamente 8 números.",
      });
    if (worker.dpi && !/^\d{13}$/.test(worker.dpi))
      return setNotice({
        type: "warning",
        message: "El DPI debe contener exactamente 13 números.",
      });
    if (!validEmail(worker.correo))
      return setNotice({ type: "warning", message: "El correo no es válido." });
    try {
      await axiosClient.post("/trabajadores", {
        ...worker,
        idSucursal: Number(worker.idSucursal),
      });
      setWorker({ ...emptyWorker, idSucursal: selectedSucursalId });
      setWorkerModal(false);
      await load();
      setNotice({ type: "success", message: "Trabajador guardado." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "No fue posible guardar.",
      });
    }
  };
  const saveUser = async () => {
    if (
      !systemUser.nombre.trim() ||
      !systemUser.apellidos.trim() ||
      !systemUser.username.trim() ||
      (!systemUser.idUsuario && !systemUser.password)
    )
      return setNotice({
        type: "warning",
        message: "Completa nombres, apellidos, usuario y contraseña.",
      });
    if (systemUser.telefono && !/^\d{8}$/.test(systemUser.telefono))
      return setNotice({ type: "warning", message: "El teléfono debe contener exactamente 8 números." });
    if (systemUser.password && !isStrongPassword(systemUser.password))
      return setNotice({
        type: "warning",
        message: passwordHint,
      });
    if (!validEmail(systemUser.correo))
      return setNotice({ type: "warning", message: "El correo no es válido." });
    if (
      systemUser.rol === "Encargado" &&
      (!systemUser.correo || !systemUser.fechaExpiracionPassword)
    )
      return setNotice({
        type: "warning",
        message: "El correo y la vigencia son obligatorios para un encargado.",
      });
    try {
      await axiosClient.post("/trabajadores/usuarios", {
        ...systemUser,
        password: systemUser.idUsuario ? null : systemUser.password,
        idSucursal: systemUser.idSucursal
          ? Number(systemUser.idSucursal)
          : null,
        permisos: systemUser.permisos.join(","),
      });
      setSystemUser(emptyUser);
      setUserModal(false);
      setCreateUserModal(false);
      await load();
      setNotice({ type: "success", message: "Usuario guardado." });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message || "No fue posible guardar el usuario.",
      });
    }
  };
  const editUser = (row) =>
    setSystemUser({
      ...row,
      rol: ["admin", "administrador", "demo", "superusuario"].some((role) =>
        row.rol?.toLowerCase().includes(role),
      )
        ? "Administrador"
        : "Encargado",
      password: "",
      permisos: row.permisos ? row.permisos.split(",").filter(Boolean) : [],
    });
  const changeUserPassword = async () => {
    if (!isStrongPassword(adminPassword.passwordNueva))
      return setNotice({ type: "warning", message: passwordHint });
    if (adminPassword.passwordNueva !== adminPassword.confirmacion)
      return setNotice({ type: "warning", message: "La confirmación de contraseña no coincide." });
    try {
      await axiosClient.post(`/perfil/usuarios/${passwordTarget.idUsuario}/password`, {
        passwordActual: adminPassword.passwordActual,
        passwordNueva: adminPassword.passwordNueva,
      });
      setPasswordTarget(null);
      setAdminPassword(emptyPasswordChange);
      setNotice({ type: "success", message: "Contraseña actualizada." });
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "No fue posible cambiar la contraseña." });
    }
  };
  const changeWorkerStatus = async () => {
    const target = statusTarget;
    setStatusTarget(null);
    try {
      await axiosClient.post("/trabajadores", {
        ...target,
        activo: !target.activo,
      });
      setWorker({ ...emptyWorker, idSucursal: selectedSucursalId });
      await load();
      setNotice({
        type: "success",
        message: target.activo
          ? "Trabajador desactivado. Ya no aparecerá en nuevas ventas."
          : "Trabajador reactivado.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message || "No fue posible cambiar el estado.",
      });
    }
  };
  const togglePermission = (code) =>
    setSystemUser((current) => ({
      ...current,
      permisos: current.permisos.includes(code)
        ? current.permisos.filter((item) => item !== code)
        : [...current.permisos, code],
    }));
  return (
    <Page title="Personal">
      <NotificationToast
        notification={notice}
        onClose={() => setNotice(null)}
      />
      {isAdministrator && !singleTab && (
        <div className="flex border-b bg-white">
          <Tab active={tab === "workers"} onClick={() => setTab("workers")}>
            Trabajadores
          </Tab>
          <Tab active={tab === "users"} onClick={() => setTab("users")}>
            Usuarios del sistema
          </Tab>
        </div>
      )}
      {tab === "workers" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <Panel title="Registrar trabajador">
            <Field
              label="Nombre *"
              value={worker.nombre}
              set={(v) => setWorker({ ...worker, nombre: v })}
            />
            <Field
              label="DPI"
              value={worker.dpi || ""}
              set={(v) => setWorker({ ...worker, dpi: v.replace(/\D/g, "") })}
            />
            <Field
              label="Teléfono"
              inputMode="numeric"
              maxLength={8}
              value={worker.telefono || ""}
              set={(v) =>
                setWorker({ ...worker, telefono: v.replace(/\D/g, "") })
              }
            />
            <Field
              label="Correo"
              type="email"
              value={worker.correo || ""}
              set={(v) => setWorker({ ...worker, correo: v })}
            />
            <div className="border bg-slate-50 px-3 py-2 text-sm">
              <span className="block text-xs text-slate-500">Puesto</span>
              <b>Vendedor</b>
            </div>
            <DateField
              label="Fecha de ingreso"
              value={worker.fechaIngreso?.slice?.(0, 10) || ""}
              set={(v) => setWorker({ ...worker, fechaIngreso: v })}
            />
            <Select
              label="Sucursal *"
              value={worker.idSucursal || ""}
              set={(v) => setWorker({ ...worker, idSucursal: v })}
              options={sucursales.map((s) => [s.idSucursal, s.nombreSuc])}
            />
            <button onClick={saveWorker} className="button-primary w-full">
              Guardar trabajador
            </button>
            <button onClick={() => setWorker({ ...emptyWorker, idSucursal: selectedSucursalId })} className="button-secondary w-full">Limpiar datos</button>
          </Panel>
          <Table
            headers={[
              "Trabajador",
              "Contacto",
              "Puesto",
              "Sucursal",
              "Ventas",
              "Estado",
            ]}
          >
            {workers.map((row) => (
              <tr
                key={row.idVendedor}
                className={`border-t ${row.activo ? "hover:bg-slate-50" : "bg-slate-100 text-slate-500"}`}
              >
                <Td strong><div className="flex min-w-[150px] items-center gap-2"><button title="Editar trabajador" onClick={() => { setWorker({ ...row, idSucursal: String(row.idSucursal) }); setWorkerModal(true); }} className="shrink-0 rounded-full border p-2 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button><span>{row.nombre}{!row.activo && <small className="block font-bold text-red-600">Desactivado</small>}</span></div></Td>
                <Td>
                  {row.telefono || "—"}
                  <small className="block text-slate-500">
                    {row.correo || "Sin correo"}
                  </small>
                </Td>
                <Td>{row.puesto || "Vendedor"}</Td>
                <Td>{row.sucursal}</Td>
                <Td>
                  {row.ventas}
                  <small className="block text-slate-500">
                    {money.format(row.totalVendido)}
                  </small>
                </Td>
                <Td>{row.activo ? "Activo" : "Inactivo"}</Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-white p-4"><div><h2 className="font-bold">Usuarios del sistema</h2><p className="text-sm text-slate-500">Administra cuentas, roles y permisos.</p></div><button className="button-primary" onClick={() => { setSystemUser(emptyUser); setCreateUserModal(true); }}><Plus className="h-4 w-4" />Crear usuario</button></div>
          {createUserModal && <EditModal title="Crear usuario" close={() => { setCreateUserModal(false); setSystemUser(emptyUser); }}>
            <Field
              label="Nombres *"
              value={systemUser.nombre}
              set={(v) => setSystemUser({ ...systemUser, nombre: v })}
            />
            <Field label="Apellidos *" value={systemUser.apellidos || ""} set={(v) => setSystemUser({ ...systemUser, apellidos: v })} />
            <Field label="Teléfono" inputMode="numeric" maxLength={8} value={systemUser.telefono || ""} set={(v) => setSystemUser({ ...systemUser, telefono: v.replace(/\D/g, "") })} />
            <Field
              label="Usuario *"
              value={systemUser.username}
              set={(v) => setSystemUser({ ...systemUser, username: v })}
            />
            <Field
              label="Contraseña *"
              type="password"
              value={systemUser.password}
              set={(v) => setSystemUser({ ...systemUser, password: v })}
            />
            <p className="text-xs text-slate-500">{passwordHint}</p>
            <Field
              label="Correo *"
              type="email"
              value={systemUser.correo || ""}
              set={(v) => setSystemUser({ ...systemUser, correo: v })}
            />
            <Select
              label="Rol *"
              value={systemUser.rol}
              set={(v) =>
                setSystemUser({
                  ...systemUser,
                  rol: v,
                  permisos: v === "Administrador" ? [] : systemUser.permisos,
                })
              }
              options={[
                ["Administrador", "Administrador"],
                ["Encargado", "Encargado"],
              ]}
            />
            <Select
              label="Sucursal"
              value={systemUser.idSucursal || ""}
              set={(v) => setSystemUser({ ...systemUser, idSucursal: v })}
              options={[
                ["", "Todas las sucursales"],
                ...sucursales.map((s) => [s.idSucursal, s.nombreSuc]),
              ]}
            />
            {systemUser.rol === "Encargado" && (
              <DateField
                label="Vigencia de contraseña *"
                value={systemUser.fechaExpiracionPassword?.slice?.(0, 10) || ""}
                set={(v) =>
                  setSystemUser({ ...systemUser, fechaExpiracionPassword: v })
                }
              />
            )}
            {systemUser.rol === "Encargado" && (
              <fieldset className="border p-3">
                <legend className="px-1 text-sm font-bold">
                  Módulos permitidos
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {modules.map((item) => (
                    <label
                      key={item.codigo}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={systemUser.permisos.includes(item.codigo)}
                        onChange={() => togglePermission(item.codigo)}
                      />
                      {item.nombre}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={systemUser.activo}
                onChange={(e) =>
                  setSystemUser({ ...systemUser, activo: e.target.checked })
                }
              />
              Usuario activo
            </label>
            <button onClick={saveUser} className="button-primary w-full">
              Guardar usuario
            </button>
            <button onClick={() => setSystemUser(emptyUser)} className="button-secondary w-full">Limpiar datos</button>
          </EditModal>}
          <Table
            headers={[
              "Nombre completo",
              "Usuario",
              "Correo",
              "Rol",
              "Sucursal",
              "Vigencia",
              "Módulos",
              "Estado",
            ]}
          >
            {users.map((row) => (
              <tr
                key={row.idUsuario}
                className={`border-t ${row.activo ? "hover:bg-slate-50" : "bg-slate-100 text-slate-500"}`}
              >
                <Td strong><div className="flex min-w-[180px] items-center gap-2"><button title="Editar usuario" onClick={() => { editUser(row); setUserModal(true); }} className="shrink-0 rounded-full border p-2 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button><button title={`Cambiar contraseña de ${row.nombre}`} onClick={() => { setPasswordTarget(row); setAdminPassword(emptyPasswordChange); }} className="shrink-0 rounded-full border p-2 hover:bg-slate-100"><KeyRound className="h-4 w-4" /></button><span>{[row.nombre,row.apellidos].filter(Boolean).join(" ")}{!row.activo && <small className="block font-bold text-red-600">Desactivado</small>}</span></div></Td>
                <Td>{row.username}</Td>
                <Td>{row.correo || "—"}<small className="block text-slate-500">{row.telefono || "Sin teléfono"}</small></Td>
                <Td>{row.rol}</Td>
                <Td>{row.sucursal || "Todas"}</Td>
                <Td>
                  {row.fechaExpiracionPassword
                    ? new Date(
                        `${row.fechaExpiracionPassword.slice(0, 10)}T12:00:00`,
                      ).toLocaleDateString("es-GT")
                    : "No vence"}
                </Td>
                <Td>
                  {row.rol?.toLowerCase().includes("admin") ||
                  row.rol?.toLowerCase() === "demo"
                    ? "Acceso completo"
                    : row.permisos?.split(",").join(", ") || "Sin módulos"}
                </Td>
                <Td>{row.activo ? "Activo" : "Inactivo"}</Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      {statusTarget && (
        <StatusConfirm
          worker={statusTarget}
          close={() => setStatusTarget(null)}
          accept={changeWorkerStatus}
        />
      )}
      {workerModal && (
        <EditModal title="Editar trabajador" close={() => { setWorkerModal(false); setWorker({ ...emptyWorker, idSucursal: selectedSucursalId }); }}>
          <Field label="Nombre *" value={worker.nombre} set={(v) => setWorker({ ...worker, nombre: v })} />
          <Field label="DPI" maxLength={13} value={worker.dpi || ""} set={(v) => setWorker({ ...worker, dpi: v.replace(/\D/g, "") })} />
          <Field label="Teléfono" maxLength={8} value={worker.telefono || ""} set={(v) => setWorker({ ...worker, telefono: v.replace(/\D/g, "") })} />
          <Field label="Correo" type="email" value={worker.correo || ""} set={(v) => setWorker({ ...worker, correo: v })} />
          <Select label="Sucursal *" value={worker.idSucursal || ""} set={(v) => setWorker({ ...worker, idSucursal: v })} options={sucursales.map((s) => [s.idSucursal, s.nombreSuc])} />
          <Toggle checked={worker.activo} label={worker.activo ? "Activo" : "Desactivado"} set={(activo) => setWorker({ ...worker, activo })} />
          <div className="flex justify-end gap-2"><button className="button-secondary" onClick={() => { setWorkerModal(false); setWorker({ ...emptyWorker, idSucursal: selectedSucursalId }); }}>Cancelar</button><button className="button-primary" onClick={saveWorker}>Guardar cambios</button></div>
        </EditModal>
      )}
      {userModal && (
        <EditModal title="Editar usuario" close={() => { setUserModal(false); setSystemUser(emptyUser); }}>
          <Field label="Nombres *" value={systemUser.nombre} set={(v) => setSystemUser({ ...systemUser, nombre: v })} />
          <Field label="Apellidos *" value={systemUser.apellidos || ""} set={(v) => setSystemUser({ ...systemUser, apellidos: v })} />
          <Field label="Teléfono" inputMode="numeric" maxLength={8} value={systemUser.telefono || ""} set={(v) => setSystemUser({ ...systemUser, telefono: v.replace(/\D/g, "") })} />
          <Field label="Usuario *" value={systemUser.username} set={(v) => setSystemUser({ ...systemUser, username: v })} />
          <Field label="Correo *" type="email" value={systemUser.correo || ""} set={(v) => setSystemUser({ ...systemUser, correo: v })} />
          <Select label="Rol *" value={systemUser.rol} set={(v) => setSystemUser({ ...systemUser, rol: v })} options={[["Administrador", "Administrador"], ["Encargado", "Encargado"]]} />
          <Select label="Sucursal" value={systemUser.idSucursal || ""} set={(v) => setSystemUser({ ...systemUser, idSucursal: v })} options={[["", "Todas las sucursales"], ...sucursales.map((s) => [s.idSucursal, s.nombreSuc])]} />
          {systemUser.rol === "Encargado" && <DateField label="Vigencia de contraseña *" value={systemUser.fechaExpiracionPassword?.slice?.(0, 10) || ""} set={(v) => setSystemUser({ ...systemUser, fechaExpiracionPassword: v })} />}
          {systemUser.rol === "Encargado" && <fieldset className="border p-3"><legend className="px-1 text-sm font-bold">Módulos permitidos</legend><div className="grid grid-cols-2 gap-2">{modules.map((item) => <label key={item.codigo} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={systemUser.permisos.includes(item.codigo)} onChange={() => togglePermission(item.codigo)} />{item.nombre}</label>)}</div></fieldset>}
          <Toggle checked={systemUser.activo} label={systemUser.activo ? "Activo" : "Desactivado"} set={(activo) => setSystemUser({ ...systemUser, activo })} />
          <div className="flex justify-end gap-2"><button className="button-secondary" onClick={() => { setUserModal(false); setSystemUser(emptyUser); }}>Cancelar</button><button className="button-primary" onClick={saveUser}>Guardar cambios</button></div>
        </EditModal>
      )}
      {passwordTarget && <EditModal title={`Contraseña de ${passwordTarget.nombre}`} close={() => { setPasswordTarget(null); setAdminPassword(emptyPasswordChange); }}>
        <p className="text-sm text-slate-600">Este cambio no modifica los demás datos del usuario. Confirma con tu contraseña de administrador.</p>
        <Field label="Tu contraseña actual *" type="password" value={adminPassword.passwordActual} set={(v) => setAdminPassword({ ...adminPassword, passwordActual: v })} />
        <Field label="Nueva contraseña *" type="password" value={adminPassword.passwordNueva} set={(v) => setAdminPassword({ ...adminPassword, passwordNueva: v })} />
        <Field label="Confirmar nueva contraseña *" type="password" value={adminPassword.confirmacion} set={(v) => setAdminPassword({ ...adminPassword, confirmacion: v })} />
        <p className="text-xs text-slate-500">{passwordHint} No se permite reutilizar la actual ni las dos anteriores.</p>
        <button className="button-primary w-full" onClick={changeUserPassword}>Cambiar contraseña</button>
      </EditModal>}
    </Page>
  );
}

function Kpis() {
  const { selectedSucursalId, sucursales } = useAuth();
  const branchColor = sucursales.find((branch) => String(branch.idSucursal) === String(selectedSucursalId))?.colorIdentificacion || "#008BA8";
  const [dates, setDates] = useState({ from: monthStart, to: today });
  const [rows, setRows] = useState([]);
  const [globalRows, setGlobalRows] = useState([]);
  const [notice, setNotice] = useState(null);
  const load = useCallback(
    async (range) => {
      try {
        const parameters = { fechaDesde: range.from, fechaHasta: range.to };
        const [local, global] = await Promise.all([
          axiosClient.get("/trabajadores/kpis", {
            params: { ...parameters, idSucursal: selectedSucursalId },
          }),
          axiosClient.get("/trabajadores/kpis", { params: parameters }),
        ]);
        setRows(local.data.data || []);
        setGlobalRows(global.data.data || []);
      } catch {
        setNotice({
          type: "error",
          message: "No fue posible consultar los indicadores.",
        });
      }
    },
    [selectedSucursalId],
  );
  useEffect(() => {
    const initial = { from: monthStart, to: today };
    setDates(initial);
    setRows([]);
    setGlobalRows([]);
    load(initial);
  }, [selectedSucursalId, load]);
  const total = rows.reduce((sum, row) => sum + row.totalVendido, 0);
  return (
    <Page title="Indicadores de trabajadores">
      <NotificationToast
        notification={notice}
        onClose={() => setNotice(null)}
      />
      <Filters dates={dates} setDates={setDates} search={() => load(dates)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Ventas" value={rows.reduce((s, r) => s + r.ventas, 0)} />
        <Metric label="Total vendido" value={money.format(total)} />
        <Metric label="Trabajadores activos" value={rows.length} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <InteractiveBar
          title="Comparativa de la sucursal"
          rows={rows.slice(0, 8)}
          valueKey="totalVendido"
          moneyValues
          color={branchColor}
        />
        <InteractiveBar
          title="Primeros lugares de todas las sucursales"
          rows={globalRows.slice(0, 8)}
          valueKey="totalVendido"
          moneyValues
          showBranch
          color={branchColor}
        />
        <InteractivePie
          title="Participación de ventas"
          rows={rows.filter((row) => row.totalVendido > 0).slice(0, 8)}
          color={branchColor}
        />
        <EvaluationRadar
          color={branchColor}
          rows={[...rows]
            .sort((a, b) => b.promedioEvaluacion - a.promedioEvaluacion)
            .slice(0, 8)}
        />
      </div>
      <Table
        headers={[
          "Trabajador",
          "Sucursal",
          "Puesto",
          "Ventas",
          "Total vendido",
          "Venta promedio",
          "Evaluación",
        ]}
      >
        {rows.map((row) => (
          <tr key={row.idVendedor} className="border-t">
            <Td strong>{row.trabajador}</Td>
            <Td>{row.sucursal}</Td>
            <Td>{row.puesto || "Vendedor"}</Td>
            <Td>{row.ventas}</Td>
            <Td>{money.format(row.totalVendido)}</Td>
            <Td>{money.format(row.ventaPromedio)}</Td>
            <Td>{Number(row.promedioEvaluacion).toFixed(1)} / 5</Td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

function Evaluation() {
  const { selectedSucursalId } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    idVendedor: "",
    periodoDesde: monthStart,
    periodoHasta: today,
    puntualidad: 5,
    servicioCliente: 5,
    cumplimientoMetas: 5,
    trabajoEquipo: 5,
    preguntas: [],
    observaciones: "",
  });
  useEffect(() => {
    Promise.all([
      axiosClient.get("/trabajadores", { params: { idSucursal: selectedSucursalId, soloActivos: true } }),
      axiosClient.get("/datos-maestros/preguntas-evaluacion"),
    ]).then(([workersResponse, questionsResponse]) => {
      setWorkers(workersResponse.data.data || []);
      const questions = (questionsResponse.data.data || [])
        .map(item => ({ pregunta: item.pregunta ?? item.Pregunta, activo: item.activo ?? item.Activo, puntuacion: 5 }))
        .filter(item => item.activo !== false);
      setForm(current => current.preguntas.length ? current : { ...current, preguntas: questions });
    }).catch(() => setNotice({ type: "error", message: "No fue posible cargar la configuración de evaluación." }));
  }, [selectedSucursalId]);
  const save = async () => {
    if (!form.idVendedor)
      return setNotice({
        type: "warning",
        message: "Selecciona un trabajador.",
      });
    try {
      await axiosClient.post("/trabajadores/evaluaciones", {
        ...form,
        idVendedor: Number(form.idVendedor),
      });
      setNotice({ type: "success", message: "Evaluación registrada." });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message ||
          "No fue posible registrar la evaluación.",
      });
    }
  };
  return (
    <Page title="Evaluar trabajador">
      <NotificationToast
        notification={notice}
        onClose={() => setNotice(null)}
      />
      <Panel title="Formulario de puntuación">
        <Select
          label="Trabajador *"
          value={form.idVendedor}
          set={(v) => setForm({ ...form, idVendedor: v })}
          options={[
            ["", "Selecciona un trabajador"],
            ...workers.map((w) => [w.idVendedor, w.nombre]),
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            label="Desde"
            value={form.periodoDesde}
            set={(v) => setForm({ ...form, periodoDesde: v })}
          />
          <DateField
            label="Hasta"
            value={form.periodoHasta}
            set={(v) => setForm({ ...form, periodoHasta: v })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["puntualidad", "Puntualidad"],
            ["servicioCliente", "Servicio al cliente"],
            ["cumplimientoMetas", "Cumplimiento de metas"],
            ["trabajoEquipo", "Trabajo en equipo"],
          ].map(([key, label]) => (
            <Select
              key={key}
              label={label}
              value={form[key]}
              set={(v) => setForm({ ...form, [key]: Number(v) })}
              options={[1, 2, 3, 4, 5].map((v) => [
                v,
                `${v} - ${["", "Deficiente", "Debe mejorar", "Aceptable", "Bueno", "Excelente"][v]}`,
              ])}
            />
          ))}
        </div>
        <section className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-semibold">Preguntas adicionales</h3><p className="text-xs text-slate-500">Agrega los criterios que necesites para esta evaluación.</p></div>
            <button type="button" onClick={() => setForm({ ...form, preguntas: [...form.preguntas, { pregunta: "", puntuacion: 5 }] })} className="button-secondary"><Plus className="h-4 w-4" />Agregar pregunta</button>
          </div>
          {form.preguntas.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input className="input" maxLength={180} value={item.pregunta} onChange={event => setForm({ ...form, preguntas: form.preguntas.map((row, rowIndex) => rowIndex === index ? { ...row, pregunta: event.target.value } : row) })} placeholder="Ej. Conocimiento del producto" />
            <select className="input" value={item.puntuacion} onChange={event => setForm({ ...form, preguntas: form.preguntas.map((row, rowIndex) => rowIndex === index ? { ...row, puntuacion: Number(event.target.value) } : row) })}>{[1,2,3,4,5].map(score => <option key={score} value={score}>{score} / 5</option>)}</select>
            <button type="button" onClick={() => setForm({ ...form, preguntas: form.preguntas.filter((_, rowIndex) => rowIndex !== index) })} className="rounded-md border px-3 text-red-600" aria-label="Quitar pregunta"><Trash2 className="h-4 w-4" /></button>
          </div>)}
        </section>
        <label className="text-sm font-semibold">
          Observaciones
          <textarea
            className="input mt-1 h-24 py-2"
            value={form.observaciones}
            onChange={(e) =>
              setForm({ ...form, observaciones: e.target.value })
            }
          />
        </label>
        <button onClick={save} className="button-primary">
          Registrar evaluación
        </button>
      </Panel>
    </Page>
  );
}

function Sales() {
  const { selectedSucursalId } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [rows, setRows] = useState([]);
  const [worker, setWorker] = useState("");
  const [dates, setDates] = useState({ from: monthStart, to: today });
  const [sort, setSort] = useState({ key: 'fecha', direction: 'desc' });
  const [page, setPage] = useState(1);
  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const left = sort.key === 'fecha' ? new Date(a.fecha).getTime() : sort.key === 'total' ? Number(a.total) : String(a[sort.key] || '').toLowerCase();
    const right = sort.key === 'fecha' ? new Date(b.fecha).getTime() : sort.key === 'total' ? Number(b.total) : String(b[sort.key] || '').toLowerCase();
    return (left > right ? 1 : left < right ? -1 : 0) * (sort.direction === 'asc' ? 1 : -1);
  }), [rows, sort]);
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / 10));
  const visibleRows = sortedRows.slice((page - 1) * 10, page * 10);
  const filteredTotal = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const changeSort = key => { setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPage(1); };
  useEffect(() => {
    axiosClient
      .get("/trabajadores", { params: { idSucursal: selectedSucursalId } })
      .then((r) => setWorkers(r.data.data || []));
  }, [selectedSucursalId]);
  const load = async (range = dates, seller = worker) => {
    const r = await axiosClient.get("/trabajadores/ventas", {
      params: {
        idSucursal: selectedSucursalId,
        idVendedor: seller || null,
        fechaDesde: range.from,
        fechaHasta: range.to,
      },
    });
    setRows(r.data.data || []); setPage(1);
  };
  useEffect(() => {
    const initial = { from: monthStart, to: today };
    setWorker("");
    setDates(initial);
    setRows([]); setPage(1);
    axiosClient.get("/trabajadores/ventas", {
      params: { idSucursal: selectedSucursalId, idVendedor: null, fechaDesde: initial.from, fechaHasta: initial.to },
    }).then((response) => setRows(response.data.data || []));
  }, [selectedSucursalId]);
  return (
    <Page title="Ventas por trabajador">
      <section className="grid gap-3 border bg-white p-4 md:grid-cols-[1fr_170px_170px_auto]">
        <select
          className="input"
          value={worker}
          onChange={(e) => setWorker(e.target.value)}
        >
          <option value="">Todos los trabajadores</option>
          {workers.map((w) => (
            <option key={w.idVendedor} value={w.idVendedor}>
              {w.nombre}
            </option>
          ))}
        </select>
        <DateField
          value={dates.from}
          set={(value) => setDates({ ...dates, from: value })}
        />
        <DateField
          value={dates.to}
          set={(value) => setDates({ ...dates, to: value })}
        />
        <button onClick={() => load()} className="button-primary">
          Buscar
        </button>
      </section>
      <section className="overflow-x-auto border bg-white">
        <table className="w-full min-w-[780px] text-sm"><thead className="bg-slate-100 text-left"><tr>
          <WorkerSortHead label="Fecha" field="fecha" sort={sort} set={changeSort} /><WorkerSortHead label="Trabajador" field="trabajador" sort={sort} set={changeSort} /><WorkerSortHead label="Recibo" field="recibo" sort={sort} set={changeSort} /><WorkerSortHead label="Cliente" field="cliente" sort={sort} set={changeSort} /><WorkerSortHead label="Pago" field="metodoPago" sort={sort} set={changeSort} /><WorkerSortHead label="Estado" field="estado" sort={sort} set={changeSort} /><WorkerSortHead label="Total" field="total" sort={sort} set={changeSort} />
        </tr></thead><tbody>
        {visibleRows.map((row) => (
          <tr key={`${row.idVenta}-${row.recibo}`} className="border-t">
            <Td>{formatGuatemalaDateTime(row.fecha)}</Td>
            <Td strong>{row.trabajador}</Td>
            <Td>{row.recibo || "—"}</Td>
            <Td>{row.cliente || "Consumidor Final"}</Td>
            <Td>{row.metodoPago || "—"}</Td>
            <Td>{row.estado}</Td>
            <Td>{money.format(row.total)}</Td>
          </tr>
        ))}
        </tbody></table>
        {!rows.length && <p className="p-8 text-center text-slate-500">No hay ventas en el período seleccionado.</p>}
        <div className="flex flex-col gap-3 border-t-2 border-slate-300 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Total de las {rows.length} ventas filtradas <strong className="ml-2 text-lg text-slate-900">{money.format(filteredTotal)}</strong></p><div className="flex items-center gap-2 text-sm"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border bg-white px-3 py-1.5 disabled:opacity-40">Anterior</button><span>Página {page} de {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(page + 1)} className="rounded border bg-white px-3 py-1.5 disabled:opacity-40">Siguiente</button></div></div>
      </section>
    </Page>
  );
}

function WorkerSortHead({ label, field, sort, set }) {
  const Icon = sort.key !== field ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
  return <th className="px-3 py-3"><button type="button" onClick={() => set(field)} className="inline-flex items-center gap-1 whitespace-nowrap">{label}<Icon className="h-3.5 w-3.5 text-slate-400" /></button></th>;
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
function Panel({ title, children }) {
  return (
    <section className="space-y-4 border bg-white p-5">
      <h2 className="border-b pb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
function EditModal({ title, close, children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={close}><section className="my-6 w-full max-w-xl space-y-4 border bg-white p-6 shadow-xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b pb-3"><h2 className="text-lg font-bold">{title}</h2><button onClick={close} className="rounded-full border px-3 py-1" aria-label="Cerrar">×</button></div>{children}</section></div>;
}
function Toggle({ checked, set, label }) {
  return <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><button type="button" role="switch" aria-checked={checked} onClick={() => set(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></button><span className={checked ? "text-emerald-700" : "text-red-600"}>{label}</span></label>;
}
function Field({ label, value, set, type = "text", ...props }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        {...props}
        type={type}
        className="input mt-1"
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
function DateField({ label, value, set }) {
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
      date.getFullYear() !== Number(match[3]) ||
      date.getMonth() + 1 !== Number(match[2]) ||
      date.getDate() !== Number(match[1])
    )
      return setText(display(value));
    set(iso);
  };
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        className="input mt-1"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={text}
        onChange={(event) =>
          setText(event.target.value.replace(/[^\d/]/g, "").slice(0, 10))
        }
        onBlur={commit}
      />
    </label>
  );
}
function Select({ label, value, set, options }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <select
        className="input mt-1"
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        {options.map(([id, name]) => (
          <option key={id || "empty"} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
function Table({ headers, children }) {
  return (
    <section className="overflow-x-auto border bg-white">
      <table className="w-full min-w-[780px] text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {!children?.length && (
        <p className="p-8 text-center text-slate-500">No hay registros.</p>
      )}
    </section>
  );
}
function Td({ children, strong }) {
  return <td className={`px-3 py-3 align-middle ${strong ? "font-semibold" : ""}`}>{children}</td>;
}
function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-5 py-3 text-sm font-semibold ${active ? "border-brand-teal text-brand-teal" : "border-transparent text-slate-500"}`}
    >
      {children}
    </button>
  );
}
function Filters({ dates, setDates, search }) {
  return (
    <section className="flex flex-wrap gap-3 border bg-white p-4">
      <DateField
        value={dates.from}
        set={(value) => setDates({ ...dates, from: value })}
      />
      <DateField
        value={dates.to}
        set={(value) => setDates({ ...dates, to: value })}
      />
      <button onClick={search} className="button-primary">
        Consultar
      </button>
    </section>
  );
}
const CHART_COLORS = [
  "#008BA8",
  "#F2B705",
  "#16a34a",
  "#7c3aed",
  "#ea580c",
  "#dc2626",
  "#0891b2",
  "#65a30d",
];
const compactNumber = (value) =>
  new Intl.NumberFormat("es-GT", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
function ChartPanel({ title, children }) {
  return (
    <section className="border bg-white p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
function InteractiveBar({ title, rows, valueKey, moneyValues, showBranch, color }) {
  const data = rows.map((row) => ({
    ...row,
    etiqueta: showBranch
      ? `${row.trabajador} · ${row.sucursal}`
      : row.trabajador,
  }));
  return (
    <ChartPanel title={title}>
      <ResponsiveContainer width="100%" height={330}>
        <ReBarChart data={data} margin={{ bottom: 55 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="etiqueta"
            angle={-25}
            textAnchor="end"
            interval={0}
            height={80}
          />
          <YAxis
            tickFormatter={(value) =>
              moneyValues ? compactNumber(value) : value
            }
          />
          <Tooltip
            formatter={(value) => (moneyValues ? money.format(value) : value)}
            cursor={{ fill: "#ecfeff" }}
          />
          <Bar
            dataKey={valueKey}
            name={moneyValues ? "Total vendido" : "Valor"}
            fill={color}
            radius={[6, 6, 0, 0]}
            activeBar={{ fill: color }}
          />
        </ReBarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
function InteractivePie({ title, rows, color }) {
  return (
    <ChartPanel title={title}>
      <ResponsiveContainer width="100%" height={330}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="totalVendido"
            nameKey="trabajador"
            innerRadius={65}
            outerRadius={110}
            paddingAngle={3}
            label={({ percent }) => `${Math.round(percent * 100)}%`}
          >
            {rows.map((row, index) => (
              <Cell
                key={row.idVendedor}
                fill={(index === 0 ? color : CHART_COLORS[index % CHART_COLORS.length])}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => money.format(value)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
function EvaluationRadar({ rows, color }) {
  return (
    <ChartPanel title="Comparativa de evaluación">
      <ResponsiveContainer width="100%" height={330}>
        <RadarChart data={rows}>
          <PolarGrid />
          <PolarAngleAxis dataKey="trabajador" />
          <Tooltip formatter={(value) => `${Number(value).toFixed(1)} / 5`} />
          <Radar
            name="Evaluación"
            dataKey="promedioEvaluacion"
            stroke={color}
            fill={color}
            fillOpacity={0.55}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
function StatusConfirm({ worker, close, accept }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-md border bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">
          {worker.activo ? "Desactivar trabajador" : "Reactivar trabajador"}
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          {worker.activo
            ? `${worker.nombre} dejará de aparecer en nuevas ventas. Su historial y estadísticas se conservarán.`
            : `${worker.nombre} volverá a estar disponible para nuevas ventas.`}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={close} className="button-secondary">
            Cancelar
          </button>
          <button
            onClick={accept}
            className={
              worker.activo
                ? "border border-red-300 px-4 py-2 font-semibold text-red-700"
                : "button-primary"
            }
          >
            {worker.activo ? "Sí, desactivar" : "Reactivar"}
          </button>
        </div>
      </section>
    </div>
  );
}
function Metric({ label, value }) {
  return (
    <div className="border bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
