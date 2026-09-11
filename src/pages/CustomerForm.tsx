import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  customersApi,
  applicationsApi,
  instancesApi,
  type Customer,
  type Credential,
  type CustomerStatus,
  type Application,
  type Instance,
  type BillingFrequency,
  type Payment,
} from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusLabel: Record<CustomerStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  PENDING: "Pendiente",
};

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

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "info" | "error";

function Toast({
  message,
  variant = "success",
  onDismiss,
}: {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
}) {
  const colors =
    variant === "success"
      ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
      : variant === "error"
        ? "bg-red-50 dark:bg-red-500/15 border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-300"
        : "bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/30 text-teal-800 dark:text-teal-300";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl backdrop-blur-sm animate-fade-in ${colors}`}
    >
      {variant === "success" ? (
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      ) : variant === "error" ? (
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      )}
      {message}
      <button
        onClick={onDismiss}
        className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Cerrar"
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
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg w-full max-w-sm p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          {title}
        </h3>
        <div className="text-sm text-zinc-500 mb-6 space-y-1">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg border border-red-200 dark:border-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <svg
                className="w-3.5 h-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {loading ? "Eliminando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-teal-600" : "bg-zinc-200 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
      {children}
    </h2>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
        {label}
        {required && (
          <span className="text-teal-700 dark:text-teal-400 ml-0.5">*</span>
        )}
        {hint && <span className="text-zinc-600 ml-1 font-normal">{hint}</span>}
      </label>
      {children}
      {typeof error === "string" && error && (
        <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
          <svg
            className="w-3 h-3 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const getInputClass = (hasError?: boolean | string) =>
  `w-full bg-zinc-100 dark:bg-zinc-800 border rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 transition-colors ${
    hasError
      ? "border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
      : "border-zinc-300 dark:border-zinc-700 focus:border-teal-500 focus:ring-teal-500/30"
  }`;

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = () => navigate("/");
  const isEdit = !!id && id !== "new";

  // ── Data state ──
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Form state ──
  const [form, setForm] = useState<FormData>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Toast ──
  const [toast, setToast] = useState<{
    message: string;
    variant?: ToastVariant;
  } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Delete state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [credentials, setCredentials] = useState<CredentialForm[]>([]);
  const [credentialErrors, setCredentialErrors] = useState<
    Record<string, string>
  >({});

  // Per-instance payment tracking: instanceId → { lastPaymentDate, justRecorded }
  const [instancePayments, setInstancePayments] = useState<
    Record<number, { lastPaymentDate: string | null; justRecorded: boolean }>
  >({});

  // Payment history: instanceId → payments (fetched lazily on first expand)
  const [paymentHistory, setPaymentHistory] = useState<
    Record<number, Payment[]>
  >({});
  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(
    new Set(),
  );
  const [loadingHistory, setLoadingHistory] = useState<Set<number>>(new Set());
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
  const load = useCallback(async () => {
    try {
      const [apps, customerData] = await Promise.all([
        applicationsApi.list(),
        isEdit ? customersApi.get(id!) : Promise.resolve(null),
      ]);

      setApplications(apps);

      if (customerData) {
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
          const app = apps.find((a) => a.id === inst.applicationId);
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
      } else {
        setCredentials([]);
      }
    } catch (loadError) {
      if (
        isEdit &&
        loadError instanceof Error &&
        "status" in loadError &&
        loadError.status === 404
      ) {
        navigate("/", { replace: true });
        return;
      }

      setError(
        "Error al cargar los datos. Por favor, revisa tu conexión o intenta más tarde.",
      );
      showToast("Error de carga", "error");
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate, showToast]);

  useEffect(() => {
    const loadData = async () => {
      await load();
    };
    void loadData();
  }, [load]);

  // ─ Handlers ─
  const setField = (field: keyof FormData, val: string) => {
    setForm((f) => ({ ...f, [field]: val }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleNameChange = (name: string) => {
    setForm((currentForm) => ({ ...currentForm, name }));
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const addCredential = () => {
    setCredentials((users) => [
      ...users,
      {
        id: crypto.randomUUID(),
        name: "",
        username: "",
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

  const recordPayment = async (instance: Instance) => {
    const note = (paymentNotes[instance.id] ?? "").trim();
    try {
      const updated = await instancesApi.recordPayment(
        instance.id,
        note || undefined,
      );
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
      // If the history panel is open, refresh it so the new entry shows up right away
      if (expandedHistory.has(instance.id)) {
        const history = await instancesApi.listPayments(instance.id);
        setPaymentHistory((prev) => ({ ...prev, [instance.id]: history }));
      }
      showToast("Pago registrado correctamente");
    } catch {
      showToast("No se pudo registrar el pago", "error");
    }
  };

  const updateBilling = async (
    instance: Instance,
    patch: Partial<{ billingFrequency: BillingFrequency; billingDay: number }>,
  ) => {
    try {
      const updated = await instancesApi.updateBilling(instance.id, patch);
      setExistingInstances((prev) => ({
        ...prev,
        [updated.applicationId]: updated,
      }));
    } catch {
      showToast("No se pudo actualizar la configuración de cobro", "error");
    }
  };

  const toggleHistory = async (instanceId: number) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });

    if (paymentHistory[instanceId] || loadingHistory.has(instanceId)) return;

    setLoadingHistory((prev) => new Set(prev).add(instanceId));
    try {
      const history = await instancesApi.listPayments(instanceId);
      setPaymentHistory((prev) => ({ ...prev, [instanceId]: history }));
    } catch {
      showToast("No se pudo cargar el historial de pagos", "error");
    } finally {
      setLoadingHistory((prev) => {
        const next = new Set(prev);
        next.delete(instanceId);
        return next;
      });
    }
  };

  const removePayment = async (instanceId: number, paymentId: number) => {
    try {
      await instancesApi.removePayment(paymentId);
      setPaymentHistory((prev) => ({
        ...prev,
        [instanceId]: (prev[instanceId] ?? []).filter(
          (p) => p.id !== paymentId,
        ),
      }));
      showToast("Registro de pago eliminado");
    } catch {
      showToast("No se pudo eliminar el registro", "error");
    }
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
  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await customersApi.remove(id);
      goBack();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // ─ Submit ─
  const submit = async () => {
    if (!validate()) {
      setError("Corrige los errores del formulario antes de continuar.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
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
          ({ id, name, username, password, isNewPasswordGenerated }) => ({
            id,
            name: name.trim(),
            username: username.trim(),
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

      goBack();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "";

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
    } finally {
      setSaving(false);
    }
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
          loading={deleting}
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
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
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
                  onChange={(e) => handleNameChange(e.target.value)}
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
                  <svg
                    className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                    />
                  </svg>
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field
                          label="Nombre"
                          error={
                            rowError === "El nombre es obligatorio."
                              ? rowError
                              : undefined
                          }
                          className="col-span-full"
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
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.8}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                                />
                              </svg>
                            </button>
                          </div>
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
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.8}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                                />
                              </svg>
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
                                      d="M4.5 12.75l6 6 9-13.5"
                                    />
                                  </svg>
                                  Copiada
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                                    />
                                  </svg>
                                  Copiar
                                </>
                              )}
                            </button>
                          </div>
                        </Field>

                        {credential.isNewPasswordGenerated &&
                          !credential.hasCopiedPassword && (
                            <div className="col-span-full flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-lg px-3 py-2">
                              <svg
                                className="w-4 h-4 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502 1.667 1.732 3L13.732 4c-.77-1.333-2.694 0-3.464 0L3.34 16c-.77 1.333-.192 3 1.732 3z"
                                />
                              </svg>
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
          {isEdit && Object.keys(existingInstances).length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <SectionTitle>Facturación</SectionTitle>
              <div className="space-y-4">
                {Object.values(existingInstances).map((inst) => {
                  const payment = instancePayments[inst.id];
                  const justRecorded = payment?.justRecorded ?? false;
                  const status = getBillingStatus(inst);
                  const isExpanded = expandedHistory.has(inst.id);
                  const isLoadingHistory = loadingHistory.has(inst.id);
                  const history = paymentHistory[inst.id];

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
                            <svg
                              className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                              />
                            </svg>
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
                            <svg
                              className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                              />
                            </svg>
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
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all duration-300 shrink-0 ${
                            justRecorded
                              ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-teal-300 dark:hover:border-teal-500/50 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10"
                          }`}
                        >
                          {justRecorded ? (
                            <>
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
                                  d="M4.5 12.75l6 6 9-13.5"
                                />
                              </svg>
                              Registrado
                            </>
                          ) : (
                            <>
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
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                            />
                          </svg>
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
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              viewBox="0 0 10 8"
                              fill="currentColor"
                            >
                              <path
                                d="M1 4l3 3 5-6"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            </svg>
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
          {error && (
            <div className="flex items-start gap-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-4 py-3">
              <svg
                className="w-4 h-4 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              {error}
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
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
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
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving && (
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                )}
                {saving
                  ? "Guardando…"
                  : isEdit
                    ? "Guardar cambios"
                    : "Crear cliente"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
