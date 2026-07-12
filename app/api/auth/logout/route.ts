import { signOut } from '@/features/auth/session';

export async function POST() {
  await signOut();
  return Response.json({ success: true });
}
