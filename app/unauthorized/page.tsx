import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="bg-card p-8 rounded-lg shadow-md max-w-md text-center">
        <h1 className="text-3xl font-bold mb-4 text-destructive">⛔ Acceso Denegado</h1>
        <p className="text-muted-foreground mb-6">
          No tienes permisos para acceder a esta sección del panel de administración.
        </p>
        <Link
          href="/admin"
          className="inline-block bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition"
        >
          Volver al Panel
        </Link>
      </div>
    </div>
  );
}
