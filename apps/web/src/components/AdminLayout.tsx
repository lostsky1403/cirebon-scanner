import { useQueryClient } from "@tanstack/react-query";
import { House, QrCode, SignOut, Ticket, UploadSimple, UsersThree, DoorOpen, ListBullets } from "@phosphor-icons/react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const links = [
  ["/admin", "Ringkasan", House], ["/admin/tickets", "Peserta", Ticket], ["/admin/import", "Import", UploadSimple], ["/admin/users", "Petugas", UsersThree], ["/admin/gates", "Gate", DoorOpen], ["/admin/audit", "Audit", ListBullets]
] as const;

export function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = async () => { try { await api("/auth/logout", { method: "POST" }); } finally { queryClient.clear(); navigate("/login", { replace: true }); } };
  return <div className="admin-shell"><aside className="sidebar"><div className="brand"><span>CPJ</span><small>CONTROL ROOM</small></div><nav>{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/admin"}><Icon size={21} weight="bold" />{label}</NavLink>)}</nav><NavLink to="/scan"><QrCode size={21} weight="bold" />Buka Scanner</NavLink><button className="nav-button" onClick={() => void logout()}><SignOut size={21} />Keluar</button></aside><main className="admin-main"><Outlet /></main></div>;
}
