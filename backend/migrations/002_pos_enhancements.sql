-- POS redesign support: configurable tax rate, per-order tax/table number,
-- branch open/closed status, and dine-in as a first-class order type.

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 0;
-- Manual for now — no FBR API integration yet. Swap to an FBR fetch later without
-- changing callers, since every order route already just reads this column.
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number character varying(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true;

-- POS needs "dine_in" alongside the existing takeaway/delivery order types.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('takeaway', 'delivery', 'dine_in'));
