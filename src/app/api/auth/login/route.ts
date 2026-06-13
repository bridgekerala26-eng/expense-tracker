import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase, getSupabaseAdmin } from '@/lib/supabase';

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
      response.cookies.set('sb-user-email', 'admin@gmail.com', { httpOnly: true, path: '/' });

      return response;
    }

    // Query users table directly for matching email
    const supabaseAdmin = getSupabaseAdmin();
    const { data: userRecord, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, password')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (dbError) {
      console.error('Database query failed during login:', dbError);
      return NextResponse.json({ success: false, error: 'Database connectivity error' }, { status: 500 });
    }

    if (!userRecord || userRecord.password !== password) {
      return NextResponse.json({ success: false, error: 'Invalid login credentials' }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role: userRecord.role || 'Member'
      }
    });

    // Set server-side session cookies
    const userBypassToken = `user-bypass-token-${userRecord.id}`;
    response.cookies.set('sb-access-token', userBypassToken, { httpOnly: true, path: '/' });
    response.cookies.set('sb-user-id', userRecord.id, { httpOnly: true, path: '/' });
    response.cookies.set('sb-user-role', userRecord.role || 'Member', { httpOnly: true, path: '/' });
    response.cookies.set('sb-user-name', userRecord.name, { httpOnly: true, path: '/' });
    response.cookies.set('sb-user-email', userRecord.email.toLowerCase(), { httpOnly: true, path: '/' });

    return response;
  } catch (err: any) {
    console.error('Login route error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error during login' }, { status: 500 });
  }
}
