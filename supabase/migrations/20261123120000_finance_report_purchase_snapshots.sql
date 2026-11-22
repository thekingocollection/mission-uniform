-- Preserve the purchased product and access duration on each successful subject payment.
begin;
alter table public.subject_payment_transactions
  add column if not exists product_name text,
  add column if not exists access_duration_days integer,
  add column if not exists access_expires_at timestamptz;
create index if not exists subject_payment_transactions_paid_at_idx
  on public.subject_payment_transactions(paid_at desc);
notify pgrst, 'reload schema';
commit;
