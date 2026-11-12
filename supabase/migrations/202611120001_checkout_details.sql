-- Preserve all checkout fields that the storefront currently collects.
-- Safe to apply to an existing Amanah orders table; existing rows are retained.

alter table public.amanah_orders
  add column if not exists confirm_phone text;

alter table public.amanah_orders
  add column if not exists payment_method text not null default 'COD'
  check (payment_method in ('COD', 'GCASH'));

alter table public.amanah_orders
  add column if not exists delivery_notes text;

-- Existing records remain valid; new checkout submissions save the selected
-- payment method, mobile confirmation, and delivery instructions.
