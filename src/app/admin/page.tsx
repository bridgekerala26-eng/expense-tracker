import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';

export const revalidate = 0;

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  const userId = cookieStore.get('sb-user-id')?.value;
  const userRole = cookieStore.get('sb-user-role')?.value;
  const userName = cookieStore.get('sb-user-name')?.value;

  // 1. Auth & Admin Role Check
  if (!token || !userId) {
    redirect('/login');
  }

  if (userRole !== 'admin') {
    redirect('/');
  }

  // Render Admin client. It will fetch user directory via supabase-js client-side.
  return (
    <AdminClient
      currentUserId={userId}
      currentUserName={userName || 'Admin'}
    />
  );
}
