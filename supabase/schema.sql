-- 1. Create Users profile table in public schema
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Member', 'Viewer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Entries table for expenses/income
CREATE TABLE IF NOT EXISTS public.entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
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

-- 4. Drop foreign key constraints referencing auth.users if tables already existed
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_user_id_fkey;
