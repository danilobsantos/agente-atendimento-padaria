export enum BotState {
  START = "START",
  SHOW_MENU = "SHOW_MENU",
  ADDING_PRODUCTS = "ADDING_PRODUCTS",
  WAITING_NAME = "WAITING_NAME",
  WAITING_ADDRESS = "WAITING_ADDRESS",
  WAITING_PAYMENT = "WAITING_PAYMENT",
  CONFIRM_ORDER = "CONFIRM_ORDER",
  FINISHED = "FINISHED",
  CANCELLED = "CANCELLED",
}

export interface OrderItemState {
  productId: string;
  quantity: number;
  price: number;
  name: string; // Stored for display without querying DB
  notes?: string;
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
  context: {
    role: "user" | "assistant";
    content: string;
  }[];
  activeOrderId?: string;
}
