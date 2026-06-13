import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    // Read session data from cookies
    const token = req.cookies.get('sb-access-token')?.value;
    const userId = req.cookies.get('sb-user-id')?.value;
    const userRole = req.cookies.get('sb-user-role')?.value;
    const userName = req.cookies.get('sb-user-name')?.value;

    if (!token || !userId) {
      return NextResponse.json({ success: false, authenticated: false });
    }

    // Bypass Supabase validation for hardcoded admin token
    if (token === 'admin-hardcoded-bypass-token') {
      return NextResponse.json({
        success: true,
        authenticated: true,
        mode: 'Database Mode',
        user: {
          id: userId,
          name: userName || 'Bridge Admin',
          role: 'admin',
          email: 'admin@gmail.com'
        }
      });
    }

    // Bypass Supabase validation for plain-text logged in users
    if (token && token.startsWith('user-bypass-token-')) {
      const userEmail = req.cookies.get('sb-user-email')?.value || '';
      return NextResponse.json({
        success: true,
        authenticated: true,
        mode: 'Database Mode',
        user: {
          id: userId,
          name: userName || 'Authenticated User',
          role: userRole || 'Member',
          email: userEmail
        }
      });
    }

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user || user.id !== userId) {
      // Access token is invalid or expired
      const response = NextResponse.json({ success: false, authenticated: false });
      // Clear cookies
      response.cookies.set('sb-access-token', '', { httpOnly: true, path: '/', maxAge: 0 });
      response.cookies.set('sb-user-id', '', { httpOnly: true, path: '/', maxAge: 0 });
      response.cookies.set('sb-user-role', '', { httpOnly: true, path: '/', maxAge: 0 });
      response.cookies.set('sb-user-name', '', { httpOnly: true, path: '/', maxAge: 0 });
      response.cookies.set('sb-user-email', '', { httpOnly: true, path: '/', maxAge: 0 });
      return response;
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      mode: 'Database Mode',
      user: {
        id: userId,
        name: userName || 'Authenticated User',
        role: userRole || 'user',
        email: user.email
      }
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, authenticated: false, error: err.message }, { status: 500 });
  }
}
