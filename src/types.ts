// ─── User ─────────────────────────────────────────────────────────────────────

export type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING";

export type Credential = {
  id: string;
  name: string;
  username: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  dni: string;
  company: string;
  phone: string;
  address: string;
  domains: string[];
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  credentials?: Credential[];
  instances: Instance[];
};

// ─── Application ──────────────────────────────────────────────────────────────

export type Service = {
  id: number;
  applicationId: number;
  name: string;
  description: string;
  price: string;
};

export type Application = {
  id: number;
  name: string;
  color: string;
  icon: string;
  services: Service[];
};

// ─── Instance ─────────────────────────────────────────────────────────────────

export type InstanceService = {
  id: number;
  instanceId: number;
  serviceId: number;
  active: boolean;
  priceOverride: string;
  service: Service;
};

export type BillingFrequency = "MONTHLY" | "ANNUAL";

export type Payment = {
  id: number;
  instanceId: number;
  paidAt: string;
  note: string;
};

export type Instance = {
  id: number;
  userId: string;
  applicationId: number;
  createdAt: string;
  contractDate: string;
  lastPaymentDate: string | null;
  billingFrequency: BillingFrequency;
  billingStartDate: string | null;
  billingDay: number;
  application: Application;
  instanceServices: InstanceService[];
};
