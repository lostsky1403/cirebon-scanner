import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { AdminLayout } from "./components/AdminLayout";
import { AuthGuard } from "./components/AuthGuard";
import { AuditPage } from "./pages/AuditPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GatesPage } from "./pages/GatesPage";
import { ImportPage } from "./pages/ImportPage";
import { LoginPage } from "./pages/LoginPage";
import { ScannerPage } from "./pages/ScannerPage";
import { TicketsPage } from "./pages/TicketsPage";
import { UsersPage } from "./pages/UsersPage";
import "./styles.css";

registerSW({ onNeedRefresh() { const key = "cpj_sw_prompt"; const last = Number(localStorage.getItem(key) || 0); if (Date.now() - last < 12 * 3600 * 1000) return; localStorage.setItem(key, String(Date.now())); if (confirm("Versi baru tersedia. Muat ulang aplikasi?")) location.reload(); } });
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:10_000,retry:1}}});
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><BrowserRouter><Routes><Route path="/login" element={<LoginPage/>}/><Route element={<AuthGuard/>}><Route path="/scan" element={<ScannerPage/>}/></Route><Route element={<AuthGuard admin/>}><Route path="/admin" element={<AdminLayout/>}><Route index element={<DashboardPage/>}/><Route path="tickets" element={<TicketsPage/>}/><Route path="import" element={<ImportPage/>}/><Route path="users" element={<UsersPage/>}/><Route path="gates" element={<GatesPage/>}/><Route path="audit" element={<AuditPage/>}/></Route></Route><Route path="*" element={<Navigate to="/scan" replace/>}/></Routes></BrowserRouter></QueryClientProvider>);
