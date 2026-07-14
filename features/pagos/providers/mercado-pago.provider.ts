import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import type { PaymentProvider, PaymentMetadata, PaymentIntentResult, PaymentVerificationResult } from '../core/payment-provider.interface';

/** Mercado Pago exige HTTPS público para auto_return; localhost/http lo rechaza con 400. */
function canUseAutoReturn(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function formatMpError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error.message : 'Error al comunicarse con Mercado Pago';
  }
  const e = error as {
    message?: string;
    cause?: unknown;
    error?: string;
    status?: number;
  };
  // El SDK a veces mete el body de la API en `cause` o anidado.
  const cause = e.cause;
  if (cause && typeof cause === 'object') {
    const c = cause as { message?: string; error?: string; status?: number };
    if (c.message) {
      return `Mercado Pago: ${c.message}${c.error ? ` (${c.error})` : ''}`;
    }
  }
  if (typeof cause === 'string' && cause.trim()) return `Mercado Pago: ${cause}`;
  if (e.message) return e.message;
  return 'Error al comunicarse con Mercado Pago';
}

export class MercadoPagoProvider implements PaymentProvider {
  private client: MercadoPagoConfig;

  constructor(private accessToken: string, private tenantId: string) {
    // Configura el cliente de Mercado Pago con el token del restaurante (tenant)
    this.client = new MercadoPagoConfig({ accessToken: this.accessToken });
  }

  async createPaymentIntent(
    amount: number,
    transactionId: string,
    metadata: PaymentMetadata
  ): Promise<PaymentIntentResult> {
    try {
      const monto = Number(amount);
      if (!Number.isFinite(monto) || monto <= 0) {
        return {
          success: false,
          error: 'El monto a cobrar debe ser mayor a 0',
        };
      }

      const preference = new Preference(this.client);

      const items = metadata.items.length > 0 
        ? metadata.items.map((item) => ({
            id: item.title,
            title: item.title,
            description: item.description || '',
            quantity: item.quantity,
            unit_price: Number(item.unitPrice),
            currency_id: 'ARS',
          }))
        : [{
            id: 'mesa_total',
            title: `Consumo en ${metadata.restaurantName}`,
            description: 'Pago por el total de la mesa',
            quantity: 1,
            unit_price: monto,
            currency_id: 'ARS',
          }];

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      const body = {
        items,
        back_urls: {
          success: metadata.successUrl,
          failure: metadata.failureUrl,
          pending: metadata.pendingUrl,
        },
        external_reference: transactionId, // Fundamental: conectamos MP con nuestra DB
        ...(appUrl
          ? {
              notification_url: `${appUrl}/api/webhooks/pagos/mercado_pago?tenantId=${this.tenantId}`,
            }
          : {}),
        // auto_return solo con HTTPS público (MP lo rechaza en http/localhost).
        ...(canUseAutoReturn(metadata.successUrl)
          ? { auto_return: 'approved' as const }
          : {}),
      };

      const result = await preference.create({ body });

      if (!result.init_point) {
        return {
          success: false,
          error: 'Mercado Pago no devolvió el link de pago',
        };
      }

      return {
        success: true,
        paymentUrl: result.init_point, // URL para redirigir al comensal
        externalReference: result.id,  // ID de la preferencia
      };
    } catch (error) {
      console.error('Error creating MP Preference:', error);
      return {
        success: false,
        error: formatMpError(error),
      };
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    try {
      const payment = new Payment(this.client);
      const paymentData = await payment.get({ id: paymentId });

      let status: PaymentVerificationResult['status'] = 'Pendiente';
      
      switch (paymentData.status) {
        case 'approved':
          status = 'Aprobado';
          break;
        case 'rejected':
          status = 'Rechazado';
          break;
        case 'cancelled':
          status = 'Cancelado';
          break;
        case 'in_process':
        case 'pending':
          status = 'Pendiente';
          break;
        default:
          status = 'Pendiente';
      }

      return {
        status,
        monto: Number(paymentData.transaction_amount || 0),
        referenciaExterna: paymentData.external_reference || '',
        metadata: paymentData,
      };
    } catch (error) {
      console.error('Error verifying MP Payment:', error);
      const detalle = error instanceof Error ? error.message : String(error);
      throw new Error(`Error validando pago en Mercado Pago: ${detalle}`);
    }
  }
}
