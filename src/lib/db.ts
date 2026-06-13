import { Pool } from 'pg';

let pool: Pool | null = null;

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
  // Retrieve custom public.users
  getProfiles: async () => {
    const p = getPool();
    const res = await p.query('SELECT * FROM users ORDER BY name ASC');
    return res.rows;
  },

  createProfile: async (id: string, name: string, email: string, role: string = 'Member', password?: string) => {
    const p = getPool();
    const res = await p.query(
      `INSERT INTO users (id, name, email, role, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name, email, role, password || null]
    );
    return res.rows[0];
  },

  deleteUser: async (id: string): Promise<boolean> => {
    const p = getPool();
    // Deleting from auth.users cascade deletes public.users
    const res = await p.query('DELETE FROM auth.users WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  },

  // Raw database query runner
  rawQuery: async (sql: string, params: any[] = []) => {
    const p = getPool();
    return p.query(sql, params);
  }
};
