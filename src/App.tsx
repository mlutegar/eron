import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Login } from "./pages/Login";
import { Activate } from "./pages/Activate";
import { SyncLog } from "./pages/SyncLog";
import { Quarantine } from "./pages/Quarantine";
import { ClientMapping } from "./pages/ClientMapping";
import { SystemStatus } from "./pages/SystemStatus";

function ProtectedLayout() {
  const { authenticated } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function LoginRoute() {
  const { authenticated } = useAuth();
  if (authenticated) return <Navigate to="/" replace />;
  return <Login />;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginRoute /> },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Activate /> },
      { path: "log", element: <SyncLog /> },
      { path: "quarentena", element: <Quarantine /> },
      { path: "clientes", element: <ClientMapping /> },
      { path: "status", element: <SystemStatus /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
