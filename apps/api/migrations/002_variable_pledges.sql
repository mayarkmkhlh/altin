-- Model change 9 Nov: no fixed contribution per circle. Each invoice carries that member's own pledge,
-- and a gathering's payout is the sum of its paid invoices.

alter table circles drop column contribution_cents;

alter table circles drop constraint circles_status_check;
update circles set status = 'forming' where status = 'draft';
alter table circles alter column status set default 'forming';
alter table circles add constraint circles_status_check
  check (status in ('forming', 'active', 'completed'));

alter table turns drop constraint turns_status_check;
update turns set status = 'pot_complete' where status = 'ready';
update turns set status = 'released' where status = 'paid_out';
alter table turns add constraint turns_status_check
  check (status in ('upcoming', 'collecting', 'pot_complete', 'releasing', 'released'));
alter table turns add column payout_amount_cents integer check (payout_amount_cents > 0);

alter table invoices drop constraint invoices_status_check;
update invoices set status = 'closed' where status = 'cancelled';
alter table invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'partially_paid', 'paid', 'closed'));
