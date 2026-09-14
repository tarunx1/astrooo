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

/**
 * The roles that carry meaning.
 *
 * This had drifted badly: it still listed ASTROLOGER and EDITOR, which grant no
 * permissions and are assigned by nothing, while omitting PANDIT and EMPLOYEE,
 * which are two of the live roles the platform runs on. Nothing imported it, so
 * the drift was invisible rather than harmful - but read as documentation it
 * described a system that does not exist.
 */
export type UserRole = "CUSTOMER" | "PANDIT" | "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";

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
