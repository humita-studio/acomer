import { Suspense } from 'react';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/shared/db';
import { guardarConfiguracionPagosAction } from '@/features/pagos/configuracion-actions';
import { obtenerLandingConfig } from '@/features/landing/landingConfigActions';
import { LandingConfigForm } from '@/features/landing/components/LandingConfigForm';
import { SubdominioForm } from '@/features/tenant/components/SubdominioForm';
import { NombreLocalForm } from '@/features/tenant/components/NombreLocalForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { SubmitButton } from '@/shared/ui/submit-button';
import { Skeleton } from '@/shared/ui/skeleton';

function ConfigSkeleton() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-10 w-48" />
            <div className="max-w-2xl space-y-4">
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                </div>
            </div>
        </div>
    );
}

async function ConfigContent() {
    const session = await getCurrentSession();

    if (!session || (session.role !== 'owner' && session.role !== 'admin')) {
        redirect('/unauthorized');
    }

    // Cargar configuración actual — paralelizado para evitar waterfalls secuenciales
    const [config, landing, headersList, restaurante] = await Promise.all([
        db.query.configuracionPagos.findFirst({
            where: (t, { eq }) => eq(t.restauranteId, session.restauranteId)
        }),
        obtenerLandingConfig(session.restauranteId),
        headers(),
        db.query.restaurantes.findFirst({
            where: (t, { eq }) => eq(t.id, session.restauranteId),
            columns: { nombre: true, slug: true }
        }),
    ]);

    // Dominio base para mostrar el subdominio del local (ej. "acomer.com.ar" o
    // "localhost:3000" en dev). El admin se sirve en el dominio principal/app.
    const host = headersList.get('host') || '';
    const dominioBase = host.replace(/^app\./, '') || 'acomer.com.ar';

    const creds = (config?.credenciales ?? {}) as { access_token?: string };
    const isMpConnected = !!creds.access_token && config?.proveedor === 'mercado_pago_oauth';

    const MP_CLIENT_ID = process.env.NEXT_PUBLIC_MP_CLIENT_ID;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/pagos/mp-oauth`;

    // MP Connect URL
    const mpConnectUrl = `https://auth.mercadopago.com/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${session.restauranteId}&redirect_uri=${REDIRECT_URI}`;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Configuración del Restaurante</h2>
            </div>

            <Tabs defaultValue="landing" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="landing">Landing</TabsTrigger>
                    <TabsTrigger value="pagos">Pagos</TabsTrigger>
                </TabsList>

                <TabsContent value="landing" className="space-y-4 outline-none">
                    <LandingConfigForm 
                        initial={landing}
                        identidadSuperior={
                            <>
                                <NombreLocalForm nombreActual={restaurante?.nombre || session.nombreRestaurante || ''} />
                                <SubdominioForm slugActual={session.slugRestaurante} dominioBase={dominioBase} />
                            </>
                        } 
                    />
                </TabsContent>

                <TabsContent value="pagos">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <div className="col-span-4 space-y-4">
                            <div className="rounded-xl border bg-card p-6 shadow-sm">
                                <h3 className="text-xl font-semibold mb-4">Pasarela de Pagos</h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                    Configura cómo tus clientes pagarán desde la Carta Digital. Por defecto, puedes usar Mercado Pago o nuestro entorno de simulación (Mock).
                                </p>

                                <form action={guardarConfiguracionPagosAction} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Proveedor Activo</label>
                                        <select
                                            name="proveedor"
                                            defaultValue={config?.proveedor || 'mercado_pago_oauth'}
                                            className="w-full p-2 border rounded-md bg-background"
                                        >
                                            <option value="mercado_pago_oauth">Mercado Pago (Conexión Automática)</option>
                                            <option value="mock">Simulador (Modo Pruebas)</option>
                                        </select>
                                    </div>

                                    {isMpConnected && (
                                        <div className="p-3 bg-success-subtle border border-success/30 rounded-md text-success-foreground text-sm flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                            Cuenta de Mercado Pago vinculada correctamente.
                                        </div>
                                    )}

                                    <div className="pt-4 flex flex-col gap-3">
                                        <SubmitButton className="w-full">
                                            Guardar Preferencia
                                        </SubmitButton>
                                    </div>
                                </form>

                                <div className="mt-6 pt-6 border-t">
                                    <h4 className="text-sm font-medium mb-3">Conexión con Mercado Pago</h4>
                                    {!isMpConnected ? (
                                        <a
                                            href={mpConnectUrl}
                                            className="block w-full text-center bg-[#009EE3] hover:bg-[#0088C4] text-white p-2 rounded-md transition-colors font-medium"
                                        >
                                            Vincular cuenta de Mercado Pago!
                                        </a>
                                    ) : (
                                        <a
                                            href={mpConnectUrl}
                                            className="block w-full text-center border border-[#009EE3] text-[#009EE3] hover:bg-accent p-2 rounded-md transition-colors font-medium"
                                        >
                                            Reconectar Mercado Pago
                                        </a>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                        Al vincular tu cuenta autorizas a la aplicación a crear pagos en tu nombre.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function ConfiguracionPage() {
    return (
        <Suspense fallback={<ConfigSkeleton />}>
            <ConfigContent />
        </Suspense>
    );
}
