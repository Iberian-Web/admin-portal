// ─── Base URL ────────────────────────────────────────────────────────────────
// In dev, Vite proxies /api → http://localhost:3001 (see vite.config.ts).
// In production set VITE_API_URL to your backend base (no trailing slash).
const BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

import type {
  User as Customer,
  UserStatus as CustomerStatus,
  Service,
  Application,
  InstanceService,
  Instance,
  CustomerAccess,
  BillingFrequency,
  Payment,
} from "./types";

export type {
  Customer,
  CustomerStatus,
  Service,
  Application,
  InstanceService,
  Instance,
  CustomerAccess,
  BillingFrequency,
  Payment,
};

// ─── Customer endpoints ───────────────────────────────────────────────────────

export const customersApi = {
  list: () => request<Customer[]>("/api/customers"),

  get: (id: string) => request<Customer>(`/api/customers/${id}`),

  create: (
    data: Omit<Customer, "id" | "createdAt" | "updatedAt" | "instances">,
  ) =>
    request<Customer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: Partial<
      Omit<Customer, "id" | "createdAt" | "updatedAt" | "instances">
    >,
  ) =>
    request<Customer>(`/api/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    request<void>(`/api/customers/${id}`, { method: "DELETE" }),
};

// ─── Application endpoints ───────────────────────────────────────────────────

export const applicationsApi = {
  list: () => request<Application[]>("/api/applications"),

  create: (data: { name: string; color: string; icon: string }) =>
    request<Application>("/api/applications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    id: number,
    data: Partial<{ name: string; color: string; icon: string }>,
  ) =>
    request<Application>(`/api/applications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: number) =>
    request<void>(`/api/applications/${id}`, { method: "DELETE" }),
};

// ─── Service endpoints ───────────────────────────────────────────────────────

export const servicesApi = {
  create: (
    appId: number,
    data: { name: string; description: string; price: string },
  ) =>
    request<Service>(`/api/applications/${appId}/services`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    id: number,
    data: Partial<{ name: string; description: string; price: string }>,
  ) =>
    request<Service>(`/api/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: number) =>
    request<void>(`/api/services/${id}`, { method: "DELETE" }),
};

// ─── Instance endpoints ──────────────────────────────────────────────────────

export const instancesApi = {
  assign: (customerId: string, applicationId: number) =>
    request<Instance>(`/api/customers/${customerId}/instances`, {
      method: "POST",
      body: JSON.stringify({ applicationId }),
    }),

  remove: (instanceId: number) =>
    request<void>(`/api/instances/${instanceId}`, { method: "DELETE" }),

  recordPayment: (instanceId: number, note?: string) =>
    request<Instance>(`/api/instances/${instanceId}/payment`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  listPayments: (instanceId: number) =>
    request<Payment[]>(`/api/instances/${instanceId}/payments`),

  removePayment: (paymentId: number) =>
    request<void>(`/api/payments/${paymentId}`, { method: "DELETE" }),

  updateBilling: (
    instanceId: number,
    data: Partial<{
      billingFrequency: BillingFrequency;
      billingDay: number;
      billingStartDate: string | null;
    }>,
  ) =>
    request<Instance>(`/api/instances/${instanceId}/billing`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateService: (
    instanceId: number,
    serviceId: number,
    data: { active?: boolean; priceOverride?: string },
  ) =>
    request<InstanceService>(
      `/api/instances/${instanceId}/services/${serviceId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    ),
};
