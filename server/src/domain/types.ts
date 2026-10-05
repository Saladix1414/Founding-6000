export type OrderStatus =
  | "CREATED"
  | "EMAIL_CAPTURED"
  | "CONFIRMED"
  | "AWAITING_PAYMENT"
  | "PAYMENT_PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "CANCELLED";

export type MembershipStatus =
  | "RESERVED"
  | "PAID"
  | "ACTIVATION_PENDING"
  | "ACTIVE"
  | "EXPIRED"
  | "REFUNDED"
  | "REVOKED";

export type CampaignPhaseCode =
  | "GENESIS"
  | "EARLY_ACCESS"
  | "FOUNDING_ACCESS";
