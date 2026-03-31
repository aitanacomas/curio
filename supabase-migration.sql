-- Run this in your Supabase project → SQL Editor

-- Plans
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  country text default '',
  dates text default '',
  cover_image_url text default 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
  description text default '',
  status text default 'dreaming' check (status in ('dreaming', 'planning', 'upcoming', 'past')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Days within a plan
create table if not exists plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade not null,
  label text not null,
  position integer default 0
);

-- Places within a day
create table if not exists plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade not null,
  plan_day_id uuid references plan_days(id) on delete cascade not null,
  name text not null,
  category text default '',
  image_url text default '',
  time_label text default '',
  notes text default '',
  booked boolean default false,
  position integer default 0
);

-- Add notes column if table already exists
alter table plan_items add column if not exists notes text default '';
alter table plan_items add column if not exists status text default 'none';
alter table plan_items add column if not exists check_in text default '';
alter table plan_items add column if not exists check_out text default '';
alter table plan_items add column if not exists location text default '';
alter table plan_items add column if not exists address text default '';
alter table plan_items add column if not exists neighborhood text default '';
alter table plan_items add column if not exists time_end text default '';

-- Plan collaborators
create table if not exists plan_collaborators (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  invited_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  unique(plan_id, user_id)
);

-- Saved individual places (post_places bookmarked by user)
create table if not exists saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  post_place_id uuid references post_places(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, post_place_id)
);

-- Enable Row Level Security
alter table plans enable row level security;
alter table plan_days enable row level security;
alter table plan_items enable row level security;
alter table plan_collaborators enable row level security;
alter table saved_places enable row level security;

-- RLS policies
create policy "plans owner" on plans for all using (auth.uid() = user_id);
create policy "plan_days owner" on plan_days for all using (
  plan_id in (select id from plans where user_id = auth.uid())
);
create policy "plan_items owner" on plan_items for all using (
  plan_id in (select id from plans where user_id = auth.uid())
);
create policy "plan_collaborators all" on plan_collaborators for all using (
  plan_id in (select id from plans where user_id = auth.uid())
  or user_id = auth.uid()
);
create policy "saved_places owner" on saved_places for all using (auth.uid() = user_id);

-- Item Invites
create table if not exists plan_item_invites (
  id uuid primary key default gen_random_uuid(),
  plan_item_id uuid references plan_items(id) on delete cascade,
  plan_id uuid references plans(id) on delete cascade,
  invited_by uuid references profiles(id) not null,
  invited_user_id uuid references profiles(id) not null,
  item_name text default '',
  item_category text default '',
  item_image_url text default '',
  item_time text default '',
  item_time_end text default '',
  item_address text default '',
  item_neighborhood text default '',
  item_notes text default '',
  event_date text default '',
  status text default 'pending',
  created_at timestamptz default now()
);
alter table plan_item_invites enable row level security;
create policy "invites_read" on plan_item_invites for select using (invited_user_id = auth.uid() or invited_by = auth.uid());
create policy "invites_insert" on plan_item_invites for insert with check (invited_by = auth.uid());
create policy "invites_update" on plan_item_invites for update using (invited_user_id = auth.uid());
