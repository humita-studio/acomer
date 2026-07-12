import { db } from '../../../shared/db/client';
import type { PaymentProvider } from './payment-provider.interface';
import { MercadoPagoProvider } from '../providers/mercado-pago.provider';
import { MockProvider } from '../providers/mock.provider';

export async function getPaymentProvider(restaurantId: string): Promise<PaymentProvider> {
  // Buscar configuración activa para el restaurante
  const config = await db.query.configuracionPagos.findFirst({
    where: (t, { and, eq }) => and(
      eq(t.restauranteId, restaurantId),
      eq(t.activo, true)
    ),
  });

  if (!config) {
    throw new Error(
      'No hay configuración de pagos activa. Vinculá Mercado Pago en Admin → Configuración → Pagos.',
    );
  }

  switch (config.proveedor) {
    case 'mercado_pago':
    case 'mercado_pago_oauth': {
      const creds = config.credenciales as { access_token?: string };
      if (!creds?.access_token) {
        throw new Error(
          'Mercado Pago no tiene access token. Reconectá la cuenta en Admin → Configuración → Pagos.',
        );
      }
      return new MercadoPagoProvider(creds.access_token, restaurantId);
    }
      
    case 'mock':
      return new MockProvider();
      
    default:
      throw new Error(`Proveedor de pagos no soportado: ${config.proveedor}`);
  }
}
