import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronsUpDown } from "lucide-react";
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  customersApi,
  applicationsApi,
  instancesApi,
  credentialsApi,
  type Customer,
  type Credential,
  type CredentialServicePermission,
  type CustomerStatus,
  type Instance,
  type BillingFrequency,
} from "../api";
import { Icon, Spinner } from "../components/icons";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";
import Toast, { type ToastVariant } from "../components/Toast";
import Toggle from "../components/Toggle";
import { SectionTitle, Field } from "../components/FormControls";
import { getInputClass } from "../utils/inputClass";
import { getErrorMessage } from "../utils/errors";
import { statusLabel } from "../utils/customerStatus";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a secure random password: 3 groups of 4 alphanumeric chars separated by dashes */
function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const group = () =>
    Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  return `${group()}-${group()}-${group()}`;
}

/** Derives a username from a full name: lowercase, no accents, dot-separated first+last + random number */
function deriveUsername(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
  const parts = normalized.split(/\s+/).filter(Boolean);

  const randomNum = Math.floor(Math.random() * 900) + 100;

  if (parts.length === 0) return `user${randomNum}`;
  if (parts.length === 1) return `${parts[0]}${randomNum}`;
  return `${parts[0]}.${parts[parts.length - 1]}${randomNum}`;
}

// ─── Billing helpers ────────────────────────────────────────────────────────

const billingFrequencyLabel: Record<BillingFrequency, string> = {
  MONTHLY: "Mensual",
  ANNUAL: "Anual",
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Clamps a day-of-month to the last valid day of that month (e.g. 31 → 28/29/30 as needed). */
function clampDayToMonth(year: number, month: number, day: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDayOfMonth);
}

/**
 * Builds the recurring due-date sequence (anchor, anchor + 1 period, + 2 periods, ...)
 * and returns the first one that falls after the last recorded payment — or the very
 * first cycle if there's no payment yet.
 */
function getNextDueDate(
  anchor: Date,
  frequency: BillingFrequency,
  billingDay: number,
  lastPaymentDate: Date | null,
): Date {
  const stepMonths = frequency === "ANNUAL" ? 12 : 1;
  const anchorDay = startOfDay(anchor);

  let due = new Date(
    anchorDay.getFullYear(),
    anchorDay.getMonth(),
    clampDayToMonth(anchorDay.getFullYear(), anchorDay.getMonth(), billingDay),
  );
  if (due < anchorDay) {
    const y = due.getFullYear();
    const m = due.getMonth() + stepMonths;
    due = new Date(y, m, clampDayToMonth(y, m, billingDay));
  }

  while (lastPaymentDate && due <= startOfDay(lastPaymentDate)) {
    const y = due.getFullYear();
    const m = due.getMonth() + stepMonths;
    due = new Date(y, m, clampDayToMonth(y, m, billingDay));
  }

  return due;
}

type BillingStatus = {
  label: string;
  colorClasses: string;
  nextDueDate: Date;
};

/** Derives the current payment status (up to date / due today / overdue) for an instance. */
function getBillingStatus(instance: Instance): BillingStatus {
  const anchor = new Date(instance.billingStartDate ?? instance.contractDate);
  const lastPaymentDate = instance.lastPaymentDate
    ? new Date(instance.lastPaymentDate)
    : null;
  const nextDueDate = getNextDueDate(
    anchor,
    instance.billingFrequency,
    instance.billingDay,
    lastPaymentDate,
  );

  const daysOverdue = Math.round(
    (startOfDay(new Date()).getTime() - nextDueDate.getTime()) / 86_400_000,
  );

  if (daysOverdue > 0) {
    return {
      label: `Atrasado ${daysOverdue} día${daysOverdue === 1 ? "" : "s"}`,
      colorClasses:
        "bg-red-50 dark:bg-red-500/15 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400",
      nextDueDate,
    };
  }
  if (daysOverdue === 0) {
    return {
      label: "Vence hoy",
      colorClasses:
        "bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400",
      nextDueDate,
    };
  }
  return {
    label: "Al día",
    colorClasses:
      "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    nextDueDate,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  name: string;
  email: string;
  company: string;
  dni: string;
  domains: string;
  status: CustomerStatus;
  phone: string;
  address: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

type CredentialForm = Credential & {
  password: string;
  isNewPasswordGenerated: boolean;
  hasCopiedPassword: boolean;
};

const emptyForm: FormData = {
  name: "",
  email: "",
  company: "",
  dni: "",
  domains: "",
  status: "PENDING",
  phone: "",
  address: "",
};

type ServiceState = Record<number, boolean>;
type AppServices = Record<number, ServiceState>;

// ─── Credential service permissions modal ─────────────────────────────────────
function CredentialServicesModal({
  credentialId,
  credentialName,
  onClose,
}: {
  credentialId: string;
  credentialName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["credentialServices", credentialId];

  const {
    data: services,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => credentialsApi.listServices(credentialId),
  });
  const loadError = queryError
    ? getErrorMessage(queryError, "No se pudieron cargar los servicios")
    : null;

  const toggleMutation = useMutation({
    mutationFn: ({
      serviceId,
      enabled,
    }: {
      serviceId: number;
      enabled: boolean;
    }) => credentialsApi.setService(credentialId, serviceId, enabled),
    onSuccess: (_data, { serviceId, enabled }) => {
      queryClient.setQueryData(
        queryKey,
        (prev?: CredentialServicePermission[]) =>
          prev?.map((s) => (s.serviceId === serviceId ? { ...s, enabled } : s)),
      );
    },
  });
  const toggleError = toggleMutation.isError
    ? getErrorMessage(toggleMutation.error, "No se pudo actualizar el servicio")
    : null;
  const displayError = loadError ?? toggleError;

  return (
    <Modal onClose={onClose}>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Servicios de {credentialName || "este usuario"}
      </h3>
      <p className="text-xs text-zinc-500 mb-5">
        Desactiva un servicio para ocultarlo del menú de este usuario en el
        portal. Solo se listan los servicios que el cliente tiene activos.
      </p>

      {displayError && (
        <p className="mb-3 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-3 py-2">
          {displayError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : !services || services.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Este cliente no tiene servicios activos todavía.
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {services.map((s) => (
            <div
              key={s.serviceId}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {s.name}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {s.applicationName}
                </p>
              </div>
              <Toggle
                checked={s.enabled}
                disabled={
                  toggleMutation.isPending &&
                  toggleMutation.variables?.serviceId === s.serviceId
                }
                onChange={(enabled) =>
                  toggleMutation.mutate({ serviceId: s.serviceId, enabled })
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = () => navigate("/");
  const isEdit = !!id && id !== "new";
  const queryClient = useQueryClient();

  // ── Data state ──
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [initialized, setInitialized] = useState(false);

  // ── Form state ──
  const [form, setForm] = useState<FormData>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);

  // ── Toast ──
  const [toast, setToast] = useState<{
    message: string;
    variant?: ToastVariant;
  } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Delete state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [credentials, setCredentials] = useState<CredentialForm[]>([]);
  const [credentialErrors, setCredentialErrors] = useState<
    Record<string, string>
  >({});
  const [permissionsFor, setPermissionsFor] = useState<CredentialForm | null>(
    null,
  );

  // Per-instance payment tracking: instanceId → { lastPaymentDate, justRecorded }
  const [instancePayments, setInstancePayments] = useState<
    Record<number, { lastPaymentDate: string | null; justRecorded: boolean }>
  >({});

  // Historial de pagos: se expande/colapsa aquí; la carga en sí la gestiona
  // useQueries más abajo (una query por instancia, solo activa si está
  // expandida).
  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(
    new Set(),
  );
  const [paymentNotes, setPaymentNotes] = useState<Record<number, string>>({});

  // ── App + service selection ──
  const [selectedApps, setSelectedApps] = useState<Set<number>>(new Set());
  const [appServices, setAppServices] = useState<AppServices>({});
  const [existingInstances, setExistingInstances] = useState<
    Record<number, Instance>
  >({});

  // ── Toast helper ──
  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ message, variant });
      toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  // Clean up toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // ─ Load data ─
  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => applicationsApi.list(),
  });
  const {
    data: customerData,
    isLoading: customerLoading,
    error: customerQueryError,
  } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => customersApi.get(id!),
    enabled: isEdit,
    retry: false,
  });
  const loading = appsLoading || (isEdit && (customerLoading || !initialized));

  const isNotFoundError = (err: unknown) =>
    err instanceof Error &&
    "status" in err &&
    (err as { status?: number }).status === 404;

  // Si el cliente no existe (404), volvemos al listado y avisamos con un
  // toast — reaccionar a un error de useQuery con un efecto es el patrón
  // que la propia documentación de TanStack Query recomienda (v5 quitó
  // onError/onSuccess de useQuery a propósito, en favor de esto).
  useEffect(() => {
    if (!isEdit || !customerQueryError) return;
    if (isNotFoundError(customerQueryError)) {
      navigate("/", { replace: true });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- notificación puntual por error de carga, no estado derivado
    showToast("Error de carga", "error");
  }, [isEdit, customerQueryError, navigate, showToast]);

  const loadError =
    isEdit && customerQueryError && !isNotFoundError(customerQueryError)
      ? "Error al cargar los datos. Por favor, revisa tu conexión o intenta más tarde."
      : null;

  // Siembra el formulario y todo el estado derivado (credenciales,
  // instancias, servicios, pagos) una sola vez, cuando ya han llegado tanto
  // el cliente como el catálogo de aplicaciones. Va en el cuerpo del render
  // (no en un efecto): es una adaptación de estado a partir de datos ya
  // cargados, no una sincronización con un sistema externo.
  if (isEdit && !initialized && customerData && !appsLoading) {
    setInitialized(true);
    setCustomer(customerData);
    setForm({
      name: customerData.name,
      email: customerData.email,
      company: customerData.company,
      dni: customerData.dni,
      domains: customerData.domains.join(", "),
      status: customerData.status,
      phone: customerData.phone ?? "",
      address: customerData.address ?? "",
    });

    setCredentials(
      (customerData.credentials ?? []).map((credential) => ({
        ...credential,
        password: "",
        isNewPasswordGenerated: false,
        hasCopiedPassword: true,
      })),
    );

    const instMap: Record<number, Instance> = {};
    const selApps = new Set<number>();
    const svcState: AppServices = {};
    const paymentState: Record<
      number,
      { lastPaymentDate: string | null; justRecorded: boolean }
    > = {};

    for (const inst of customerData.instances) {
      instMap[inst.applicationId] = inst;
      selApps.add(inst.applicationId);
      paymentState[inst.id] = {
        lastPaymentDate: inst.lastPaymentDate ?? null,
        justRecorded: false,
      };

      const svcMap: ServiceState = {};
      for (const is of inst.instanceServices) {
        svcMap[is.serviceId] = is.active;
      }
      const app = applications.find((a) => a.id === inst.applicationId);
      if (app) {
        for (const svc of app.services) {
          if (!(svc.id in svcMap)) svcMap[svc.id] = false;
        }
      }
      svcState[inst.applicationId] = svcMap;
    }

    setExistingInstances(instMap);
    setSelectedApps(selApps);
    setAppServices(svcState);
    setInstancePayments(paymentState);
  }

  // ─ Handlers ─
  const setField = (field: keyof FormData, val: string) => {
    setForm((f) => ({ ...f, [field]: val }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addCredential = () => {
    setCredentials((users) => [
      ...users,
      {
        id: crypto.randomUUID(),
        name: "",
        username: "",
        role: "",
        password: generatePassword(),
        isNewPasswordGenerated: true,
        hasCopiedPassword: false,
      },
    ]);
  };

  const updateCredential = (
    index: number,
    changes: Partial<CredentialForm>,
  ) => {
    setCredentials((users) =>
      users.map((user, currentIndex) =>
        currentIndex === index ? { ...user, ...changes } : user,
      ),
    );
    if (changes.username?.trim() || changes.password) {
      setCredentialErrors((errors) => ({
        ...errors,
        [credentials[index]?.id ?? index]: "",
      }));
    }
  };

  const handleGenerateCredentialUsername = (index: number) => {
    const credential = credentials[index];
    if (!credential?.name.trim()) return;
    updateCredential(index, { username: deriveUsername(credential.name) });
  };

  const regenerateCredentialPassword = (index: number) => {
    updateCredential(index, {
      password: generatePassword(),
      isNewPasswordGenerated: true,
      hasCopiedPassword: false,
    });
  };

  const copyCredentialPassword = async (index: number) => {
    const credential = credentials[index];
    if (!credential?.password) return;
    try {
      await navigator.clipboard.writeText(credential.password);
      updateCredential(index, { hasCopiedPassword: true });
      showToast("Contraseña copiada al portapapeles", "info");
    } catch {
      showToast("No se pudo copiar. Cópiala manualmente.", "error");
    }
  };

  const toggleApp = (appId: number) => {
    setSelectedApps((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
        if (!appServices[appId]) {
          const app = applications.find((a) => a.id === appId);
          if (app) {
            const svcMap: ServiceState = {};
            for (const svc of app.services) svcMap[svc.id] = true;
            setAppServices((prev2) => ({ ...prev2, [appId]: svcMap }));
          }
        }
      }
      return next;
    });
  };

  const toggleService = (appId: number, serviceId: number, active: boolean) => {
    setAppServices((prev) => ({
      ...prev,
      [appId]: { ...(prev[appId] ?? {}), [serviceId]: active },
    }));
  };

  // Una query por instancia, activa solo si su historial está expandido.
  // El orden de `instancesList` es el mismo que usa el useQueries de abajo,
  // así que sus resultados se correlacionan por índice.
  const instancesList = Object.values(existingInstances);
  const paymentHistoryResults = useQueries({
    queries: instancesList.map((inst) => ({
      queryKey: ["payments", inst.id],
      queryFn: () => instancesApi.listPayments(inst.id),
      enabled: expandedHistory.has(inst.id),
    })),
  });
  const paymentHistoryByInstance = Object.fromEntries(
    instancesList.map((inst, i) => [inst.id, paymentHistoryResults[i]]),
  );

  const recordPaymentMutation = useMutation({
    mutationFn: ({ instance, note }: { instance: Instance; note?: string }) =>
      instancesApi.recordPayment(instance.id, note),
    onSuccess: (updated, { instance }) => {
      setExistingInstances((prev) => ({
        ...prev,
        [updated.applicationId]: updated,
      }));
      setInstancePayments((prev) => ({
        ...prev,
        [instance.id]: {
          lastPaymentDate: updated.lastPaymentDate,
          justRecorded: true,
        },
      }));
      setPaymentNotes((prev) => ({ ...prev, [instance.id]: "" }));
      // Reset the visual "just recorded" state shortly after
      setTimeout(() => {
        setInstancePayments((prev) => ({
          ...prev,
          [instance.id]: { ...prev[instance.id], justRecorded: false },
        }));
      }, 2500);
      // Si el historial está abierto, lo refresca para que el nuevo pago
      // aparezca al momento.
      void queryClient.invalidateQueries({
        queryKey: ["payments", instance.id],
      });
      showToast("Pago registrado correctamente");
    },
    onError: () => showToast("No se pudo registrar el pago", "error"),
  });
  const recordPayment = (instance: Instance) => {
    const note = (paymentNotes[instance.id] ?? "").trim();
    recordPaymentMutation.mutate({ instance, note: note || undefined });
  };

  const updateBillingMutation = useMutation({
    mutationFn: ({
      instance,
      patch,
    }: {
      instance: Instance;
      patch: Partial<{
        billingFrequency: BillingFrequency;
        billingDay: number;
      }>;
    }) => instancesApi.updateBilling(instance.id, patch),
    onSuccess: (updated) => {
      setExistingInstances((prev) => ({
        ...prev,
        [updated.applicationId]: updated,
      }));
    },
    onError: () =>
      showToast("No se pudo actualizar la configuración de cobro", "error"),
  });
  const updateBilling = (
    instance: Instance,
    patch: Partial<{ billingFrequency: BillingFrequency; billingDay: number }>,
  ) => {
    updateBillingMutation.mutate({ instance, patch });
  };

  const toggleHistory = (instanceId: number) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const removePaymentMutation = useMutation({
    mutationFn: ({ paymentId }: { instanceId: number; paymentId: number }) =>
      instancesApi.removePayment(paymentId),
    onSuccess: (_data, { instanceId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["payments", instanceId],
      });
      showToast("Registro de pago eliminado");
    },
    onError: () => showToast("No se pudo eliminar el registro", "error"),
  });
  const removePayment = (instanceId: number, paymentId: number) => {
    removePaymentMutation.mutate({ instanceId, paymentId });
  };

  // ─ Validation ─
  const validate = (): boolean => {
    const errors: FormErrors = {};

    if (!form.name.trim()) errors.name = "El nombre es obligatorio.";
    if (!form.email.trim()) errors.email = "El correo es obligatorio.";
    if (!form.dni.trim()) errors.dni = "El DNI/NIE es obligatorio.";

    const extraErrors: Record<string, string> = {};
    credentials.forEach((credential, index) => {
      if (!credential.name.trim()) {
        extraErrors[credential.id ?? String(index)] =
          "El nombre es obligatorio.";
      } else if (!credential.username.trim()) {
        extraErrors[credential.id ?? String(index)] =
          "Genera el usuario a partir del nombre.";
      } else if (
        credential.isNewPasswordGenerated &&
        !credential.hasCopiedPassword
      ) {
        extraErrors[credential.id ?? String(index)] =
          "Debes copiar la contraseña antes de guardar.";
      }
    });

    setFieldErrors(errors);
    setCredentialErrors(extraErrors);
    return (
      Object.keys(errors).length === 0 && Object.keys(extraErrors).length === 0
    );
  };

  // ─ Delete ─
  const deleteMutation = useMutation({
    mutationFn: () => customersApi.remove(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      goBack();
    },
    onError: (e: unknown) => {
      setError(getErrorMessage(e, "Error al eliminar"));
      setShowDeleteConfirm(false);
    },
  });
  const handleDelete = () => {
    if (id) deleteMutation.mutate();
  };

  // ─ Submit ─
  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        dni: form.dni.trim(),
        domains: form.domains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        status: form.status,
        phone: form.phone.trim(),
        address: form.address.trim(),
        credentials: credentials.map(
          ({ id, name, username, role, password, isNewPasswordGenerated }) => ({
            id,
            name: name.trim(),
            username: username.trim(),
            role: role.trim(),
            ...(isNewPasswordGenerated && password ? { password } : {}),
          }),
        ),
      };

      let savedCustomer: Customer;
      if (isEdit) {
        savedCustomer = await customersApi.update(
          id!,
          payload as Parameters<typeof customersApi.update>[1],
        );
      } else {
        savedCustomer = await customersApi.create(
          payload as Parameters<typeof customersApi.create>[0],
        );
      }

      const customerId = savedCustomer.id;

      // ── Reconcile instances ──
      const toAdd = [...selectedApps].filter(
        (appId) => !(appId in existingInstances),
      );
      const toRemove = Object.keys(existingInstances)
        .map(Number)
        .filter((appId) => !selectedApps.has(appId));

      await Promise.all(
        toRemove.map((appId) => {
          const inst = existingInstances[appId];
          return inst ? instancesApi.remove(inst.id) : Promise.resolve();
        }),
      );

      // 1. Add new instances
      const addPromises = toAdd.map(async (appId) => {
        const newInst = await instancesApi.assign(customerId, appId);
        const svcMap = appServices[appId] ?? {};

        const servicePromises = newInst.instanceServices.map((is) => {
          const active = svcMap[is.serviceId] ?? false;
          if (active !== is.active) {
            return instancesApi.updateService(newInst.id, is.serviceId, {
              active,
            });
          }
          return Promise.resolve();
        });

        return Promise.all(servicePromises);
      });

      // 2. Update existing instances
      const updatePromises = [...selectedApps].map(async (appId) => {
        if (!(appId in existingInstances)) return Promise.resolve();
        const inst = existingInstances[appId];
        const svcMap = appServices[appId] ?? {};
        const app = applications.find((item) => item.id === appId);
        if (!app) return Promise.resolve();

        const servicePromises = app.services.map((service) => {
          const existingService = inst.instanceServices.find(
            (instanceService) => instanceService.serviceId === service.id,
          );
          const desiredActive = svcMap[service.id] ?? false;
          if (!existingService || desiredActive !== existingService.active) {
            return instancesApi.updateService(inst.id, service.id, {
              active: desiredActive,
            });
          }
          return Promise.resolve();
        });

        return Promise.all(servicePromises);
      });

      // Await strictly the creation + updates concurrently
      await Promise.all([...addPromises, ...updatePromises]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      goBack();
    },
    onError: (e: unknown) => {
      const errorMsg = getErrorMessage(e, "");

      if (
        errorMsg.toLowerCase().includes("username") ||
        errorMsg.includes("Unique constraint")
      ) {
        setError(
          "Uno de los nombres de usuario ya está en uso. Genera uno nuevo e inténtalo de nuevo.",
        );
      } else {
        setError(errorMsg || "Error al guardar el cliente.");
      }
    },
  });

  const submit = () => {
    if (!validate()) {
      setError("Corrige los errores del formulario antes de continuar.");
      return;
    }
    setError(null);
    submitMutation.mutate();
  };

  // ─ Render ─
  if (loading) {
    return (
      <div className="px-4 sm:px-8 py-8 max-w-3xl mx-auto w-full animate-pulse space-y-8">
        <div className="flex gap-4 mb-8">
          <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg shrink-0" />
          <div className="space-y-2 mt-1">
            <div className="h-5 w-48 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-64 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
          </div>
        </div>
        <div className="h-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl" />
        <div className="h-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl" />
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="¿Eliminar cliente?"
          message={
            <>
              <p>
                Se eliminará{" "}
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {customer?.name}
                </span>{" "}
                y todos sus datos, instancias y configuraciones.
              </p>
              <p className="mt-1">Esta acción no se puede deshacer.</p>
            </>
          }
          confirmLabel="Eliminar cliente"
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div className="px-4 sm:px-8 py-8 max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={goBack}
            className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            title="Volver"
          >
            <Icon name="arrowLeft" className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {isEdit ? (customer?.name ?? "Editar cliente") : "Nuevo cliente"}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {isEdit
                ? "Edita los datos y aplicaciones del cliente"
                : "Rellena los datos para crear un cliente"}
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* ── Section: Info ── */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <SectionTitle>Información del cliente</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Nombre"
                required
                hint={!isEdit ? "(se usa para generar el usuario)" : undefined}
                error={fieldErrors.name}
                className="col-span-full"
              >
                <input
                  className={getInputClass(fieldErrors.name)}
                  placeholder="Ana García López"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </Field>

              <Field label="Email" required error={fieldErrors.email}>
                <input
                  type="email"
                  className={getInputClass(fieldErrors.email)}
                  placeholder="ana@empresa.com"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </Field>

              <Field label="DNI / NIF" required error={fieldErrors.dni}>
                <input
                  className={getInputClass(fieldErrors.dni)}
                  placeholder="12345678A"
                  value={form.dni}
                  onChange={(e) => setField("dni", e.target.value)}
                />
              </Field>

              <Field label="Empresa">
                <input
                  className={getInputClass()}
                  placeholder="TechTide Solutions"
                  value={form.company}
                  onChange={(e) => setField("company", e.target.value)}
                />
              </Field>

              <Field label="Estado">
                <div className="relative">
                  <select
                    className={`${getInputClass()} appearance-none pr-10`}
                    value={form.status}
                    onChange={(e) =>
                      setField("status", e.target.value as CustomerStatus)
                    }
                  >
                    {(Object.keys(statusLabel) as CustomerStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                  <ChevronsUpDown
                    className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    strokeWidth={2}
                  />
                </div>
              </Field>

              <Field
                label="Dominios"
                hint="(separados por coma)"
                className="col-span-full"
              >
                <input
                  className={getInputClass()}
                  placeholder="miempresa.com, tienda.miempresa.es"
                  value={form.domains}
                  onChange={(e) => setField("domains", e.target.value)}
                />
              </Field>

              <Field label="Teléfono" className="col-span-full sm:col-span-1">
                <input
                  type="tel"
                  className={getInputClass()}
                  placeholder="+34 600 000 000"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </Field>

              <Field label="Dirección" className="col-span-full sm:col-span-1">
                <input
                  className={getInputClass()}
                  placeholder="Calle Mayor 1, 28001 Madrid"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* ── Section: Access credentials ── */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-1">
              <div>
                <SectionTitle>Acceso al portal</SectionTitle>
                <p className="text-xs text-zinc-500 -mt-3 mb-4">
                  Usuarios independientes del cliente (camareros, recepción…)
                  que pueden entrar en el portal.
                </p>
              </div>
              <button
                type="button"
                onClick={addCredential}
                className="flex items-center gap-1.5 -mt-4 mb-4 px-2.5 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 border border-teal-200 dark:border-teal-500/25 rounded-lg transition-colors shrink-0"
              >
                <Icon name="plus" className="w-3.5 h-3.5" />
                Añadir usuario
              </button>
            </div>

            {credentials.length === 0 ? (
              <p className="text-sm text-zinc-600 bg-zinc-50 dark:bg-zinc-950/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-6 text-center">
                Todavía no hay usuarios con acceso al portal. Pulsa "Añadir
                usuario" para crear el primero.
              </p>
            ) : (
              <div className="space-y-4">
                {credentials.map((credential, index) => {
                  const rowError =
                    credentialErrors[credential.id] ||
                    credentialErrors[String(index)];

                  return (
                    <div
                      key={credential.id}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/30 p-4"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-xs text-zinc-600">
                          Usuario {index + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          {customer?.credentials?.some(
                            (c) => c.id === credential.id,
                          ) && (
                            <button
                              type="button"
                              onClick={() => setPermissionsFor(credential)}
                              className="text-xs text-teal-800 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-200 transition-colors"
                            >
                              Permisos
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setCredentials((users) =>
                                users.filter((_, i) => i !== index),
                              )
                            }
                            className="text-xs text-zinc-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field
                          label="Nombre"
                          error={
                            rowError === "El nombre es obligatorio."
                              ? rowError
                              : undefined
                          }
                        >
                          <input
                            className={getInputClass(
                              rowError === "El nombre es obligatorio.",
                            )}
                            placeholder="Sara García"
                            value={credential.name}
                            onChange={(event) =>
                              updateCredential(index, {
                                name: event.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field
                          label="Usuario"
                          hint="(se genera a partir del nombre)"
                          error={
                            rowError === "El nombre es obligatorio."
                              ? undefined
                              : rowError
                          }
                        >
                          <div className="flex gap-2">
                            <input
                              className={`${getInputClass(rowError)} cursor-default focus:ring-0 opacity-80`}
                              placeholder="Genera el usuario a partir del nombre"
                              value={credential.username}
                              readOnly
                              tabIndex={-1}
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleGenerateCredentialUsername(index)
                              }
                              disabled={!credential.name.trim()}
                              title={
                                credential.name.trim()
                                  ? "Generar usuario a partir del nombre"
                                  : "Escribe primero el nombre"
                              }
                              className="shrink-0 flex items-center justify-center p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg transition-all duration-200"
                            >
                              <Icon
                                name="refresh"
                                className="w-4 h-4"
                                strokeWidth={1.8}
                              />
                            </button>
                          </div>
                        </Field>

                        <Field label="Rol" hint="(opcional)">
                          <input
                            className={getInputClass()}
                            placeholder="Camarero, Cocina, Encargado…"
                            value={credential.role}
                            onChange={(event) =>
                              updateCredential(index, {
                                role: event.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field label="Contraseña">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                regenerateCredentialPassword(index)
                              }
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs font-medium rounded-lg transition-all duration-200"
                            >
                              <Icon
                                name="refresh"
                                className="w-3.5 h-3.5"
                                strokeWidth={1.8}
                              />
                              Generar
                            </button>
                            <button
                              type="button"
                              onClick={() => copyCredentialPassword(index)}
                              disabled={!credential.password}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 border text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${credential.hasCopiedPassword && credential.password ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
                            >
                              {credential.hasCopiedPassword &&
                              credential.password ? (
                                <>
                                  <Icon name="check" className="w-3.5 h-3.5" />
                                  Copiada
                                </>
                              ) : (
                                <>
                                  <Icon
                                    name="clipboard"
                                    className="w-3.5 h-3.5"
                                    strokeWidth={1.8}
                                  />
                                  Copiar
                                </>
                              )}
                            </button>
                          </div>
                        </Field>

                        {credential.isNewPasswordGenerated &&
                          !credential.hasCopiedPassword && (
                            <div className="col-span-full flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-lg px-3 py-2">
                              <Icon
                                name="warningTriangle"
                                className="w-4 h-4 shrink-0"
                              />
                              Copia la nueva contraseña antes de guardar los
                              cambios.
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Section: Payment ── */}
          {isEdit && instancesList.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <SectionTitle>Facturación</SectionTitle>
              <div className="space-y-4">
                {instancesList.map((inst) => {
                  const payment = instancePayments[inst.id];
                  const justRecorded = payment?.justRecorded ?? false;
                  const status = getBillingStatus(inst);
                  const isExpanded = expandedHistory.has(inst.id);
                  const isLoadingHistory =
                    paymentHistoryByInstance[inst.id]?.isLoading ?? false;
                  const history = paymentHistoryByInstance[inst.id]?.data;

                  return (
                    <div
                      key={inst.id}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-4"
                    >
                      {/* Header: app name + live status badge */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {inst.application.name}
                        </p>
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${status.colorClasses}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      {/* Billing settings: frequency + day of the cycle */}
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Frecuencia de cobro">
                          <div className="relative">
                            <select
                              className={`${getInputClass()} appearance-none pr-10`}
                              value={inst.billingFrequency}
                              onChange={(e) =>
                                updateBilling(inst, {
                                  billingFrequency: e.target
                                    .value as BillingFrequency,
                                })
                              }
                            >
                              {(
                                Object.keys(
                                  billingFrequencyLabel,
                                ) as BillingFrequency[]
                              ).map((freq) => (
                                <option key={freq} value={freq}>
                                  {billingFrequencyLabel[freq]}
                                </option>
                              ))}
                            </select>
                            <Icon
                              name="chevronDown"
                              className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                          </div>
                        </Field>

                        <Field label="Día de cobro" hint="(1-31)">
                          <div className="relative">
                            <select
                              className={`${getInputClass()} appearance-none pr-10`}
                              value={inst.billingDay}
                              onChange={(e) =>
                                updateBilling(inst, {
                                  billingDay: Number(e.target.value),
                                })
                              }
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(
                                (day) => (
                                  <option key={day} value={day}>
                                    {day}
                                  </option>
                                ),
                              )}
                            </select>
                            <Icon
                              name="chevronDown"
                              className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                          </div>
                        </Field>
                      </div>

                      {/* Last payment / next due date */}
                      <div className="flex items-center justify-between gap-4 text-xs flex-wrap">
                        <span className="text-zinc-500">
                          Último pago:{" "}
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {inst.lastPaymentDate
                              ? formatDate(inst.lastPaymentDate)
                              : "sin pagos registrados"}
                          </span>
                        </span>
                        <span className="text-zinc-500">
                          Próximo cobro:{" "}
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {formatDate(status.nextDueDate)}
                          </span>
                        </span>
                      </div>

                      {/* Register a new payment */}
                      <div className="flex items-center gap-2">
                        <input
                          className={`${getInputClass()} flex-1`}
                          placeholder="Nota (opcional)"
                          value={paymentNotes[inst.id] ?? ""}
                          onChange={(e) =>
                            setPaymentNotes((prev) => ({
                              ...prev,
                              [inst.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => recordPayment(inst)}
                          disabled={
                            recordPaymentMutation.isPending &&
                            recordPaymentMutation.variables?.instance.id ===
                              inst.id
                          }
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all duration-300 shrink-0 disabled:opacity-50 ${
                            justRecorded
                              ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-teal-300 dark:hover:border-teal-500/50 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10"
                          }`}
                        >
                          {justRecorded ? (
                            <>
                              <Icon name="check" className="w-3.5 h-3.5" />
                              Registrado
                            </>
                          ) : (
                            <>
                              <Icon name="plus" className="w-3.5 h-3.5" />
                              Registrar pago
                            </>
                          )}
                        </button>
                      </div>

                      {/* History toggle + list */}
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleHistory(inst.id)}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1.5 transition-colors"
                        >
                          <Icon
                            name="chevronDown"
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          />
                          {isExpanded
                            ? "Ocultar historial"
                            : "Ver historial de pagos"}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {isLoadingHistory ? (
                              <p className="text-xs text-zinc-600 italic py-2">
                                Cargando…
                              </p>
                            ) : !history || history.length === 0 ? (
                              <p className="text-xs text-zinc-600 italic py-2">
                                Sin pagos registrados todavía.
                              </p>
                            ) : (
                              history.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between gap-3 text-xs bg-zinc-100 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                                >
                                  <div className="min-w-0 truncate">
                                    <span className="text-zinc-700 dark:text-zinc-300">
                                      {formatDate(p.paidAt)}
                                    </span>
                                    {p.note && (
                                      <span className="text-zinc-500 ml-2 truncate">
                                        {p.note}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removePayment(inst.id, p.id)}
                                    className="text-zinc-600 hover:text-red-700 dark:hover:text-red-400 transition-colors shrink-0"
                                    title="Eliminar este registro"
                                  >
                                    <Icon
                                      name="close"
                                      className="w-3.5 h-3.5"
                                    />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section: Apps ── */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <SectionTitle>Aplicaciones contratadas</SectionTitle>

            {applications.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No hay aplicaciones configuradas.
              </p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => {
                  const isSelected = selectedApps.has(app.id);
                  const svcMap = appServices[app.id] ?? {};

                  return (
                    <div
                      key={app.id}
                      className={`border rounded-xl overflow-hidden transition-colors ${
                        isSelected
                          ? "border-teal-300 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/5"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/30"
                      }`}
                    >
                      <div
                        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                        onClick={() => toggleApp(app.id)}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? "bg-teal-600 border-teal-600"
                              : "border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800"
                          }`}
                        >
                          {isSelected && (
                            <Icon
                              name="check"
                              className="w-2.5 h-2.5 text-white"
                              strokeWidth={1.5}
                            />
                          )}
                        </div>
                        <span
                          className={`text-sm font-medium transition-colors ${isSelected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}
                        >
                          {app.name}
                        </span>
                        {app.services.length > 0 && (
                          <span className="ml-auto text-xs text-zinc-600">
                            {app.services.length} servicio
                            {app.services.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {isSelected && app.services.length > 0 && (
                        <div className="border-t border-teal-200 dark:border-teal-500/20 divide-y divide-zinc-200 dark:divide-zinc-800/60">
                          {app.services.map((svc) => {
                            const active = svcMap[svc.id] ?? false;
                            return (
                              <div
                                key={svc.id}
                                className="flex items-center gap-4 px-5 py-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                                    {svc.name}
                                  </p>
                                  {svc.description && (
                                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                                      {svc.description}
                                    </p>
                                  )}
                                </div>
                                {svc.price && (
                                  <span className="text-xs text-zinc-500 shrink-0">
                                    {svc.price}
                                  </span>
                                )}
                                <Toggle
                                  checked={active}
                                  onChange={(v) =>
                                    toggleService(app.id, svc.id, v)
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isSelected && app.services.length === 0 && (
                        <div className="border-t border-teal-200 dark:border-teal-500/20 px-5 py-3">
                          <p className="text-xs text-zinc-600">
                            Esta aplicación no tiene servicios definidos.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {(error ?? loadError) && (
            <div className="flex items-start gap-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-4 py-3">
              <Icon
                name="warningTriangle"
                className="w-4 h-4 shrink-0 mt-0.5"
                strokeWidth={2}
              />
              {error ?? loadError}
            </div>
          )}

          {/* Actions */}
          <div
            className={`flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pb-4 ${isEdit ? "justify-between" : "justify-end"}`}
          >
            {/* Delete — only for existing customers */}
            {isEdit && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-400/10 border border-red-200 dark:border-red-500/20 hover:border-red-300 dark:hover:border-red-500/40 text-sm font-medium rounded-lg transition-colors"
              >
                <Icon name="trash" className="w-4 h-4" strokeWidth={1.8} />
                Eliminar cliente
              </button>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={goBack}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {submitMutation.isPending && (
                  <Spinner className="w-3.5 h-3.5" />
                )}
                {submitMutation.isPending
                  ? "Guardando…"
                  : isEdit
                    ? "Guardar cambios"
                    : "Crear cliente"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {permissionsFor && (
        <CredentialServicesModal
          credentialId={permissionsFor.id}
          credentialName={permissionsFor.name}
          onClose={() => setPermissionsFor(null)}
        />
      )}
    </>
  );
}
