import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Retrieve all entries from all users using Supabase client (HTTP)
export async function GET() {
  try {
    const { data: entriesData, error: entriesError } = await supabase
      .from('entries')
      .select('*, profiles(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (entriesError) throw new Error(entriesError.message);

    // Map entries to flatten user_name
    const mapped = (entriesData || []).map((e: any) => ({
      id: e.id,
      user_id: e.user_id,
      user_name: e.profiles?.name || 'Unknown User',
      amount: parseFloat(e.amount),
      type: e.type,
      category: e.category,
      description: e.description || '',
      date: e.date,
      created_at: e.created_at,
    }));

    return NextResponse.json({ success: true, entries: mapped });
  } catch (err: any) {
    console.error('Error fetching entries via API:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch entries', details: err.message }, { status: 500 });
  }
}

// POST: Add a new entry (expense or income) using Supabase client (HTTP)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('sb-access-token')?.value;
    const cookieUserId = req.cookies.get('sb-user-id')?.value;

    if (!token || !cookieUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    // Validate token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.id !== cookieUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, type, category, description, date } = body;

    if (amount === undefined || !type || !category || !date) {
      return NextResponse.json({ success: false, error: 'Amount, type, category, and date are required' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be a valid positive number' }, { status: 400 });
    }

    // Insert into Supabase database via HTTP REST
    const { data: insertedData, error: insertError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        amount: parsedAmount,
        type,
        category,
        description: description || '',
        date
      })
      .select('*, profiles(name)');

    if (insertError) throw new Error(insertError.message);
    if (!insertedData || insertedData.length === 0) throw new Error('Transaction could not be saved.');

    const newEntry = {
      id: insertedData[0].id,
      user_id: insertedData[0].user_id,
      user_name: insertedData[0].profiles?.name || user.email?.split('@')[0] || 'Unknown User',
      amount: parseFloat(insertedData[0].amount),
      type: insertedData[0].type,
      category: insertedData[0].category,
      description: insertedData[0].description || '',
      date: insertedData[0].date,
      created_at: insertedData[0].created_at,
    };

    return NextResponse.json({
      success: true,
      message: 'Entry added successfully',
      entry: newEntry
    });
  } catch (err: any) {
    console.error('Error adding entry via API:', err);
    return NextResponse.json({ success: false, error: 'Failed to add entry', details: err.message }, { status: 500 });
  }
}
