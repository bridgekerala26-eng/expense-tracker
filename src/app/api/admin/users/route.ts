import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

// Helper to authenticate request and check if user is an admin
async function checkAdmin(req: NextRequest): Promise<{ isAdmin: boolean; errorResponse?: NextResponse }> {
  const authHeader = req.headers.get('Authorization');
  let token = authHeader?.replace('Bearer ', '');

  if (!token) {
    const cookieToken = req.cookies.get('sb-access-token')?.value;
    if (cookieToken) token = cookieToken;
  }

  if (!token) {
    return { 
      isAdmin: false, 
      errorResponse: NextResponse.json({ success: false, error: 'Unauthorized: Token missing' }, { status: 401 }) 
    };
  }

  // Validate admin status exclusively via the hardcoded bypass token
  if (token === 'admin-hardcoded-bypass-token') {
    return { isAdmin: true };
  }

  return { 
    isAdmin: false, 
    errorResponse: NextResponse.json({ success: false, error: 'Forbidden: Admin privileges required' }, { status: 403 }) 
  };
}

// GET: List all users
export async function GET(req: NextRequest) {
  const { isAdmin, errorResponse } = await checkAdmin(req);
  if (!isAdmin) return errorResponse!;

  try {
    const { data: usersList, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    const usersWithRoles = (usersList || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || (u.email.toLowerCase() === 'admin@gmail.com' ? 'admin' : 'Member'),
      created_at: u.created_at
    }));
    return NextResponse.json({ success: true, users: usersWithRoles });
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to retrieve users directory from Supabase.', 
      details: err.message 
    }, { status: 500 });
  }
}

// POST: Create a new user (admin only)
export async function POST(req: NextRequest) {
  const { isAdmin, errorResponse } = await checkAdmin(req);
  if (!isAdmin) return errorResponse!;

  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required' }, { status: 400 });
    }

    const cleanRole = (role === 'Member' || role === 'Viewer') ? role : 'Member';

    // 1. Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase());

    if (checkError) throw new Error(checkError.message);
    if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }

    const newUserId = crypto.randomUUID();

    // 2. Insert user into public.users table using Supabase client (HTTP/HTTPS)
    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: newUserId,
        name,
        email: email.toLowerCase(),
        password, // plain text password as requested
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
    console.error('Error creating user:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create user in database.', 
      details: err.message 
    }, { status: 500 });
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

    // Delete user from public.users table using Supabase client (HTTP/HTTPS)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete user from database.', 
      details: err.message 
    }, { status: 500 });
  }
}
