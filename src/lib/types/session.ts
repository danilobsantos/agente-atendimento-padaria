export enum BotState {
  START = "START",
  SHOW_MENU = "SHOW_MENU",
  FINISHED = "FINISHED",
  CANCELLED = "CANCELLED",
}

export interface OrderItemAdditionalState {
  id: string;
  name: string;
  price: number;
}

export interface OrderItemState {
  productId: string;
  quantity: number;
  price: number;
  name: string; // Stored for display without querying DB
  notes?: string;
  additionalItems?: OrderItemAdditionalState[];
}

export interface CustomerState {
  name?: string;
  address?: string;
}

export interface BotSession {
  tenantId: string;
  customerId: string;
  phone: string;
  state: BotState;
  customer: CustomerState;
  order: {
    items: OrderItemState[];
    total: number;
    deliveryFee: number;
  };
  payment?: string;
  orderType?: "DELIVERY" | "PICKUP";
  context: {
    role: "user" | "assistant";
    content: string;
  }[];
  activeOrderId?: string;
}
