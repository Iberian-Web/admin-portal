import type { CustomerStatus } from "../api";

export const statusLabel: Record<CustomerStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  PENDING: "Pendiente",
};
