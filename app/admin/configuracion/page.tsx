import { Suspense } from 'react';
import { getCurrentSession } from '@/features/auth/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/shared/db';
import { guardarConfiguracionPagosAction } from '@/features/pagos/configuracion-actions';
import { isPaymentMockAllowed } from '@/features/pagos/mock-enabled';
import { obtenerLandingConfig } from '@/features/landing/landingConfigActions';
import { LandingConfigForm } from '@/features/landing/components/LandingConfigForm';
import { SubdominioForm } from '@/features/tenant/components/SubdominioForm';
import { NombreLocalForm } from '@/features/tenant/components/NombreLocalForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { SubmitButton } from '@/shared/ui/submit-button';
import { Skeleton } from '@/shared/ui/skeleton';

function ConfigSkeleton() {
    return (
        <div className="flex-1 space-y-6">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-10 w-48" />
            <div className="max-w-2xl space-y-4">
                <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
                    <Skeleton className="h-5 w-32" />
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
    const isMpConnected =
        !!creds.access_token &&
        (config?.proveedor === 'mercado_pago_oauth' || config?.proveedor === 'mercado_pago');
    const allowMock = isPaymentMockAllowed();
    // En prod no mostramos mock; si el local tenía mock, forzamos selector a MP.
    const proveedorDefault =
        config?.proveedor === 'mock' && !allowMock
            ? 'mercado_pago_oauth'
            : config?.proveedor || 'mercado_pago_oauth';

    const MP_CLIENT_ID = process.env.NEXT_PUBLIC_MP_CLIENT_ID;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/pagos/mp-oauth`;

    // MP Connect URL
    const mpConnectUrl = `https://auth.mercadopago.com/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${session.restauranteId}&redirect_uri=${REDIRECT_URI}`;

    return (
        <div className="flex-1 space-y-6">
            <div className="space-y-1">
                <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  Configuración
                </h1>
                <p className="text-sm text-muted-foreground">
                  Landing pública del local y medios de pago.
                </p>
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

                <TabsContent value="pagos" className="outline-none">
                    <div className="max-w-xl space-y-4">
                        <div className="rounded-xl border bg-card p-6 shadow-sm">
                            <h3 className="mb-1 text-lg font-semibold">Mercado Pago</h3>
                            <p className="mb-6 text-sm text-muted-foreground">
                                Vinculá tu cuenta para cobrar online desde la carta, el
                                mostrador y los pedidos. Efectivo y tarjeta siguen
                                disponibles sin configuración.
                            </p>

                            {!isMpConnected ? (
                                <div className="mb-4 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-foreground">
                                    Todavía no hay una cuenta de Mercado Pago vinculada. Sin
                                    eso, los clientes no pueden pagar online.
                                </div>
                            ) : (
                                <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success-subtle p-3 text-sm text-success-foreground">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    Cuenta vinculada correctamente.
                                </div>
                            )}

                            <form action={guardarConfiguracionPagosAction} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="proveedor" className="text-sm font-medium">
                                      Proveedor activo
                                    </label>
                                    <select
                                        id="proveedor"
                                        name="proveedor"
                                        defaultValue={proveedorDefault}
                                        className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                                    >
                                        <option value="mercado_pago_oauth">Mercado Pago (OAuth)</option>
                                        {allowMock ? (
                                            <option value="mock">Simulador (solo desarrollo)</option>
                                        ) : null}
                                    </select>
                                    {allowMock ? (
                                        <p className="text-xs text-muted-foreground">
                                            El simulador solo aparece en desarrollo. No usar en
                                            locales reales.
                                        </p>
                                    ) : null}
                                </div>

                                <SubmitButton className="w-full">
                                    Guardar preferencia
                                </SubmitButton>
                            </form>

                            <div className="mt-6 space-y-3 border-t pt-6">
                                <h4 className="text-sm font-medium">Conexión con Mercado Pago</h4>
                                {!isMpConnected ? (
                                    <a
                                        href={mpConnectUrl}
                                        className="flex h-10 w-full items-center justify-center rounded-md bg-[#009EE3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0088C4]"
                                    >
                                        Vincular cuenta de Mercado Pago
                                    </a>
                                ) : (
                                    <a
                                        href={mpConnectUrl}
                                        className="flex h-10 w-full items-center justify-center rounded-md border border-[#009EE3] px-4 text-sm font-medium text-[#009EE3] transition-colors hover:bg-[#009EE3]/10"
                                    >
                                        Reconectar Mercado Pago
                                    </a>
                                )}
                                <p className="text-center text-xs text-muted-foreground">
                                    Al vincular tu cuenta autorizás a la aplicación a crear pagos en tu nombre.
                                </p>
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
