import { z } from "zod";

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join(", ");
    throw { status: 400, message };
  }
  return result.data;
}

// ── Schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["cashier", "chef", "delivery", "call_center", "branch_admin"]),
  branch_id: z.number().int().positive().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(150),
  price: z.number().min(0, "Price cannot be negative"),
  category: z.string().max(80).optional().nullable(),
  branch_id: z.number().int().positive().optional(),
});

export const createOrderSchema = z.object({
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive().optional().nullable(),
    quantity: z.number().int().min(1),
  })).min(1, "Cart is empty"),
  customer_name: z.string().max(150).optional().nullable(),
  customer_phone: z.string().max(20).optional().nullable(),
  customer_address: z.string().optional().nullable(),
  payment_method: z.enum(["cash", "card"]).default("cash"),
  branch_id: z.number().int().positive().optional(),
  source: z.enum(["pos", "call_center", "online"]).optional(),
  order_type: z.enum(["takeaway", "delivery"]).default("takeaway"),
});

export const passwordSchema = z.object({
  new_password: z.string().min(6, "Password must be at least 6 characters"),
});

export const cashSubmissionSchema = z.object({
  cashier_id: z.number().int().positive(),
  amount_given: z.number().positive("Amount must be greater than 0"),
});