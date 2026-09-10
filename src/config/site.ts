export type FeatureFlags = {
  commerce: boolean;
  reports: boolean;
  consultations: boolean;
  shop: boolean;
  puja: boolean;
  courses: boolean;
  aiReports: boolean;
};

export const siteConfig = {
  defaultPageSize: 24,
  containerWidth: "var(--container-xl)",
  supportEmail: "support@tarunastro.com",
  features: {
    commerce: false,
    reports: false,
    consultations: false,
    shop: false,
    puja: false,
    courses: false,
    aiReports: false,
  } satisfies FeatureFlags,
  commerce: {
    enableCart: false,
    enableWishlist: false,
    enableCoupons: false,
  },
  reports: {
    enableGeneration: false,
    enablePdfDelivery: false,
  },
  consultations: {
    enableBooking: false,
    enableChat: false,
    enableVideo: false,
  },
  shop: {
    enableInventory: false,
    enableShipping: false,
  },
} as const;
