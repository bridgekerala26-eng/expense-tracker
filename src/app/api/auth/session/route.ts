import { NextRequest, NextResponse } from 'next/server';
import { db, isFallback } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const fallback = await isFallback();
    
    // Read session data from cookies
    const token = req.cookies.get('sb-access-token')?.value;
    const userId = req.cookies.get('sb-user-id')?.value;
    const userRole = req.cookies.get('sb-user-role')?.value;
    const userName = req.cookies.get('sb-user-name')?.value;

    if (!token || !userId) {
      return NextResponse.json({ success: false, authenticated: false });
    }

    if (fallback) {
      // Return mock session
      return NextResponse.json({
        success: true,
        authenticated: true,
        mode: 'Mock Mode',
        user: {
          id: userId,
          name: userName || 'Mock User',
          role: userRole || 'user'
        }
      });
    }

    // Database Mode validation
    // Verify token with Supabase Auth to ensure it is valid
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user || user.id !== userId) {
      // Access token is invalid or expired
      const response = NextResponse.json({ success: false, authenticated: false });
      // Clear cookies
      response.cookies.set('sb-access-token', '', { httpOnly: true, path: '/', maxAge: 0 });
      response.cookies.set('sb-user-id', '', { httpOnly: true, path: '/', maxAge: 0 });
      response.cookies.set('sb-user-role', '', { httpOnly: true, path: '/', maxAge: 0 });
      response.cookies.set('sb-user-name', '', { httpOnly: true, path: '/', maxAge: 0 });
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
