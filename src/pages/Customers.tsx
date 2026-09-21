import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronUp, ChevronDown } from "lucide-react";
import { customersApi, type CustomerStatus } from "../api";
import { Icon } from "../components/icons";
import { statusLabel } from "../utils/customerStatus";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "name" | "email" | "company" | "status" | "createdAt" | "dni";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dotStyles: Record<CustomerStatus, string> = {
  ACTIVE: "bg-emerald-500 dark:bg-emerald-400",
  PENDING: "bg-amber-500 dark:bg-amber-400",
  INACTIVE: "bg-zinc-400 dark:bg-zinc-500",
};

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className={`ml-1 inline-flex flex-col -space-y-1 ${active ? "text-teal-700 dark:text-teal-400" : "text-zinc-600"}`}
    >
      <ChevronUp
        className={`w-3 h-3 ${active && dir === "asc" ? "text-teal-700 dark:text-teal-400" : "text-zinc-600"}`}
        strokeWidth={3}
      />
      <ChevronDown
        className={`w-3 h-3 ${active && dir === "desc" ? "text-teal-700 dark:text-teal-400" : "text-zinc-600"}`}
        strokeWidth={3}
      />
    </span>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

type ColDef = { key: SortKey; label: string };
const columns: ColDef[] = [
  { key: "name", label: "Nombre" },
  { key: "email", label: "Email" },
  { key: "company", label: "Empresa" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Customers() {
  const navigate = useNavigate();

  const { data: customers = [], isLoading: loading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customersApi.list(),
  });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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
    <div className="px-6 lg:px-8 py-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Clientes
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {customers.length} clientes registrados
          </p>
        </div>
        <button
          onClick={() => navigate("/customers/new")}
          className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-base font-bold rounded-xl transition-colors"
        >
          <Icon name="plus" className="w-5 h-5" />
          Cliente
        </button>
      </div>

      {/* Búsqueda + stats: en la misma fila en escritorio para ahorrar
          espacio vertical; en móvil, la búsqueda arriba y las stats debajo
          en una rejilla (en vez de una fila que se envuelve de forma
          irregular según el ancho disponible). */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Icon
            name="search"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
          />
          <input
            type="text"
            placeholder="Buscar por nombre, email, empresa, DNI o dominio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors"
          />
        </div>

        <div className="grid grid-cols-3 lg:flex lg:items-center gap-2 lg:gap-x-6 lg:shrink-0 lg:px-5 lg:py-3.5 lg:bg-white lg:dark:bg-zinc-900 lg:border lg:border-zinc-200 lg:dark:border-zinc-800 lg:rounded-xl">
          {[
            {
              label: "Activos",
              value: customers.filter((c) => c.status === "ACTIVE").length,
              color: "text-emerald-700 dark:text-emerald-400",
            },
            {
              label: "Pendientes",
              value: customers.filter((c) => c.status === "PENDING").length,
              color: "text-amber-700 dark:text-amber-400",
            },
            {
              label: "Inactivos",
              value: customers.filter((c) => c.status === "INACTIVE").length,
              color: "text-zinc-600 dark:text-zinc-400",
            },
          ].map(({ label, value, color }, i) => (
            <div
              key={label}
              className={`flex flex-col lg:flex-row items-center lg:items-center gap-0.5 lg:gap-2 bg-white dark:bg-zinc-900 lg:bg-transparent border border-zinc-200 dark:border-zinc-800 lg:border-0 rounded-xl lg:rounded-none px-3 py-2.5 lg:px-0 lg:py-0 ${i > 0 ? "lg:border-l lg:border-zinc-200 lg:dark:border-zinc-800 lg:pl-6" : ""}`}
            >
              <span
                className={`text-lg lg:text-xl font-bold tabular-nums ${color}`}
              >
                {loading ? (
                  <span className="w-8 h-5 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse inline-block" />
                ) : (
                  value
                )}
              </span>
              <span className="text-[11px] lg:text-xs text-zinc-500 text-center lg:text-left leading-tight">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div>
          <table className="w-full text-base table-fixed">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[26%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-5 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
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
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
                    className="hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <span
                        className="block font-semibold text-base text-zinc-800 dark:text-zinc-200 truncate"
                        title={c.name}
                      >
                        {c.name}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="block text-zinc-600 dark:text-zinc-400 truncate"
                        title={c.email}
                      >
                        {c.email}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="block text-zinc-600 dark:text-zinc-400 truncate"
                        title={c.company || undefined}
                      >
                        {c.company || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {c.domains.length > 0 ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded truncate max-w-30"
                            title={c.domains[0]}
                          >
                            {c.domains[0]}
                          </span>
                          {c.domains.length > 1 && (
                            <span
                              className="text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded shrink-0"
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
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${dotStyles[c.status]}`}
                        title={statusLabel[c.status]}
                      />
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
          <span className="ml-2 text-teal-700/70 dark:text-teal-500/60">
            · ordenado por{" "}
            {columns.find((c) => c.key === sortKey)?.label.toLowerCase()} (
            {sortDir === "asc" ? "↑" : "↓"})
          </span>
        )}
      </p>
    </div>
  );
}
