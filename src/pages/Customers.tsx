import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { customersApi, type Customer, type CustomerStatus } from "../api";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "name" | "email" | "company" | "status" | "createdAt" | "dni";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusLabel: Record<CustomerStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  PENDING: "Pendiente",
};

const statusStyles: Record<CustomerStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  INACTIVE: "bg-zinc-700/40 text-zinc-400 ring-1 ring-zinc-600/30",
  PENDING: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
};

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className={`ml-1 inline-flex flex-col gap-px ${active ? "text-teal-400" : "text-zinc-600"}`}
    >
      <svg
        className={`w-2.5 h-2.5 ${active && dir === "asc" ? "text-teal-400" : "text-zinc-600"}`}
        viewBox="0 0 10 6"
        fill="currentColor"
      >
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg
        className={`w-2.5 h-2.5 ${active && dir === "desc" ? "text-teal-400" : "text-zinc-600"}`}
        viewBox="0 0 10 6"
        fill="currentColor"
      >
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

type ColDef = { key: SortKey; label: string };
const columns: ColDef[] = [
  { key: "name", label: "Nombre" },
  { key: "email", label: "Email" },
  { key: "company", label: "Empresa" },
  { key: "status", label: "Estado" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Customers() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const load = useCallback(async () => {
    try {
      const data = await customersApi.list();
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.dni.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.domains.some((d) => d.toLowerCase().includes(q)),
    );
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        let av: string =
          sortKey === "status" ? statusLabel[a.status] : String(a[sortKey]);
        let bv: string =
          sortKey === "status" ? statusLabel[b.status] : String(b[sortKey]);
        av = av.toLowerCase();
        bv = bv.toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [customers, search, sortKey, sortDir]);

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Clientes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {customers.length} clientes registrados
          </p>
        </div>
        <button
          onClick={() => navigate("/customers/new")}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Nuevo cliente
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Activos",
            value: customers.filter((c) => c.status === "ACTIVE").length,
            color: "text-emerald-400",
          },
          {
            label: "Pendientes",
            value: customers.filter((c) => c.status === "PENDING").length,
            color: "text-amber-400",
          },
          {
            label: "Inactivos",
            value: customers.filter((c) => c.status === "INACTIVE").length,
            color: "text-zinc-400",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4"
          >
            <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre, email, empresa, DNI o dominio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* 👇 Contenedor añadido para habilitar el scroll horizontal */}
        <div className="overflow-x-auto">
          {/* 👇 Añadimos min-w-[800px] para asegurar que mantenga un tamaño legible en móvil */}
          <table className="w-full text-sm table-fixed min-w-200">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[24%]" />
              <col className="w-[20%]" />
              <col className="w-[13%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-5 py-3.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-300 transition-colors"
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </span>
                  </th>
                ))}
                <th className="px-5 py-3.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Dominios
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-zinc-500 text-sm"
                  >
                    Cargando clientes…
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <span
                        className="block font-medium text-zinc-200 truncate"
                        title={c.name}
                      >
                        {c.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="block text-zinc-400 truncate"
                        title={c.email}
                      >
                        {c.email}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="block text-zinc-400 truncate"
                        title={c.company || undefined}
                      >
                        {c.company || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusStyles[c.status]}`}
                      >
                        {statusLabel[c.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.domains.length > 0 ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="text-[10px] font-medium bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded truncate max-w-30"
                            title={c.domains[0]}
                          >
                            {c.domains[0]}
                          </span>
                          {c.domains.length > 1 && (
                            <span
                              className="text-[10px] font-medium bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded shrink-0"
                              title={c.domains.slice(1).join(", ")}
                            >
                              +{c.domains.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-zinc-500 text-sm"
                  >
                    {search
                      ? `No se encontraron clientes para «${search}».`
                      : "No hay clientes aún."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>{" "}
        {/* 👆 Cierre del contenedor de scroll */}
      </div>

      <p className="text-xs text-zinc-600 mt-3">
        {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        {sortKey && (
          <span className="ml-2 text-teal-500/60">
            · ordenado por{" "}
            {columns.find((c) => c.key === sortKey)?.label.toLowerCase()} (
            {sortDir === "asc" ? "↑" : "↓"})
          </span>
        )}
      </p>
    </div>
  );
}
