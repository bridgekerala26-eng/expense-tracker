import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase auth signout failed, clearing cookies anyway:', e);
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

    // Clear all cookies
    response.cookies.set('sb-access-token', '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set('sb-user-id', '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set('sb-user-role', '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set('sb-user-name', '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set('sb-user-email', '', { httpOnly: true, path: '/', maxAge: 0 });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
