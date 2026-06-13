import { NextRequest, NextResponse } from 'next/server';
import { db, isFallback } from '@/lib/db';
import { supabase } from '@/lib/supabase';

// Helper to authenticate request and check if user is an admin
async function checkAdmin(req: NextRequest): Promise<{ isAdmin: boolean; errorResponse?: NextResponse }> {
  // Get token from Authorization header or cookies
  const authHeader = req.headers.get('Authorization');
  let token = authHeader?.replace('Bearer ', '');

  if (!token) {
    // Try cookie fallback
    const cookieToken = req.cookies.get('sb-access-token')?.value;
    if (cookieToken) token = cookieToken;
  }

  // Local development / Mock mode bypass
  const fallback = await isFallback();
  if (fallback) {
    // In mock mode, check if the request header has a mock admin token or check mock user
    const mockUserRole = req.headers.get('X-Mock-Role') || req.cookies.get('mock-role')?.value;
    if (mockUserRole === 'admin') {
      return { isAdmin: true };
    }
    return { 
      isAdmin: false, 
      errorResponse: NextResponse.json({ success: false, error: 'Unauthorized: Admin role required (mock mode)' }, { status: 401 }) 
    };
  }

  if (!token) {
    return { 
      isAdmin: false, 
      errorResponse: NextResponse.json({ success: false, error: 'Unauthorized: Token missing' }, { status: 401 }) 
    };
  }

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { 
        isAdmin: false, 
        errorResponse: NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 }) 
      };
    }

    // Check user role in public.profiles table
    const profiles = await db.rawQuery('SELECT role FROM profiles WHERE id = $1', [user.id]);
    if (profiles.rows.length === 0 || profiles.rows[0].role !== 'admin') {
      return { 
        isAdmin: false, 
        errorResponse: NextResponse.json({ success: false, error: 'Forbidden: Admin privileges required' }, { status: 403 }) 
      };
    }

    return { isAdmin: true };
  } catch (err: any) {
    return { 
      isAdmin: false, 
      errorResponse: NextResponse.json({ success: false, error: 'Internal server check failed', details: err.message }, { status: 500 }) 
    };
  }
}

// GET: List all users (excluding sensitive details like passwords)
export async function GET(req: NextRequest) {
  const { isAdmin, errorResponse } = await checkAdmin(req);
  if (!isAdmin) return errorResponse!;

  try {
    const profiles = await db.getProfiles();
    return NextResponse.json({ success: true, users: profiles });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Create a new user (admin only)
export async function POST(req: NextRequest) {
  const { isAdmin, errorResponse } = await checkAdmin(req);
  if (!isAdmin) return errorResponse!;

  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required' }, { status: 400 });
    }

    const fallback = await isFallback();
    if (fallback) {
      // Create user in mock database
      const profile = await db.createProfile('', name, email, 'user');
      return NextResponse.json({ success: true, message: 'User created in Mock Mode', user: profile });
    }

    // Direct Database User Insertion
    // 1. Check if user already exists in auth.users
    const existing = await db.rawQuery('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }

    // 2. Generate a new UUID
    const uuidRes = await db.rawQuery('SELECT gen_random_uuid() as uuid');
    const newUserId = uuidRes.rows[0].uuid;

    // 3. Insert into auth.users (encrypting password using crypt/gen_salt)
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
        extensions.crypt($3, extensions.gen_salt('bf', 10)),
        now(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('name', $4),
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
    `, [newUserId, email, password, name]);

    // 4. Insert into auth.identities
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
    `, [newUserId, email]);

    // 5. Insert profile in public.profiles table
    const profile = await db.createProfile(newUserId, name, email, 'user');

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: profile
    });
  } catch (err: any) {
    console.error('Error creating user:', err);
    return NextResponse.json({ success: false, error: 'Failed to create user', details: err.message }, { status: 500 });
  }
}

// DELETE: Delete a user (admin only)
export async function DELETE(req: NextRequest) {
  const { isAdmin, errorResponse } = await checkAdmin(req);
  if (!isAdmin) return errorResponse!;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const success = await db.deleteUser(userId);
    if (!success) {
      return NextResponse.json({ success: false, error: 'User not found or could not be deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return NextResponse.json({ success: false, error: 'Failed to delete user', details: err.message }, { status: 500 });
  }
}
