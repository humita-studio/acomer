'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="mt-2 w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
    >
      Cerrar sesión
    </button>
  );
}
