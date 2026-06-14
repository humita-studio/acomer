import { signOut } from '@/features/auth/session';
import { redirect } from 'next/navigation';

export async function POST() {
  await signOut();
  return Response.json({ success: true });
}
