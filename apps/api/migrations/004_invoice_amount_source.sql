-- Where each invoice amount came from, so the organizer can see why a member was asked for it.
alter table invoices add column amount_source text
  check (amount_source in ('organizer', 'payback', 'usual'));
