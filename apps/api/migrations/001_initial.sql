-- All money is integer US cents. SAR is a display label only (business rule 3).

create table circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer_email text not null,
  contribution_cents integer not null check (contribution_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  start_month date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  display_name text not null,
  email text not null,
  language text not null default 'en' check (language in ('en', 'ar', 'tr')),
  turn_position integer not null check (turn_position > 0),
  created_at timestamptz not null default now(),
  unique (circle_id, email),
  unique (circle_id, turn_position),
  unique (circle_id, id)
);

-- One row per month of the rotation: who receives the pot, and the payout that releases it.
create table turns (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  month_index integer not null check (month_index > 0),
  due_date date not null,
  recipient_member_id uuid not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'collecting', 'ready', 'paid_out')),
  sender_batch_id text unique,
  payout_batch_id text unique,
  paid_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (circle_id, month_index),
  unique (circle_id, id),
  foreign key (circle_id, recipient_member_id) references members (circle_id, id)
);

-- One invoice per member per turn; the unique constraint makes a duplicate impossible.
create table invoices (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  turn_id uuid not null,
  member_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  paypal_invoice_id text unique,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
  reminder_count integer not null default 0,
  last_reminded_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (turn_id, member_id),
  foreign key (circle_id, turn_id) references turns (circle_id, id) on delete cascade,
  foreign key (circle_id, member_id) references members (circle_id, id) on delete cascade
);

-- Anything the agent proposes that needs the organizer's click (business rule 1).
create table pending_actions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  turn_id uuid references turns (id) on delete cascade,
  kind text not null check (kind in ('payout', 'reminder')),
  payload jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz
);

create index pending_actions_circle_status_idx on pending_actions (circle_id, status);

-- Append-only history of who did what: organizer, agent, PayPal or the system.
create table audit (
  id bigint generated always as identity primary key,
  circle_id uuid references circles (id) on delete set null,
  actor text not null check (actor in ('organizer', 'agent', 'paypal', 'system')),
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_circle_created_idx on audit (circle_id, created_at);

-- PayPal delivers webhooks at least once; a repeat event id is ignored (business rule 6).
create table webhook_events (
  paypal_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
