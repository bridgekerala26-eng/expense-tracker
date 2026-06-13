import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    console.log('Running database migrations directly on Supabase...');

    // 1. Create public.users table
    await db.rawQuery(`
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Member', 'Viewer', 'admin')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Ensure columns and constraints are adjusted for existing tables
    try {
      await db.rawQuery(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;`);
      await db.rawQuery(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Member';`);
      await db.rawQuery(`ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;`);
    } catch (e: any) {
      console.log('Adjust users table warning (ignored):', e.message);
    }

    // 2. Create public.entries table
    await db.rawQuery(`
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
    `);

    try {
      await db.rawQuery(`ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_user_id_fkey;`);
    } catch (e: any) {
      console.log('Adjust entries table warning (ignored):', e.message);
    }

    // Disable Row Level Security (RLS) to ensure shared feed visibility
    await db.rawQuery('ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;');
    await db.rawQuery('ALTER TABLE public.entries DISABLE ROW LEVEL SECURITY;');

    // 3. Seed Admin User
    const adminEmail = 'admin@gmail.com';
    
    // Check if admin user already exists in auth.users
    const adminCheck = await db.rawQuery('SELECT id FROM auth.users WHERE email = $1', [adminEmail]);
    
    let adminUserId: string;

    if (adminCheck.rows.length === 0) {
      console.log('Admin user not found. Seeding admin credentials...');
      
      // Generate UUID for admin
      const uuidRes = await db.rawQuery('SELECT gen_random_uuid() as uuid');
      adminUserId = uuidRes.rows[0].uuid;

      // Insert into auth.users (encrypting password 'bridge.kl' using database pgcrypto crypt/gen_salt)
      await db.rawQuery(`
        INSERT INTO auth.users (
          id,
          instance_id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          is_super_admin,
          created_at,
          updated_at,
          phone,
          phone_confirmed_at,
          confirmation_token,
          recovery_token,
          email_change_token_new,
          email_change
        ) VALUES (
          $1,
          '00000000-0000-0000-0000-000000000000',
          'authenticated',
          'authenticated',
          $2,
          extensions.crypt('bridge.kl', extensions.gen_salt('bf', 10)),
          now(),
          '{"provider": "email", "providers": ["email"]}',
          '{"name": "Bridge Admin"}',
          false,
          now(),
          now(),
          null,
          null,
          '',
          '',
          '',
          ''
        )
      `, [adminUserId, adminEmail]);

      // Insert into auth.identities to enable email login identity in Supabase Auth
      await db.rawQuery(`
        INSERT INTO auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          last_sign_in_at,
          created_at,
          updated_at,
          provider_id
        ) VALUES (
          gen_random_uuid(),
          $1,
          jsonb_build_object('sub', $1::text, 'email', $2),
          'email',
          now(),
          now(),
          now(),
          $2
        )
      `, [adminUserId, adminEmail]);

      console.log(`Admin seeded in auth.users (ID: ${adminUserId})`);
    } else {
      adminUserId = adminCheck.rows[0].id;
      console.log(`Admin user already exists in auth.users (ID: ${adminUserId})`);
    }

    // Upsert admin profile in public.users table
    await db.rawQuery(`
      INSERT INTO public.users (id, name, email, role, password)
      VALUES ($1, 'Bridge Admin', $2, 'admin', 'bridge.kl')
      ON CONFLICT (id) DO UPDATE 
      SET name = 'Bridge Admin', role = 'admin', password = 'bridge.kl'
    `, [adminUserId, adminEmail]);

    return NextResponse.json({
      success: true,
      message: 'Migrations and admin seeding executed successfully directly in Supabase!',
      adminId: adminUserId
    });
  } catch (err: any) {
    console.error('Migration error:', err);
    return NextResponse.json({
      success: false,
      message: 'Database migrations failed.',
      error: err.message
    }, { status: 500 });
  }
}
