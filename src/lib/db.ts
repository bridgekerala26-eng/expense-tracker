import { Pool } from 'pg';
import { mockDb, Entry, Profile } from './mockDb';

let pool: Pool | null = null;
let useFallback = false;
let connectionChecked = false;

// Initialize the pg Pool lazily
function getPool() {
  if (pool) return pool;
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('No DATABASE_URL found. Falling back to mock database.');
    useFallback = true;
    return null;
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000
  });

  return pool;
}

// Check if we should use the database or the mock fallback
export async function isFallback(): Promise<boolean> {
  if (connectionChecked) return useFallback;
  
  const p = getPool();
  if (!p) {
    useFallback = true;
    connectionChecked = true;
    return true;
  }

  try {
    const client = await p.connect();
    client.release();
    console.log('Database connected successfully! Running in Supabase Database Mode.');
    useFallback = false;
  } catch (err: any) {
    console.warn('\n=========================================');
    console.warn('WARNING: Failed to connect to Supabase PostgreSQL database.');
    console.warn('Reason:', err.message);
    console.warn('Activating local In-Memory Fallback Mode.');
    console.warn('=========================================\n');
    useFallback = true;
  } finally {
    connectionChecked = true;
  }

  return useFallback;
}

// DAL Methods
export const db = {
  // Check system status
  getMode: async () => {
    const fallback = await isFallback();
    return fallback ? 'Mock Mode (In-Memory)' : 'Database Mode (Supabase)';
  },

  // Entries
  getEntries: async (): Promise<Entry[]> => {
    if (await isFallback()) {
      return mockDb.getEntries();
    }
    
    const p = getPool()!;
    const res = await p.query(`
      SELECT 
        e.id, 
        e.user_id, 
        COALESCE(p.name, 'Unknown User') as user_name,
        e.amount::float, 
        e.type, 
        e.category, 
        e.description, 
        e.date::text as date, 
        e.created_at
      FROM entries e
      LEFT JOIN profiles p ON e.user_id = p.id
      ORDER BY e.date DESC, e.created_at DESC
    `);
    return res.rows;
  },

  addEntry: async (entry: Omit<Entry, 'id' | 'created_at' | 'user_name'>): Promise<Entry> => {
    if (await isFallback()) {
      return mockDb.addEntry(entry);
    }

    const p = getPool()!;
    const res = await p.query(
      `INSERT INTO entries (user_id, amount, type, category, description, date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, amount::float, type, category, description, date::text as date, created_at`,
      [entry.user_id, entry.amount, entry.type, entry.category, entry.description, entry.date]
    );
    
    // Fetch profile name
    let userName = 'Unknown User';
    if (entry.user_id) {
      const uRes = await p.query('SELECT name FROM profiles WHERE id = $1', [entry.user_id]);
      if (uRes.rows.length > 0) {
        userName = uRes.rows[0].name;
      }
    }

    return {
      ...res.rows[0],
      user_name: userName
    };
  },

  // Profiles
  getProfiles: async (): Promise<Profile[]> => {
    if (await isFallback()) {
      return mockDb.getProfiles();
    }

    const p = getPool()!;
    const res = await p.query('SELECT * FROM profiles ORDER BY name ASC');
    return res.rows;
  },

  createProfile: async (id: string, name: string, email: string, role: 'admin' | 'user' = 'user'): Promise<Profile> => {
    if (await isFallback()) {
      // Add profile to mock store
      const prof = mockDb.addProfile(name, email, role);
      // Keep ID in sync with what auth.signUp returned
      prof.id = id;
      return prof;
    }

    const p = getPool()!;
    const res = await p.query(
      `INSERT INTO profiles (id, name, email, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, name, email, role]
    );
    return res.rows[0];
  },

  deleteUser: async (id: string): Promise<boolean> => {
    if (await isFallback()) {
      return mockDb.deleteProfile(id);
    }

    const p = getPool()!;
    // Deleting from auth.users will automatically cascade delete from public.profiles
    // due to foreign key ON DELETE CASCADE.
    const res = await p.query('DELETE FROM auth.users WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  },

  // Direct database helper (for migrations)
  rawQuery: async (sql: string, params: any[] = []) => {
    const p = getPool();
    if (!p) throw new Error('Database pool not initialized');
    return p.query(sql, params);
  }
};
