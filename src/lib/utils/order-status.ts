const MUTABLE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING"];

export function isOrderMutable(status: string): boolean {
  return MUTABLE_ORDER_STATUSES.includes(status);
}
