import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DotsThree, House, QrCode, SignOut, Ticket, UploadSimple, UsersThree, DoorOpen, ListBullets } from "@phosphor-icons/react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const links = [
  ["/admin", "Ringkasan", House], ["/admin/tickets", "Peserta", Ticket], ["/admin/import", "Import", UploadSimple], ["/admin/users", "Petugas", UsersThree], ["/admin/gates", "Gate", DoorOpen], ["/admin/audit", "Audit", ListBullets]
] as const;
const isPrimary = (to: string) => to === "/admin" || to === "/admin/tickets" || to === "/admin/users";

export function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [moreOpen, setMoreOpen] = useState(false);
  const logout = async () => { try { await api("/auth/logout", { method: "POST" }); } finally { queryClient.clear(); navigate("/login", { replace: true }); } };
  return <div className="admin-shell"><aside className="sidebar"><div className="brand"><span>CPJ</span><small>CONTROL ROOM</small></div><nav>{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/admin"} className={isPrimary(to) ? "" : "secondary-link"} onClick={() => setMoreOpen(false)}><Icon size={21} weight="bold" />{label}</NavLink>)}</nav><NavLink to="/scan" onClick={() => setMoreOpen(false)}><QrCode size={21} weight="bold" />Buka Scanner</NavLink><button className="nav-more" onClick={() => setMoreOpen((open) => !open)}><DotsThree size={21} />Lainnya</button><button className="nav-button" onClick={() => void logout()}><SignOut size={21} />Keluar</button></aside><main className="admin-main"><Outlet /></main>{moreOpen && <div className="more-backdrop" onClick={() => setMoreOpen(false)}><div className="more-menu" onClick={(event) => event.stopPropagation()}>{links.filter(([to]) => !isPrimary(to)).map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}><Icon size={20} />{label}</NavLink>)}<button onClick={() => void logout()}><SignOut size={20} />Keluar</button></div></div>}</div>;
}
