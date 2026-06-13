import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import DashboardClient from './components/DashboardClient';

// Disable caching for this page so it always loads fresh entries from the database/mock store
export const revalidate = 0;

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const userId = cookieStore.get('sb-user-id')?.value;
  const userRole = cookieStore.get('sb-user-role')?.value as 'admin' | 'user';
  const userName = cookieStore.get('sb-user-name')?.value;

  // Server-side redirect if not authenticated
  if (!token || !userId) {
    redirect('/login');
  }

  // Fetch initial data on the server
  // This gets entries and profiles from DB or the local mock fallback automatically!
  const entries = await db.getEntries();
  const profiles = await db.getProfiles();
  const mode = await db.getMode();

  return (
    <DashboardClient
      initialEntries={entries}
      profiles={profiles}
      currentUser={{
        id: userId,
        name: userName || 'Authenticated User',
        role: userRole || 'user',
      }}
      systemMode={mode}
    />
  );
}
