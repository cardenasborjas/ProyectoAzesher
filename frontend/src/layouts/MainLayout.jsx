import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Box,
  ShoppingCart,
  LogOut,
  ReceiptText,
  PackageSearch,
  ClipboardList,
  Menu,
  Bell,
  Building2,
  ChevronDown,
  User as UserIcon,
  FilePlus2,
  Files,
  Truck,
  WalletCards,
  UserRoundPlus,
  History,
  BarChart3,
  Banknote,
  Settings2,
  HandCoins,
  ListChecks,
  ShieldCheck,
  ContactRound,
  Star,
  ScrollText,
  TrendingUp,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoAzeShers from "../assets/logo.png";
import { clearSalesDraft } from "../state/ventasDraftStore";
import { getPendingRequests } from "../api/axiosClient";
import NotificationMenu from "../components/NotificationMenu";
import LoadingIndicator from "../components/LoadingIndicator";
import SessionExpiryGuard from "../components/SessionExpiryGuard";

export default function MainLayout({ children }) {
  const {
    user,
    logout,
    sucursales,
    selectedSucursalId,
    setSelectedSucursalId,
    isSucursalLocked,
    isAdministrator,
    hasModuleAccess,
  } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = useCallback(() => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    window.setTimeout(logout, 650);
  }, [isLoggingOut, logout]);
  useEffect(() => {
    let delay;
    const onActivity = event => {
      window.clearTimeout(delay);
      if (event.detail > 0) delay = window.setTimeout(() => setLoading(true), 180);
      else setLoading(false);
    };
    window.addEventListener('api-activity', onActivity);
    onActivity({ detail: getPendingRequests() });
    return () => { window.removeEventListener('api-activity', onActivity); window.clearTimeout(delay); };
  }, []);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    const saleFlow = (path) => path === "/ventas" || path === "/ventas/recibo-preview";
    if (saleFlow(previousPath.current) && !saleFlow(location.pathname)) clearSalesDraft();
    previousPath.current = location.pathname;
  }, [location.pathname]);
  // Estado para controlar si el menú lateral está abierto o cerrado
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const [isVentasOpen, setIsVentasOpen] = useState(() =>
    location.pathname.startsWith("/ventas"),
  );
  const [isInventariosOpen, setIsInventariosOpen] = useState(() =>
    location.pathname.startsWith("/inventarios"),
  );
  const [isCajaOpen, setIsCajaOpen] = useState(() =>
    location.pathname.startsWith("/caja"),
  );
  const [isClientesOpen, setIsClientesOpen] = useState(() =>
    location.pathname.startsWith("/clientes"),
  );
  const [isReportesOpen, setIsReportesOpen] = useState(() =>
    location.pathname.startsWith("/reportes"),
  );
  const [isCobrosOpen, setIsCobrosOpen] = useState(() =>
    location.pathname.startsWith("/cobros"),
  );
  const [isTrabajadoresOpen, setIsTrabajadoresOpen] = useState(() =>
    location.pathname.startsWith("/trabajadores"),
  );
  const [isConfigOpen, setIsConfigOpen] = useState(() => location.pathname.startsWith("/configuracion"));
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  useEffect(() => {
    if (location.pathname.startsWith('/trabajadores')) setIsTrabajadoresOpen(true);
    if (location.pathname.startsWith('/configuracion')) setIsConfigOpen(true);
    if (location.pathname.startsWith('/clientes')) setIsClientesOpen(true);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);
  const selectedBranch = sucursales.find(
    (branch) => String(branch.idSucursal) === String(selectedSucursalId),
  );
  const branchColor = selectedBranch?.colorIdentificacion || "#008BA8";

  return (
    <div
      className="flex h-screen bg-slate-50 overflow-hidden"
      style={{ "--branch-color": branchColor }}
    >
      {isLoggingOut && <LoadingIndicator fullScreen label="Cerrando sesión…" />}
      <SessionExpiryGuard onLogout={handleLogout} />
      {isSidebarOpen && <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-20 bg-slate-900/40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      {/* MENÚ LATERAL (SIDEBAR) COLAPSABLE */}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-white shadow-xl transition-transform duration-300 ease-in-out md:relative md:inset-auto md:shadow-none
                ${isSidebarOpen ? "translate-x-0 md:w-64" : "-translate-x-full md:w-0 md:translate-x-0 md:overflow-hidden"}`}
      >
        {/* Contenedor del Logo (se oculta si se cierra el menú) */}
        <div
          className={`p-4 border-b border-gray-100 flex justify-center items-center h-34 transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}
        >
          <NavLink to="/dashboard" aria-label="Ir al inicio" className="flex h-full items-center justify-center"><img
            src={logoAzeShers}
            alt="Logo Aze-Sher's"
            className="h-full w-auto object-contain drop-shadow-sm min-w-[120px]"
          /></NavLink>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto whitespace-nowrap" onClick={(event) => { if (event.target.closest("a") && window.innerWidth < 768) setIsSidebarOpen(false); }}>
          <NavLink to="/perfil" className={({ isActive }) => `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${isActive ? "bg-brand-teal text-white" : "text-slate-600 hover:bg-slate-50"}`}><UserIcon className="h-5 w-5" />Mi perfil</NavLink>
          <NavLink to="/alertas" className={({ isActive }) => `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${isActive ? "bg-brand-teal text-white" : "text-slate-600 hover:bg-slate-50"}`}><Bell className="h-5 w-5" />Alertas</NavLink>
          {hasModuleAccess("dashboard") && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `hidden items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors md:flex ${isActive ? "bg-brand-teal text-white" : "text-slate-600 hover:bg-slate-50"}`
              }
            >
              <LayoutDashboard className="h-5 w-5 min-w-[20px]" />
              <span className={!isSidebarOpen ? "hidden" : "block"}>
                Dashboard
              </span>
            </NavLink>
          )}
          {hasModuleAccess("inventarios") && (
            <button
              type="button"
              onClick={() => setIsInventariosOpen((current) => !current)}
              className={`hidden w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors md:flex ${location.pathname.startsWith("/inventarios") ? "bg-brand-teal text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Box className="h-5 w-5 min-w-[20px]" />
              <span className={!isSidebarOpen ? "hidden" : "block"}>
                Inventarios
              </span>
              <ChevronDown
                className={`ml-auto h-4 w-4 transition-transform ${isInventariosOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}
          {hasModuleAccess("inventarios") && isInventariosOpen && (
            <div className="ml-5 hidden space-y-1 border-l border-slate-200 pl-3 md:block">
              <SubLink to="/inventarios/productos" icon={PackageSearch} className="hidden md:flex" permission="inventarios.productos">Listado de productos</SubLink>
              <SubLink to="/inventarios/entrada-pedido" icon={ClipboardList} permission="inventarios.entradas">Entrada de pedido</SubLink>
              <SubLink to="/inventarios/entradas" icon={History} permission="inventarios.entradas">Historial de entradas</SubLink>
              <SubLink to="/inventarios/salidas" icon={PackageSearch} permission="inventarios.salidas">Salida de producto</SubLink>
              <SubLink to="/inventarios/proveedores" icon={Truck} permission="inventarios.proveedores">Proveedores</SubLink>
              {isAdministrator && (
                <>
                  <SubLink to="/inventarios/traslados/nuevo" icon={ClipboardList} permission="inventarios.traslados">Nuevo traslado</SubLink>
                  <SubLink to="/inventarios/traslados" icon={History} permission="inventarios.traslados">Historial de traslados</SubLink>
                </>
              )}
            </div>
          )}
          {hasModuleAccess("ventas") && (
            <button
              type="button"
              onClick={() => setIsVentasOpen((current) => !current)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${location.pathname.startsWith("/ventas") ? "bg-brand-teal text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <ShoppingCart className="h-5 w-5 min-w-[20px]" />
              <span className={!isSidebarOpen ? "hidden" : "block"}>
                Ventas
              </span>
              <ChevronDown
                className={`ml-auto h-4 w-4 transition-transform ${isVentasOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}
          {hasModuleAccess("ventas") && isVentasOpen && (
            <div className="ml-5 space-y-1 border-l border-slate-200 pl-3">
              <SubLink to="/ventas" icon={ShoppingCart} permission="ventas.venta">Venta de productos</SubLink>
              <SubLink to="/ventas/recibos" icon={ReceiptText} className="hidden md:flex" permission="ventas.recibos">Recibos</SubLink>
              <SubLink to="/ventas/facturas/crear" icon={FilePlus2} className="hidden md:flex" permission="ventas.facturas">Crear factura</SubLink>
              <SubLink to="/ventas/facturas" icon={Files} className="hidden md:flex" permission="ventas.facturas">Listado de facturas</SubLink>
            </div>
          )}
          {hasModuleAccess("caja") && (
            <MenuGroup
              mobileHidden
              label="Control de caja"
              icon={WalletCards}
              open={isCajaOpen}
              active={location.pathname.startsWith("/caja")}
              onClick={() => setIsCajaOpen((value) => !value)}
            >
              <SubLink to="/caja/apertura-cierre" icon={Banknote} permission="caja.apertura">
                Apertura y cierre
              </SubLink>
              <SubLink to="/caja/cierres" icon={History} permission="caja.cierres">
                Listado de cierres
              </SubLink>
            </MenuGroup>
          )}
          {hasModuleAccess("clientes") && (
            <MenuGroup
              mobileHidden
              label="Gestión de clientes"
              icon={Users}
              open={isClientesOpen}
              active={location.pathname.startsWith("/clientes")}
              onClick={() => setIsClientesOpen((value) => !value)}
            >
              <SubLink to="/clientes/crear" icon={UserRoundPlus} permission="clientes.listado">
                Crear cliente
              </SubLink>
              <SubLink to="/clientes/listado" icon={History} permission="clientes.listado">
                Listado de clientes
              </SubLink>
            </MenuGroup>
          )}
          {hasModuleAccess("cobros") && (
            <MenuGroup
              label="Cobros"
              icon={HandCoins}
              open={isCobrosOpen}
              active={location.pathname.startsWith("/cobros")}
              onClick={() => setIsCobrosOpen((value) => !value)}
            >
              <SubLink to="/cobros/estado-cuenta" icon={ReceiptText} className="hidden md:flex" permission="cobros.estado">
                Estado de cuenta
              </SubLink>
              <SubLink to="/cobros/pagar" icon={Banknote} className="hidden md:flex" permission="cobros.abonos">
                Pagar abono
              </SubLink>
              <SubLink to="/cobros/listado" icon={ListChecks} className="hidden md:flex" permission="cobros.listado">
                Listado de cobros
              </SubLink>
              {isAdministrator && (
                <SubLink to="/cobros/autorizar" icon={ShieldCheck} permission="cobros.autorizar">
                  Autorizar crédito
                </SubLink>
              )}
            </MenuGroup>
          )}
          {hasModuleAccess("reportes") && (
            <MenuGroup
              mobileHidden
              label="Reportes"
              icon={BarChart3}
              open={isReportesOpen}
              active={location.pathname.startsWith("/reportes")}
              onClick={() => setIsReportesOpen((value) => !value)}
            >
              <SubLink to="/reportes/consolidado" icon={BarChart3} permission="reportes.consolidado">
                Listado de reportes
              </SubLink>
              <SubLink to="/reportes/ganancias" icon={TrendingUp} permission="reportes.ganancias">
                Control de ganancias
              </SubLink>
            </MenuGroup>
          )}
          {hasModuleAccess("trabajadores") && (
            <MenuGroup
              mobileHidden
              label="Trabajadores"
              icon={ContactRound}
              open={isTrabajadoresOpen}
              active={location.pathname.startsWith("/trabajadores")}
              onClick={() => setIsTrabajadoresOpen((value) => !value)}
            >
              {isAdministrator && (
                <SubLink to="/trabajadores/registro" icon={UserRoundPlus} permission="trabajadores.registro">
                  Registro
                </SubLink>
              )}
              <SubLink to="/trabajadores/kpis" icon={BarChart3} permission="trabajadores.kpis">
                KPIs
              </SubLink>
              {isAdministrator && (
                <SubLink to="/trabajadores/evaluacion" icon={Star} permission="trabajadores.evaluacion">
                  Evaluar trabajador
                </SubLink>
              )}
              <SubLink to="/trabajadores/ventas" icon={ReceiptText} permission="trabajadores.ventas">
                Ventas por trabajador
              </SubLink>
              <SubLink to="/trabajadores/planilla" icon={Banknote} permission="trabajadores.planilla">
                Planilla
              </SubLink>
            </MenuGroup>
          )}
          {hasModuleAccess("configuracion") && (
            <MenuGroup mobileHidden label="Configuración" icon={Settings2} open={isConfigOpen} active={location.pathname.startsWith("/configuracion")} onClick={() => setIsConfigOpen((value) => !value)}>
              <SubLink to="/configuracion/datos-maestros" icon={Settings2} permission="configuracion.datos">Datos maestros</SubLink>
              {isAdministrator && <SubLink to="/configuracion/usuarios" icon={UserIcon} permission="configuracion.usuarios">Usuarios</SubLink>}
            </MenuGroup>
          )}
          {isAdministrator && (
            <NavLink to="/bitacora" className={({ isActive }) => `hidden items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium md:flex ${isActive ? "bg-brand-teal text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              <ScrollText className="h-5 w-5" />
              Bitácora e histórico
            </NavLink>
          )}
        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL Y NAVBAR SUPERIOR */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER (Barra Superior tipo imagen) */}
        <header className="z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-2 sm:px-6">
          {/* Botón de Hamburguesa para colapsar/abrir el menú */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            type="button"
            aria-label={isSidebarOpen ? "Cerrar menú principal" : "Abrir menú principal"}
            aria-expanded={isSidebarOpen}
            className="p-2 text-slate-400 hover:text-brand-teal hover:bg-teal-50 rounded-lg transition-colors focus:outline-none"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Lado derecho del Header */}
          <div className="flex min-w-0 items-center gap-1 sm:gap-5">
            <span className="hidden min-w-[190px] whitespace-nowrap text-center text-lg font-bold tracking-tight text-slate-700 lg:block">
              Atrévete a soñar
            </span>
            {/* 1. Combobox de Sucursales */}
            <div className="relative flex min-w-0 max-w-28 items-center rounded-lg border border-gray-200 bg-white transition-colors hover:bg-slate-50 focus-within:border-brand-teal focus-within:ring-1 focus-within:ring-brand-teal sm:max-w-none">
              <span
                className="ml-2 hidden h-3 w-3 rounded-sm border border-black/10 sm:block"
                style={{ backgroundColor: branchColor }}
              />
              <div className="hidden pl-3 pointer-events-none sm:block">
                <Building2 className="h-4 w-4 text-slate-400" />
              </div>
              <select
                className="w-full min-w-0 cursor-pointer appearance-none bg-transparent py-2 pl-2 pr-6 text-xs font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-400 sm:pr-8 sm:text-sm"
                value={selectedSucursalId}
                onChange={(event) => setSelectedSucursalId(event.target.value)}
                disabled={isSucursalLocked}
                title={
                  isSucursalLocked
                    ? "Finaliza la venta o vacía el pedido para cambiar de sucursal."
                    : "Seleccionar sucursal"
                }
              >
                {sucursales.map((sucursal) => (
                  <option key={sucursal.idSucursal} value={sucursal.idSucursal}>
                    {sucursal.nombreSuc}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-1 sm:right-3">
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            <NotificationMenu />

            {/* Línea divisora vertical */}
            <div className="hidden sm:block h-8 w-px bg-gray-200 mx-1"></div>

            {/* 3. Perfil de Usuario */}
            <div className="relative"><button type="button" onClick={() => setIsProfileOpen((value) => !value)} title="Opciones de perfil" aria-label="Opciones de perfil" aria-expanded={isProfileOpen} className="group flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-slate-50">
              {/* Avatar circular */}
              <div className="h-9 w-9 bg-brand-teal rounded-full flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition-shadow">
                <UserIcon className="h-5 w-5" />
              </div>

              {/* Textos del usuario */}
              <div className="hidden flex-col text-left sm:flex">
                <span className="text-sm font-bold text-slate-800 leading-none">
                  {user?.nombre || user?.unique_name || "Administrador general"}
                </span>
                <span className="text-xs text-slate-500 mt-1 leading-none">
                  {user?.role || "Dueño"}
                </span>
              </div>

              <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 hidden sm:block" />
            </button>{isProfileOpen && <><button aria-label="Cerrar menú de perfil" className="fixed inset-0 z-40 cursor-default" onClick={() => setIsProfileOpen(false)} /><div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border bg-white py-2 shadow-xl"><NavLink to="/perfil?seccion=datos" className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-50"><UserIcon className="h-4 w-4" />Editar perfil</NavLink><NavLink to="/perfil?seccion=password" className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />Cambiar contraseña</NavLink><button onClick={handleLogout} className="flex w-full items-center gap-2 border-t px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Cerrar sesión</button></div></>}</div>
          </div>
        </header>

        {/* CONTENIDO DE LA PÁGINA */}
        <main
          className="branch-context relative flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6"
        >
          <div>{children}</div>
          {loading && <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-1 overflow-hidden bg-slate-200"><span className="block h-full w-1/3 animate-pulse bg-[var(--branch-color)]" /></div>}
        </main>
      </div>
    </div>
  );
}

function MenuGroup({ label, icon: Icon, open, active, onClick, children, mobileHidden = false }) {
  return (
    <div className={mobileHidden ? "hidden md:block" : "block"}>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-label={`${open ? "Cerrar" : "Abrir"} ${label}`}
        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${active ? "bg-brand-teal text-white" : "text-slate-600 hover:bg-slate-50"}`}
      >
        <Icon className="h-5 w-5 min-w-[20px]" />
        <span>{label}</span>
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="ml-5 space-y-1 border-l border-slate-200 pl-3">
          {children}
        </div>
      )}
    </div>
  );
}

function SubLink({ to, icon: Icon, children, className = "", permission }) {
  const { hasModuleAccess } = useAuth();
  if (permission && !hasModuleAccess(permission)) return null;

  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${className} ${isActive ? "bg-teal-50 font-semibold text-brand-teal" : "text-slate-600 hover:bg-slate-50"}`
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </NavLink>
  );
}
