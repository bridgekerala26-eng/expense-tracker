import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardClient from './components/DashboardClient';

export const revalidate = 0;

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const userId = cookieStore.get('sb-user-id')?.value;
  const userRole = cookieStore.get('sb-user-role')?.value as 'admin' | 'Member' | 'Viewer';
  const userName = cookieStore.get('sb-user-name')?.value;

  // Server-side redirect if not authenticated
  if (!token || !userId) {
    redirect('/login');
  }

  // Pass session details to client.
  // The client component will fetch profiles and entries directly from Supabase over HTTPS (fully IPv4 compatible).
  return (
    <DashboardClient
      currentUser={{
        id: userId,
        name: userName || 'Authenticated User',
        role: userRole || 'user',
      }}
    />
  );
}
