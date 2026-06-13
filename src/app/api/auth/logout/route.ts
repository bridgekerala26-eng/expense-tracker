import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isFallback } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const fallback = await isFallback();
    
    if (!fallback) {
      // Sign out from Supabase if we are in database mode
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase auth signout failed, clearing cookies anyway:', e);
      }
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

    // Clear all cookies by setting them with maxAge: 0
    response.cookies.set('sb-access-token', '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set('sb-user-id', '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set('sb-user-role', '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set('sb-user-name', '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set('mock-role', '', { path: '/', maxAge: 0 });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
