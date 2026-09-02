export type ProductType = "PHYSICAL" | "DIGITAL_REPORT" | "CONSULTATION" | "PUJA" | "COURSE";

export type OrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PROCESSING"
  | "FULFILLED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";

export type ReportStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "QUEUED"
  | "CALCULATING"
  | "INTERPRETING"
  | "RENDERING"
  | "READY"
  | "FAILED";

export type ConsultationStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type InventoryStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "PREORDER";

export type UserRole = "CUSTOMER" | "ASTROLOGER" | "EDITOR" | "ADMIN" | "SUPER_ADMIN";

export type BirthProfile = {
  id: string;
  userId: string;
  name: string;
  dateOfBirth: Date;
  timeOfBirth: string;
  placeOfBirth: string;
  latitude?: number;
  longitude?: number;
};

export type ProductSummary = {
  id: string;
  type: ProductType;
  title: string;
  slug: string;
  pricePaise: number;
  salePricePaise?: number;
  inventoryStatus?: InventoryStatus;
};
