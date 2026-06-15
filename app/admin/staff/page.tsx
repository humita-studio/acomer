'use client';

import { inviteEmployee } from '@/features/auth/invite-employee';
import { useState } from 'react';
import type { RoleType } from '@/features/authorization/roles';

const ROLES: { value: RoleType; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'cajero', label: 'Cajero' },
  { value: 'mozo', label: 'Mozo' },
  { value: 'cocina', label: 'Cocina' },
];

export default function StaffPage() {
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RoleType>('mozo');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setCredenciales(null);
    setCopiado(false);

    const emailInvitado = email.trim().toLowerCase();

    try {
      const result = await inviteEmployee({ email, rol });
      setMessage(result.message);

      if (result.success) {
        if (result.tempPassword) {
          setCredenciales({ email: emailInvitado, password: result.tempPassword });
        }
        setEmail('');
        setRol('mozo');
      }
    } catch (error) {
      setMessage('Error al enviar la invitación');
    } finally {
      setLoading(false);
    }
  };

  const copiarCredenciales = async () => {
    if (!credenciales) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${credenciales.email}\nContraseña: ${credenciales.password}`
      );
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // El portapapeles puede no estar disponible (http o permisos); se ignora.
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Gestión de Empleados</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario de Invitación */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Invitar Empleado</h2>

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email del Empleado
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="empleado@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rol
              </label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as RoleType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Enviando...' : 'Enviar Invitación'}
            </button>

            {message && (
              <div
                className={`p-3 rounded-md ${
                  message.includes('Error') || message.includes('No tienes')
                    ? 'bg-red-50 text-red-700'
                    : 'bg-green-50 text-green-700'
                }`}
              >
                {message}
              </div>
            )}

            {credenciales && (
              <div className="p-4 rounded-md border border-amber-300 bg-amber-50">
                <p className="text-sm font-semibold text-amber-900 mb-2">
                  Contraseña temporal (se muestra una sola vez)
                </p>
                <p className="text-xs text-amber-800 mb-3">
                  Copiala y entregásela al empleado. No se vuelve a mostrar. Que la cambie al ingresar.
                </p>
                <dl className="text-sm space-y-1 mb-3">
                  <div className="flex gap-2">
                    <dt className="text-gray-600 w-24">Email</dt>
                    <dd className="font-mono break-all">{credenciales.email}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-600 w-24">Contraseña</dt>
                    <dd className="font-mono font-bold tracking-wider">{credenciales.password}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={copiarCredenciales}
                  className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-md hover:bg-amber-700 transition"
                >
                  {copiado ? 'Copiado ✓' : 'Copiar credenciales'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Lista de Empleados */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Empleados Activos</h2>
          <p className="text-gray-600 text-sm">La lista de empleados se mostrará aquí...</p>
        </div>
      </div>
    </div>
  );
}
