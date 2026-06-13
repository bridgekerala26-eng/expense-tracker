import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    // Hardcoded credentials check for admin
    if (email.toLowerCase() === 'admin@gmail.com') {
      if (password !== 'bridge.kl') {
        return NextResponse.json({ success: false, error: 'Invalid admin credentials' }, { status: 400 });
      }

      let adminId = 'da7ba5a5-ad15-40ad-a111-ad711ad711ad'; // Fallback static UUID
      let name = 'Bridge Admin';

      try {
        // Find existing admin UUID in auth.users
        const authCheck = await db.rawQuery("SELECT id FROM auth.users WHERE email = $1", [email.toLowerCase()]);
        if (authCheck.rows.length > 0) {
          adminId = authCheck.rows[0].id;
        } else {
          // If not in auth.users, try users table
          const usersCheck = await db.rawQuery("SELECT id, name FROM users WHERE email = $1", [email.toLowerCase()]);
          if (usersCheck.rows.length > 0) {
            adminId = usersCheck.rows[0].id;
            name = usersCheck.rows[0].name;
          }
        }
      } catch (err) {
        console.error('Database query failed when looking up admin. Using fallback ID.', err);
      }

      const response = NextResponse.json({
        success: true,
        user: { id: adminId, name, email, role: 'admin' }
      });

      // Set server-side session cookies
      response.cookies.set('sb-access-token', 'admin-hardcoded-bypass-token', { httpOnly: true, path: '/' });
      response.cookies.set('sb-user-id', adminId, { httpOnly: true, path: '/' });
      response.cookies.set('sb-user-role', 'admin', { httpOnly: true, path: '/' });
      response.cookies.set('sb-user-name', name, { httpOnly: true, path: '/' });

      return response;
    }

    // Authenticate normal users with Supabase Auth
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
    const role = 'user';

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
