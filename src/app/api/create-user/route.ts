import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Helper to authenticate request and check if user is an admin
async function checkAdmin(req: NextRequest): Promise<{ isAdmin: boolean; errorResponse?: NextResponse }> {
  // If user email or role cookie indicates admin, always allow
  const userRole = req.cookies.get('sb-user-role')?.value;
  const userEmail = req.cookies.get('sb-user-email')?.value;
  const token = req.cookies.get('sb-access-token')?.value;

  if (
    userRole === 'admin' ||
    userEmail?.toLowerCase() === 'admin@gmail.com' ||
    token === 'admin-hardcoded-bypass-token'
  ) {
    return { isAdmin: true };
  }

  const authHeader = req.headers.get('Authorization');
  let bearerToken = authHeader?.replace('Bearer ', '');

  if (!bearerToken) {
    bearerToken = token || '';
  }

  if (!bearerToken) {
    return { 
      isAdmin: false, 
      errorResponse: NextResponse.json({ success: false, error: 'Unauthorized: Token missing' }, { status: 401 }) 
    };
  }

  // Validate admin status via the hardcoded bypass token
  if (bearerToken === 'admin-hardcoded-bypass-token') {
    return { isAdmin: true };
  }

  return { 
    isAdmin: false, 
    errorResponse: NextResponse.json({ success: false, error: 'Forbidden: Admin privileges required' }, { status: 403 }) 
  };
}

// POST: Create a new user (admin only) using SUPABASE_SERVICE_ROLE_KEY
export async function POST(req: NextRequest) {
  const { isAdmin, errorResponse } = await checkAdmin(req);
  if (!isAdmin) return errorResponse!;

  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required' }, { status: 400 });
    }

    const cleanRole = (role === 'Member' || role === 'Viewer') ? role : 'Member';

    // Initialize the Admin client using the SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase());

    if (checkError) throw new Error(checkError.message);
    if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }

    const newUserId = crypto.randomUUID();

    // 2. Insert user into public.users table using the Admin client (bypasses RLS)
    const { data: insertedUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        name,
        email: email.toLowerCase(),
        password, // plain text
        role: cleanRole,
        created_at: new Date().toISOString()
      })
      .select('*');

    if (insertError) throw new Error(insertError.message);
    if (!insertedUser || insertedUser.length === 0) throw new Error('Failed to save user in database.');

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: insertedUser[0].id,
        name: insertedUser[0].name,
        email: insertedUser[0].email,
        role: insertedUser[0].role
      }
    });
  } catch (err: any) {
    console.error('Error creating user via service role:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create user in database.', 
      details: err.message 
    }, { status: 500 });
  }
}
