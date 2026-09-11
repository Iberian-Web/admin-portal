import { useState, useEffect, useCallback } from "react";
import {
  applicationsApi,
  servicesApi,
  type Application,
  type Service,
} from "../api";

// ─── Icons ────────────────────────────────────────────────────────────────────
const ICONS: Record<string, { color: string; node: React.ReactNode }> = {
  restaurant: {
    color: "text-orange-700 dark:text-orange-400",
    node: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 20.188a23.702 23.702 0 01-6 0M15 20.188V17.25m-6 2.938V17.25m0 0a23.702 23.702 0 006 0m-6 0a4.125 4.125 0 01-3.915-4.124V15m0 0V10.608M18 10.608V15a4.125 4.125 0 01-3 3.977"
        />
      </svg>
    ),
  },
};

const FALLBACK_ICON = {
  color: "text-teal-700 dark:text-teal-400",
  node: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  ),
};

function getIcon(key: string) {
  return ICONS[key] ?? FALLBACK_ICON;
}

// ─── Price modal ──────────────────────────────────────────────────────────────
function PriceModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service;
  onClose: () => void;
  onSaved: (s: Service) => void;
}) {
  const [price, setPrice] = useState(service.price ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await servicesApi.update(service.id, { price: price.trim() }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg w-full max-w-sm p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          Editar precio
        </h3>
        <p className="text-xs text-zinc-500 mb-5">{service.name}</p>

        <input
          autoFocus
          className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
          placeholder="Ej. 29.99"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {error && (
          <p className="mt-3 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create service modal ─────────────────────────────────────────────────────
function CreateServiceModal({
  appId,
  appName,
  onClose,
  onCreated,
}: {
  appId: number;
  appName: string;
  onClose: () => void;
  onCreated: (s: Service) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onCreated(
        await servicesApi.create(appId, {
          name: name.trim(),
          description: description.trim(),
          price: price.trim(),
        }),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg w-full max-w-sm p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          Nuevo servicio
        </h3>
        <p className="text-xs text-zinc-500 mb-5">en {appName}</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
              Nombre <span className="text-teal-700 dark:text-teal-400">*</span>
            </label>
            <input
              autoFocus
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
              placeholder="Ej. Pantalla de cocina"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
              Descripción{" "}
              <span className="text-zinc-600 font-normal">(opcional)</span>
            </label>
            <input
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
              placeholder="Ej. Vista en tiempo real de pedidos en cocina"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
              Precio{" "}
              <span className="text-zinc-600 font-normal">(opcional)</span>
            </label>
            <input
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
              placeholder="Ej. 9.99"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Creando…" : "Crear servicio"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [priceModal, setPriceModal] = useState<Service | null>(null);
  const [creatingService, setCreatingService] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await applicationsApi.list();
      setApps(data);
      setActiveCat((prev) => prev ?? data[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cat = apps.find((a) => a.id === activeCat) ?? null;

  const handlePriceSaved = (saved: Service) => {
    setApps((prev) =>
      prev.map((a) =>
        a.id !== activeCat
          ? a
          : {
              ...a,
              services: a.services.map((s) => (s.id === saved.id ? saved : s)),
            },
      ),
    );
    setPriceModal(null);
  };

  const handleServiceCreated = (created: Service) => {
    setApps((prev) =>
      prev.map((a) =>
        a.id !== activeCat ? a : { ...a, services: [...a.services, created] },
      ),
    );
    setCreatingService(false);
  };

  const handleDeleteService = async (svc: Service) => {
    if (!confirm(`¿Eliminar el servicio "${svc.name}"?`)) return;
    setDeletingId(svc.id);
    try {
      await servicesApi.remove(svc.id);
      setApps((prev) =>
        prev.map((a) =>
          a.id !== activeCat
            ? a
            : { ...a, services: a.services.filter((s) => s.id !== svc.id) },
        ),
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al eliminar el servicio");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto w-full">
        <p className="text-sm text-zinc-500">Cargando aplicaciones…</p>
      </div>
    );
  }

  return (
    // Reducimos padding horizontal en móvil (px-4) y lo subimos en escritorio (sm:px-8)
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Aplicaciones
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Ajusta los precios de catálogo de cada servicio
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="flex items-center justify-center py-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <p className="text-zinc-500 text-sm">
            No hay aplicaciones configuradas
          </p>
        </div>
      ) : (
        // 👇 Cambiamos a flex-col en móvil y md:flex-row en escritorio
        <div className="flex flex-col md:flex-row gap-6">
          {/* App list (Categories) */}
          {/* 👇 w-full en móvil, md:w-48 en escritorio */}
          <div className="w-full md:w-48 shrink-0">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-1 mb-2">
              Categorías
            </p>
            {/* 👇 flex-row con scroll horizontal en móvil, flex-col clásico en escritorio */}
            <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-3 md:pb-0 scrollbar-none">
              {apps.map((a) => {
                const icon = getIcon(a.icon);
                const active = activeCat === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setActiveCat(a.id)}
                    // 👇 Añadimos whitespace-nowrap y shrink-0 para que las pestañas no colapsen en el scroll móvil
                    className={`flex items-center gap-3 px-3 py-2 md:py-2.5 rounded-lg text-sm font-medium text-left transition-colors whitespace-nowrap md:whitespace-normal shrink-0 md:w-full ${
                      active
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <span className={active ? icon.color : "text-zinc-600"}>
                      {icon.node}
                    </span>
                    <span className="flex-1 truncate max-w-35 md:max-w-none">
                      {a.name}
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded">
                      {a.services.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service list */}
          {cat &&
            (() => {
              const icon = getIcon(cat.icon);
              return (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-6">
                    <span className={icon.color}>{icon.node}</span>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {cat.name}
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {cat.services.length} servicio
                        {cat.services.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setCreatingService(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 border border-teal-200 dark:border-teal-500/25 rounded-lg transition-colors shrink-0"
                    >
                      <svg
                        className="w-3.5 h-3.5"
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
                      Añadir servicio
                    </button>
                  </div>

                  {cat.services.length === 0 ? (
                    <div className="flex items-center justify-center py-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <p className="text-zinc-500 text-sm">
                        Sin servicios en esta aplicación
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cat.services.map((svc) => (
                        <div
                          key={svc.id}
                          // 👇 Ajustamos los paddings internos para pantallas pequeñas (px-4 py-3 vs px-5 py-4)
                          className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                        >
                          {/* 👇 break-words previene desbordamientos raros si hay nombres larguísimos */}
                          <p className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 wrap-break-word">
                            {svc.name}
                          </p>

                          {/* 👇 Envolvemos el precio y botón en un contenedor shrink-0 para blindar su tamaño en móvil */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md min-w-12.5 text-center">
                              {svc.price || "—"}
                            </span>
                            <button
                              onClick={() => setPriceModal(svc)}
                              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                              title="Editar precio"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteService(svc)}
                              disabled={deletingId === svc.id}
                              className="p-1.5 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                              title="Eliminar servicio"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      )}

      {priceModal && (
        <PriceModal
          service={priceModal}
          onClose={() => setPriceModal(null)}
          onSaved={handlePriceSaved}
        />
      )}

      {creatingService && cat && (
        <CreateServiceModal
          appId={cat.id}
          appName={cat.name}
          onClose={() => setCreatingService(false)}
          onCreated={handleServiceCreated}
        />
      )}
    </div>
  );
}
