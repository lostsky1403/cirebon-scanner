import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { getSession } from "../lib/api";

export function AuthGuard({ admin = false }: { admin?: boolean }) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, retry: false });
  if (session.isPending) return <main className="center-screen"><div className="brand-mark">CPJ</div><p>Menyiapkan sistem…</p></main>;
  if (session.isError) return <Navigate to="/login" replace />;
  if (admin && session.data.user.role !== "admin") return <Navigate to="/scan" replace />;
  return <Outlet />;
}
