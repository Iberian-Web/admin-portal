import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";
import { applicationsApi, servicesApi, type Service } from "../api";
import { Icon } from "../components/icons";
import ConfirmDialog from "../components/ConfirmDialog";
import { Field } from "../components/FormControls";
import { getInputClass } from "../utils/inputClass";
import { getErrorMessage } from "../utils/errors";
import Modal from "../components/Modal";

// ─── Icons ────────────────────────────────────────────────────────────────────
const ICONS: Record<string, { color: string; node: React.ReactNode }> = {
  restaurant: {
    color: "text-orange-700 dark:text-orange-400",
    node: <UtensilsCrossed className="w-5 h-5" strokeWidth={1.8} />,
  },
};

const FALLBACK_ICON = {
  color: "text-teal-700 dark:text-teal-400",
  node: <Icon name="grid" className="w-5 h-5" strokeWidth={1.8} />,
};

function getIcon(key: string) {
  return ICONS[key] ?? FALLBACK_ICON;
}

// ─── Price modal ──────────────────────────────────────────────────────────────
function PriceModal({
  service,
  onClose,
}: {
  service: Service;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState(service.price ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => servicesApi.update(service.id, { price: price.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      onClose();
    },
    onError: (e: unknown) => setError(getErrorMessage(e, "Error desconocido")),
  });
  const submit = () => mutation.mutate();

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
        Editar precio
      </h3>
      <p className="text-sm text-zinc-500 mb-5">{service.name}</p>

      <Field label="Precio">
        <input
          autoFocus
          className={getInputClass()}
          placeholder="Ej. 29.99"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>

      {error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-xl px-3.5 py-2.5">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={mutation.isPending}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {mutation.isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Create service modal ─────────────────────────────────────────────────────
function CreateServiceModal({
  appId,
  appName,
  onClose,
}: {
  appId: number;
  appName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      servicesApi.create(appId, {
        name: name.trim(),
        description: description.trim(),
        price: price.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      onClose();
    },
    onError: (e: unknown) => setError(getErrorMessage(e, "Error desconocido")),
  });

  const submit = () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
        Nuevo servicio
      </h3>
      <p className="text-sm text-zinc-500 mb-5">en {appName}</p>

      <div className="space-y-3">
        <Field label="Nombre" required>
          <input
            autoFocus
            className={getInputClass()}
            placeholder="Ej. Pantalla de cocina"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Descripción" hint="(opcional)">
          <input
            className={getInputClass()}
            placeholder="Ej. Vista en tiempo real de pedidos en cocina"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Precio" hint="(opcional)">
          <input
            className={getInputClass()}
            placeholder="Ej. 9.99"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </Field>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-xl px-3.5 py-2.5">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={mutation.isPending}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {mutation.isPending ? "Creando…" : "Crear servicio"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Applications() {
  const queryClient = useQueryClient();
  const { data: apps = [], isLoading: loading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => applicationsApi.list(),
  });
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [priceModal, setPriceModal] = useState<Service | null>(null);
  const [creatingService, setCreatingService] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Service | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Selecciona la primera categoría en cuanto llegan las apps, sin pisar la
  // selección si el usuario ya había elegido una. Va en el cuerpo del
  // render (no en un efecto): es una adaptación de estado a partir de datos
  // ya cargados, no una sincronización con un sistema externo.
  if (apps.length > 0 && activeCat === null) {
    setActiveCat(apps[0].id);
  }

  const cat = apps.find((a) => a.id === activeCat) ?? null;

  const deleteMutation = useMutation({
    mutationFn: (svc: Service) => servicesApi.remove(svc.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      setDeleteConfirm(null);
    },
    onError: (e: unknown) =>
      setDeleteError(getErrorMessage(e, "Error al eliminar el servicio")),
  });
  const handleDeleteService = (svc: Service) => {
    setDeleteError(null);
    deleteMutation.mutate(svc);
  };

  if (loading) {
    return (
      <div className="px-6 lg:px-8 py-6 w-full">
        <p className="text-base text-zinc-500">Cargando aplicaciones…</p>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-6 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Aplicaciones
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Ajusta los precios de catálogo de cada servicio
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="flex items-center justify-center py-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <p className="text-zinc-500 text-base">
            No hay aplicaciones configuradas
          </p>
        </div>
      ) : (
        // 👇 Cambiamos a flex-col en móvil y md:flex-row en escritorio
        <div className="flex flex-col md:flex-row gap-6">
          {/* App list (Categories) */}
          {/* 👇 w-full en móvil, md:w-48 en escritorio */}
          <div className="w-full md:w-48 shrink-0">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1 mb-3">
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
                    className={`flex items-center gap-3 px-4 py-2.5 md:py-3 rounded-xl text-base font-semibold text-left transition-colors whitespace-nowrap md:whitespace-normal shrink-0 md:w-full ${
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
                    <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md">
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
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {cat.name}
                      </h2>
                      <p className="text-sm text-zinc-500">
                        {cat.services.length} servicio
                        {cat.services.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setCreatingService(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 border border-teal-200 dark:border-teal-500/25 rounded-xl transition-colors shrink-0"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      Añadir servicio
                    </button>
                  </div>

                  {cat.services.length === 0 ? (
                    <div className="flex items-center justify-center py-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <p className="text-zinc-500 text-base">
                        Sin servicios en esta aplicación
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cat.services.map((svc) => (
                        <div
                          key={svc.id}
                          // 👇 Ajustamos los paddings internos para pantallas pequeñas (px-4 py-3.5 vs px-5 py-4)
                          className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                        >
                          {/* 👇 break-words previene desbordamientos raros si hay nombres larguísimos */}
                          <p className="flex-1 text-base font-semibold text-zinc-800 dark:text-zinc-200 wrap-break-word">
                            {svc.name}
                          </p>

                          {/* 👇 Envolvemos el precio y botón en un contenedor shrink-0 para blindar su tamaño en móvil */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg min-w-15 text-center">
                              {svc.price || "—"}
                            </span>
                            <button
                              onClick={() => setPriceModal(svc)}
                              className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                              title="Editar precio"
                            >
                              <Icon name="pencil" className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(svc)}
                              disabled={
                                deleteMutation.isPending &&
                                deleteMutation.variables?.id === svc.id
                              }
                              className="p-2 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              <Icon name="trash" className="w-4 h-4" />
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
        <PriceModal service={priceModal} onClose={() => setPriceModal(null)} />
      )}

      {creatingService && cat && (
        <CreateServiceModal
          appId={cat.id}
          appName={cat.name}
          onClose={() => setCreatingService(false)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="¿Eliminar servicio?"
          message={
            <>
              Se eliminará{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {deleteConfirm.name}
              </span>
              . Esta acción no se puede deshacer.
              {deleteError && (
                <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                  {deleteError}
                </p>
              )}
            </>
          }
          confirmLabel="Eliminar"
          loading={
            deleteMutation.isPending &&
            deleteMutation.variables?.id === deleteConfirm.id
          }
          onConfirm={() => handleDeleteService(deleteConfirm)}
          onCancel={() => {
            setDeleteConfirm(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
