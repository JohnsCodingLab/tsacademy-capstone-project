export const CACHE_TTL = {
  PRODUCT_LIST: 60 * 5, // 5 min
  PRODUCT_DETAIL: 60 * 5, // 5 min
  INVENTORY_SUMMARY: 60 * 2, // 2 min
  FORECAST: 60 * 10, // 10 min — heavy aggregation
} as const;

export const ORG_ROLES = {
  SUPER_ADMIN: "ORG_SUPER_ADMIN",
  ADMIN: "ORG_ADMIN",
  USER: "ORG_USER",
} as const;

export const FORECAST_DEFAULTS = {
  WINDOW_DAYS: 30,
  MAX_WINDOW_DAYS: 365,
} as const;
