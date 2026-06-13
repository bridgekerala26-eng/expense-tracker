import { Pool } from 'pg';

let pool: Pool | null = null;

// Initialize the pg Pool lazily
function getPool() {
  if (pool) return pool;
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000
  });

  return pool;
}

// Data Access Layer for raw server-side admin SQL commands (migrations, user setups)
export const db = {
  // Profiles
  getProfiles: async () => {
    const p = getPool();
    const res = await p.query('SELECT * FROM profiles ORDER BY name ASC');
    return res.rows;
  },

  createProfile: async (id: string, name: string, email: string, role: 'admin' | 'user' = 'user') => {
    const p = getPool();
    const res = await p.query(
      `INSERT INTO profiles (id, name, email, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, name, email, role]
    );
    return res.rows[0];
  },

  deleteUser: async (id: string): Promise<boolean> => {
    const p = getPool();
    // Deleting from auth.users cascade deletes public.profiles
    const res = await p.query('DELETE FROM auth.users WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  },

  // Raw database query runner
  rawQuery: async (sql: string, params: any[] = []) => {
    const p = getPool();
    return p.query(sql, params);
  }
};
