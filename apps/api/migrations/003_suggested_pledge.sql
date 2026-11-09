-- The usual amount the organizer mentions ("1,000 a month") is only a default for invoices,
-- never a fixed contribution.
alter table circles add column suggested_pledge_cents integer check (suggested_pledge_cents > 0);
