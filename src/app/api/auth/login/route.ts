import { NextRequest, NextResponse } from 'next/server';
import { db, isFallback } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const fallback = await isFallback();

    // 1. Mock Mode Authentication
    if (fallback) {
      // Find user in mock profiles
      const profiles = db.getProfiles ? await db.getProfiles() : [];
      const userProfile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());

      // Simple mock password check: password must be 'bridge.kl'
      if (userProfile && password === 'bridge.kl') {
        const response = NextResponse.json({
          success: true,
          message: 'Logged in successfully (Mock Mode)',
          user: userProfile
        });

        // Set cookies for mock session
        response.cookies.set('sb-access-token', `mock-token-${userProfile.id}`, { httpOnly: true, path: '/' });
        response.cookies.set('sb-user-id', userProfile.id, { httpOnly: true, path: '/' });
        response.cookies.set('sb-user-role', userProfile.role, { httpOnly: true, path: '/' });
        response.cookies.set('sb-user-name', userProfile.name, { httpOnly: true, path: '/' });
        response.cookies.set('mock-role', userProfile.role, { path: '/' }); // for client read

        return response;
      } else {
        return NextResponse.json({ success: false, error: 'Invalid mock login credentials' }, { status: 400 });
      }
    }

    // 2. Production Supabase Authentication
    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json({ success: false, error: authError?.message || 'Invalid login credentials' }, { status: 400 });
    }

    // Fetch profile details (role and name) from public.profiles table
    const profileRes = await db.rawQuery('SELECT name, role FROM profiles WHERE id = $1', [authData.user.id]);
    
    if (profileRes.rows.length === 0) {
      // If profile is missing (unexpected), create one on the fly
      const name = email.split('@')[0];
      const role = email.toLowerCase() === 'admin@gmail.com' ? 'admin' : 'user';
      await db.createProfile(authData.user.id, name, email, role);
      
      const response = NextResponse.json({
        success: true,
        user: { id: authData.user.id, name, email, role }
      });
      response.cookies.set('sb-access-token', authData.session.access_token, { httpOnly: true, path: '/' });
      response.cookies.set('sb-user-id', authData.user.id, { httpOnly: true, path: '/' });
      response.cookies.set('sb-user-role', role, { httpOnly: true, path: '/' });
      response.cookies.set('sb-user-name', name, { httpOnly: true, path: '/' });
      return response;
    }

    const { name, role } = profileRes.rows[0];
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
