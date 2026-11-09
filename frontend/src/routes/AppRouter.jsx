import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import VentasPage from "../pages/VentasPage";
import ReciboPreviewPage from "../pages/ReciboPreviewPage";
import MainLayout from "../layouts/MainLayout";
import RecibosPage from "../pages/RecibosPage";
import InventarioProductosPage from "../pages/InventarioProductosPage";
import EntradaPedidoPage from "../pages/EntradaPedidoPage";
import CrearFacturaPage from "../pages/CrearFacturaPage";
import FacturasPage from "../pages/FacturasPage";
import ProveedoresPage from "../pages/ProveedoresPage";
import ControlCajaPage from "../pages/ControlCajaPage";
import ClientesPage from "../pages/ClientesPage";
import ReportesPage from "../pages/ReportesPage";
import ControlGananciasPage from "../pages/ControlGananciasPage";
import DatosMaestrosPage from "../pages/DatosMaestrosPage";
import TrasladosPage from "../pages/TrasladosPage";
import CobrosPage from "../pages/CobrosPage";
import AlertasPage from "../pages/AlertasPage";
import TrabajadoresPage from "../pages/TrabajadoresPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import BitacoraPage from "../pages/BitacoraPage";
import SalidaInventarioPage from "../pages/SalidaInventarioPage";
import PlanillaPage from "../pages/PlanillaPage";
import MobileBarcodeScannerPage from "../pages/MobileBarcodeScannerPage";
import ProfilePage from "../pages/ProfilePage";
import NotFoundPage from "../pages/NotFoundPage";

const ProtectedRoute = ({ children, module }) => {
  const { user, hasModuleAccess } = useAuth();
  // Si no hay usuario, lo manda al login
  if (!user) return <Navigate to="/" replace />;
  if (module && !hasModuleAccess(module))
    return <Navigate to="/sin-acceso" replace />;
  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
};

const UnknownRoute = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <MainLayout><NotFoundPage /></MainLayout>;
};

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/restablecer-password" element={<ResetPasswordPage />} />
          <Route path="/lector/:token" element={<MobileBarcodeScannerPage />} />
          <Route path="/perfil" element={<ProtectedRoute><MainLayout><ProfilePage /></MainLayout></ProtectedRoute>} />
          <Route
            path="/sin-acceso"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <section className="border bg-white p-8">
                    <h1 className="text-2xl font-bold">Sin acceso</h1>
                    <p className="mt-2 text-slate-600">
                      Tu usuario no tiene permiso para abrir este módulo.
                    </p>
                  </section>
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute module="dashboard">
                <MainLayout>
                  <DashboardPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/ventas"
            element={
              <ProtectedRoute module="ventas.venta">
                <MainLayout>
                  <VentasPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/ventas/recibos"
            element={
              <ProtectedRoute module="ventas.recibos">
                <MainLayout>
                  <RecibosPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/ventas/recibo-preview"
            element={
              <ProtectedRoute module="ventas.recibos">
                <MainLayout>
                  <ReciboPreviewPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/inventarios"
            element={<Navigate to="/inventarios/productos" replace />}
          />
          <Route
            path="/inventarios/productos"
            element={
              <ProtectedRoute module="inventarios.productos">
                <MainLayout>
                  <InventarioProductosPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventarios/entrada-pedido"
            element={
              <ProtectedRoute module="inventarios.entradas">
                <MainLayout>
                  <EntradaPedidoPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/inventarios/salidas" element={<ProtectedRoute module="inventarios.salidas"><MainLayout><SalidaInventarioPage /></MainLayout></ProtectedRoute>} />
          <Route
            path="/inventarios/proveedores"
            element={
              <ProtectedRoute module="inventarios.proveedores">
                <MainLayout>
                  <ProveedoresPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventarios/traslados/nuevo"
            element={
              <ProtectedRoute module="inventarios.traslados">
                <MainLayout>
                  <TrasladosPage mode="create" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventarios/traslados"
            element={
              <ProtectedRoute module="inventarios.traslados">
                <MainLayout>
                  <TrasladosPage mode="history" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/facturas/crear"
            element={
              <ProtectedRoute module="ventas.facturas">
                <MainLayout>
                  <CrearFacturaPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/facturas"
            element={
              <ProtectedRoute module="ventas.facturas">
                <MainLayout>
                  <FacturasPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/caja"
            element={<Navigate to="/caja/apertura-cierre" replace />}
          />
          <Route
            path="/caja/apertura-cierre"
            element={
              <ProtectedRoute module="caja.apertura">
                <MainLayout>
                  <ControlCajaPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/caja/cierres"
            element={
              <ProtectedRoute module="caja.cierres">
                <MainLayout>
                  <ControlCajaPage mode="closures" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes"
            element={<Navigate to="/clientes/listado" replace />}
          />
          <Route
            path="/clientes/crear"
            element={<Navigate to="/clientes/listado?crear=1" replace />}
          />
          <Route
            path="/clientes/listado"
            element={
              <ProtectedRoute module="clientes.listado">
                <MainLayout>
                  <ClientesPage mode="list" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/historial"
            element={<Navigate to="/clientes/listado" replace />}
          />
          <Route
            path="/reportes"
            element={<Navigate to="/reportes/consolidado" replace />}
          />
          <Route
            path="/reportes/consolidado"
            element={
              <ProtectedRoute module="reportes.consolidado">
                <MainLayout>
                  <ReportesPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/reportes/ganancias" element={<ProtectedRoute module="reportes.ganancias"><MainLayout><ControlGananciasPage /></MainLayout></ProtectedRoute>} />
          <Route
            path="/configuracion/datos-maestros"
            element={
              <ProtectedRoute module="configuracion.datos">
                <MainLayout>
                  <DatosMaestrosPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/configuracion/usuarios" element={<ProtectedRoute module="configuracion.usuarios"><MainLayout><TrabajadoresPage mode="users" /></MainLayout></ProtectedRoute>} />
          <Route
            path="/cobros"
            element={<Navigate to="/cobros/listado" replace />}
          />
          <Route
            path="/cobros/estado-cuenta"
            element={
              <ProtectedRoute module="cobros.estado">
                <MainLayout>
                  <CobrosPage mode="statement" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cobros/pagar"
            element={
              <ProtectedRoute module="cobros.abonos">
                <MainLayout>
                  <CobrosPage mode="pay" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cobros/listado"
            element={
              <ProtectedRoute module="cobros.listado">
                <MainLayout>
                  <CobrosPage mode="list" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cobros/autorizar"
            element={
              <ProtectedRoute module="cobros.autorizar">
                <MainLayout>
                  <CobrosPage mode="authorize" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/alertas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <AlertasPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trabajadores"
            element={<Navigate to="/trabajadores/registro" replace />}
          />
          <Route
            path="/trabajadores/registro"
            element={
              <ProtectedRoute module="trabajadores.registro">
                <MainLayout>
                  <TrabajadoresPage mode="register" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trabajadores/kpis"
            element={
              <ProtectedRoute module="trabajadores.kpis">
                <MainLayout>
                  <TrabajadoresPage mode="kpis" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trabajadores/evaluacion"
            element={
              <ProtectedRoute module="trabajadores.evaluacion">
                <MainLayout>
                  <TrabajadoresPage mode="evaluation" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trabajadores/ventas"
            element={
              <ProtectedRoute module="trabajadores.ventas">
                <MainLayout>
                  <TrabajadoresPage mode="sales" />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trabajadores/planilla"
            element={
              <ProtectedRoute module="trabajadores.planilla">
                <MainLayout>
                  <PlanillaPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/bitacora" element={<ProtectedRoute module="bitacora"><MainLayout><BitacoraPage /></MainLayout></ProtectedRoute>} />

          <Route path="*" element={<UnknownRoute />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
