-- 1. Create Users profile table in public schema
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Entries table for expenses/income
CREATE TABLE IF NOT EXISTS public.entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  user_name text,
  type text check (type in ('expense', 'income')),
  amount numeric not null,
  category text,
  description text,
  date date,
  created_at timestamp default now()
);

-- 3. Disable Row Level Security (RLS) to allow easy shared access across all users
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries DISABLE ROW LEVEL SECURITY;
