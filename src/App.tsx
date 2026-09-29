import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Overview } from "./pages/Overview";
import { SyncLog } from "./pages/SyncLog";
import { Quarantine } from "./pages/Quarantine";
import { ClientMapping } from "./pages/ClientMapping";
import { SystemStatus } from "./pages/SystemStatus";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Overview /> },
      { path: "log", element: <SyncLog /> },
      { path: "quarentena", element: <Quarantine /> },
      { path: "clientes", element: <ClientMapping /> },
      { path: "status", element: <SystemStatus /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
