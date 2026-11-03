import { createContext, useContext, useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

const decodeValidToken = (token) => {
  if (!token) return null;
  try {
    const decoded = jwtDecode(token);
    return Number(decoded?.exp || 0) * 1000 > Date.now() ? decoded : null;
  } catch {
    return null;
  }
};

const getRoleName = (user) => {
  const rawRole =
    user?.role ||
    user?.rol ||
    user?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
    "";
  return String(rawRole).trim().toLowerCase();
};

const isAdministratorRole = (user) => {
  const role = getRoleName(user);
  return (
    role.includes("admin") || role === "demo" || role.includes("superusuario")
  );
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) return null;
    const decoded = decodeValidToken(storedToken);
    if (!decoded) localStorage.removeItem("token");
    return decoded;
  });

  const [sucursales, setSucursales] = useState(() => {
    const storedSucursales = localStorage.getItem("sucursales");
    return storedSucursales ? JSON.parse(storedSucursales) : [];
  });

  const [selectedSucursalId, setSelectedSucursalId] = useState(() => {
    const storedSucursal = localStorage.getItem("selectedSucursalId");
    const storedExists = sucursales.some(
      (branch) => String(branch.idSucursal) === String(storedSucursal),
    );
    return storedExists
      ? String(storedSucursal)
      : String(sucursales[0]?.idSucursal ?? "");
  });
  const [isSucursalLocked, setIsSucursalLocked] = useState(false);

  useEffect(() => {
    const syncSession = (event) => {
      if (event.key !== "token") return;
      const decoded = decodeValidToken(event.newValue);
      setUser(decoded);
      if (decoded) {
        try {
          setSucursales(JSON.parse(localStorage.getItem("sucursales") || "[]"));
        } catch {
          setSucursales([]);
        }
        setSelectedSucursalId(localStorage.getItem("selectedSucursalId") || "");
      } else {
        setSucursales([]);
        setSelectedSucursalId("");
        setIsSucursalLocked(false);
      }
    };
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axiosClient.post("/auth/login", {
        username,
        password,
      });

      if (response.data.success) {
        const { token, sucursales: sucursalesDB } = response.data.data;
        localStorage.setItem("sucursales", JSON.stringify(sucursalesDB));
        const decodedUser = jwtDecode(token);
        const tokenSucursal =
          Number(decodedUser?.id_sucursal) > 0
            ? String(decodedUser.id_sucursal)
            : "";
        const defaultSucursal = sucursalesDB.some(
          (branch) => String(branch.idSucursal) === tokenSucursal,
        )
          ? tokenSucursal
          : String(sucursalesDB[0]?.idSucursal ?? "");
        localStorage.setItem("selectedSucursalId", defaultSucursal);
        // Se guarda al final para que otras pestañas reciban toda la sesión.
        localStorage.setItem("token", token);
        setUser(decodedUser);
        setSucursales(sucursalesDB);
        setSelectedSucursalId(defaultSucursal);
        return { success: true };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Error al conectar con el servidor.",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("sucursales");
    localStorage.removeItem("selectedSucursalId");
    setUser(null);
    setSucursales([]);
    setSelectedSucursalId("");
    setIsSucursalLocked(false);
  };

  const updateToken = (token) => {
    const decoded = decodeValidToken(token);
    if (!decoded) return false;
    localStorage.setItem("token", token);
    setUser(decoded);
    return true;
  };

  const selectSucursal = (idSucursal) => {
    if (isSucursalLocked) return;

    const normalizedId = sucursales.some(
      (branch) => String(branch.idSucursal) === String(idSucursal),
    )
      ? String(idSucursal)
      : String(sucursales[0]?.idSucursal ?? "");
    localStorage.setItem("selectedSucursalId", normalizedId);
    setSelectedSucursalId(normalizedId);
  };

  const updateSucursalLocal = (idSucursal, changes) => {
    setSucursales((current) => {
      const updated = current.map((branch) =>
        String(branch.idSucursal) === String(idSucursal)
          ? { ...branch, ...changes }
          : branch,
      ).filter(branch => branch.activo !== false);
      localStorage.setItem("sucursales", JSON.stringify(updated));
      if (!updated.some(branch => String(branch.idSucursal) === String(selectedSucursalId))) {
        const next = String(updated[0]?.idSucursal ?? "");
        localStorage.setItem("selectedSucursalId", next);
        setSelectedSucursalId(next);
      }
      return updated;
    });
  };

  const hasModuleAccess = (moduleCode) => {
    if (isAdministratorRole(user)) return true;
    const raw = user?.permisos || "";
    return String(raw)
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .includes(String(moduleCode).toLowerCase());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sucursales,
        selectedSucursalId,
        setSelectedSucursalId: selectSucursal,
        updateSucursalLocal,
        isSucursalLocked,
        setIsSucursalLocked,
        login,
        updateToken,
        logout,
        isAdministrator: isAdministratorRole(user),
        hasModuleAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
