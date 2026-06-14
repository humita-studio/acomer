import { getCurrentSession } from '@/features/auth/session';

export default async function AdminPage() {
  const session = await getCurrentSession();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Bienvenido al Panel de Control</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card: Resumen */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">📊 Resumen</h2>
          <p className="text-gray-600">Estadísticas generales del restaurante</p>
        </div>

        {/* Card: Pedidos Pendientes */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">🛒 Pedidos Pendientes</h2>
          <p className="text-gray-600">Monitorea los pedidos en tiempo real</p>
        </div>

        {/* Card: Empleados */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">👥 Empleados</h2>
          <p className="text-gray-600">Gestiona el equipo del restaurante</p>
        </div>
      </div>

      {/* Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-gray-700">
          <strong>Restaurante:</strong> {session?.nombreRestaurante}
        </p>
        <p className="text-gray-700">
          <strong>Tu rol:</strong> {session?.role}
        </p>
      </div>
    </div>
  );
}
