import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, LockKey, User } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(""); try { const result = await api<{ user: { role: string } }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }); queryClient.clear(); queryClient.setQueryData(["session"], result); navigate(result.user.role === "admin" ? "/admin" : "/scan", { replace: true }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Login gagal"); } finally { setLoading(false); } };
  return <main className="login-page"><section className="login-intro"><div className="eyebrow">ANNIVERSARY 2ND</div><h1>CIREBON<br/><span>PRIDE</span> JAPAN</h1><p>Venue access control untuk pemeriksaan tiket yang cepat, akurat, dan terkoordinasi.</p><div className="japan-disc" /></section><section className="login-panel"><form onSubmit={(event) => void submit(event)}><div className="brand-mark">CPJ</div><div><p className="kicker">AKSES PETUGAS</p><h2>Masuk ke scanner</h2></div><label>Username<div className="input-wrap"><User size={20}/><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required /></div></label><label>Password<div className="input-wrap"><LockKey size={20}/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={8}/></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={loading}>{loading ? "Memeriksa…" : "Masuk"}<ArrowRight size={20}/></button><p className="security-note">Akses terbatas untuk petugas resmi CPJ.</p></form></section></main>;
}
