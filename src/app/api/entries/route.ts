import { NextRequest, NextResponse } from 'next/server';
import { db, isFallback } from '@/lib/db';
import { supabase } from '@/lib/supabase';

// GET: Retrieve all entries from all users
export async function GET() {
  try {
    const entries = await db.getEntries();
    return NextResponse.json({ success: true, entries });
  } catch (err: any) {
    console.error('Error fetching entries:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch entries', details: err.message }, { status: 500 });
  }
}

// POST: Add a new entry (expense or income)
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user from session cookies
    const token = req.cookies.get('sb-access-token')?.value;
    const cookieUserId = req.cookies.get('sb-user-id')?.value;

    if (!token || !cookieUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const fallback = await isFallback();
    let userId: string = cookieUserId;

    if (!fallback) {
      // Validate session token with Supabase in production
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Session invalid or expired' }, { status: 401 });
      }
      userId = user.id;
    }

    // 2. Parse and validate request body
    const body = await req.json();
    const { amount, type, category, description, date } = body;

    if (amount === undefined || !type || !category || !date) {
      return NextResponse.json({ success: false, error: 'Amount, type, category, and date are required' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be a valid positive number' }, { status: 400 });
    }

    if (type !== 'income' && type !== 'expense') {
      return NextResponse.json({ success: false, error: 'Type must be either "income" or "expense"' }, { status: 400 });
    }

    // 3. Save entry to DB or mock store
    const newEntry = await db.addEntry({
      user_id: userId,
      amount: parsedAmount,
      type,
      category,
      description: description || '',
      date
    });

    return NextResponse.json({
      success: true,
      message: 'Entry added successfully',
      entry: newEntry
    });
  } catch (err: any) {
    console.error('Error adding entry:', err);
    return NextResponse.json({ success: false, error: 'Failed to add entry', details: err.message }, { status: 500 });
  }
}
