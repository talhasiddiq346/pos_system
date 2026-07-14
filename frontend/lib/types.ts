export type Role =
  | "super_admin"
  | "branch_admin"
  | "cashier"
  | "call_center"
  | "delivery"
  | "chef";

export type StaffRole = "cashier" | "chef" | "delivery";
export type User = {
  id: number;
  name: string;
  role: Role;
  branch_id: number | null;
};

export type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  branch_id: number | null;
};
export type ProductVariant = {
  id: number;
  product_id: number;
  name: string;
  price: string;
  is_available: boolean;
};

export type Product = {
  id: number;
  branch_id: number;
  name: string;
  price: string;
  category: string | null;
  image_url: string | null;
  is_available: boolean;
  variants: ProductVariant[];
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  variant_id: number | null;
  variant_name: string | null;
  unit_price: string;
  quantity: number;
  line_total: string;
};

export type RiderStatus = "available" | "busy" | "out_for_delivery" | "offline";

export type DeliveryAssignment = {
  id: number;
  order_id: number;
  rider_id: number;
  assigned_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  delivered_at: string | null;
  status: "pending" | "accepted" | "rejected" | "delivered";
  attempt: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  total: string;
  source: string;
  payment_method: string;
  order_time: string;
  items: { name: string; variant: string | null; qty: number }[];
  rider_name?: string;
};
// Order type update
export type Order = {
  id: number;
  branch_id: number;
  source: string;
  order_type: "takeaway" | "delivery";
  status: string;
  subtotal: string;
  total: string;
  payment_method: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
};
export type CashSubmission = {
  id: number;
  rider_id: number;
  cashier_id: number;
  branch_id: number;
  total_owed: string;
  amount_given: string;
  debt_carried: string;
  status: "pending" | "accepted";
  note: string | null;
  submitted_at: string;
  accepted_at: string | null;
  rider_name?: string;
  cashier_name?: string;
  branch_name?: string;
};

export type RiderForAssignment = {
  id: number;
  name: string;
  rider_status: RiderStatus;
  active_orders: number;
};

export type CashSummary = {
  delivered_orders: any[];
  cash_orders: any[];
  total_cash_collected: number;
  previous_debt: number;
  total_owed: number;
  total_given_today: number;
  remaining_owed: number;
};
export type OrderWithItems = Order & { items: OrderItem[] };