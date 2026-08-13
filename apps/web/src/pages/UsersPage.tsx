import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ToggleLeft, ToggleRight } from "@phosphor-icons/react";
import { useState } from "react";
import { api } from "../lib/api";

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export function UsersPage() {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserRow[]>("/admin/users"),
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const form = new FormData(e.currentTarget);
      const body = Object.fromEntries(form);
      await api("/admin/users", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      e.currentTarget.reset();
      await qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      setError(err?.message || "Gagal menambah petugas");
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (u: UserRow) => {
    try {
      await api(`/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      await qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      alert(err?.message || "Gagal mengubah status");
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <p className="kicker">AKSES SISTEM</p>
          <h1>Petugas</h1>
        </div>
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus />
          Tambah Petugas
        </button>
      </header>
      {open && (
        <form className="inline-form" onSubmit={(e) => void create(e)}>
          <input name="displayName" placeholder="Nama petugas" required />
          <input name="username" placeholder="Username" required />
          <input
            name="password"
            type="password"
            placeholder="Password minimal 10 karakter"
            minLength={10}
            required
          />
          <input type="hidden" name="role" value="operator" />
          <button className="button dark" disabled={loading}>
            {loading ? "Menyimpan…" : "Simpan"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.displayName}</strong>
                </td>
                <td className="mono">{u.username}</td>
                <td>{u.role}</td>
                <td>
                  <span className={`badge ${u.isActive ? "paid" : "muted"}`}>
                    {u.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    onClick={() => void toggle(u)}
                  >
                    {u.isActive ? (
                      <ToggleRight size={28} />
                    ) : (
                      <ToggleLeft size={28} />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
