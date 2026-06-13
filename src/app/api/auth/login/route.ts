import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json({ success: false, error: authError?.message || 'Invalid login credentials' }, { status: 400 });
    }

    // Fetch user details from public.users table
    const userRes = await db.rawQuery('SELECT name FROM users WHERE id = $1', [authData.user.id]);
    
    let name = email.split('@')[0];
    const role = email.toLowerCase() === 'admin@gmail.com' ? 'admin' : 'user';

    if (userRes.rows.length === 0) {
      // If user metadata is missing, create it in public.users
      await db.createProfile(authData.user.id, name, email);
    } else {
      name = userRes.rows[0].name;
    }

    const response = NextResponse.json({
      success: true,
      user: { id: authData.user.id, name, email, role }
    });

    // Set server-side session cookies
    response.cookies.set('sb-access-token', authData.session.access_token, { httpOnly: true, path: '/' });
    response.cookies.set('sb-user-id', authData.user.id, { httpOnly: true, path: '/' });
    response.cookies.set('sb-user-role', role, { httpOnly: true, path: '/' });
    response.cookies.set('sb-user-name', name, { httpOnly: true, path: '/' });

    return response;
  } catch (err: any) {
    console.error('Login route error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error during login' }, { status: 500 });
  }
}
