import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

/** Token de la cuenta vendedora de acomer (no del local). */
export function getBillingAccessToken(): string | null {
  const t =
    process.env.MP_BILLING_ACCESS_TOKEN?.trim() ||
    process.env.MP_PLATFORM_ACCESS_TOKEN?.trim() ||
    '';
  return t || null;
}

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

/**
 * Crea una preferencia Checkout Pro por 1 mes del plan.
 * external_reference = id del pago_suscripcion (para el webhook).
 */
export async function createBillingPreference(opts: {
  accessToken: string;
  pagoId: string;
  planNombre: string;
  monto: number;
  payerEmail?: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
}): Promise<{ ok: true; initPoint: string; preferenceId: string } | { ok: false; error: string }> {
  try {
    const client = new MercadoPagoConfig({ accessToken: opts.accessToken });
    const preference = new Preference(client);

    const body: Record<string, unknown> = {
      items: [
        {
          id: opts.pagoId,
          title: `acomer · Plan ${opts.planNombre} (1 mes)`,
          description: 'Suscripción mensual a la plataforma acomer',
          quantity: 1,
          unit_price: Number(opts.monto),
          currency_id: 'ARS',
        },
      ],
      external_reference: opts.pagoId,
      back_urls: {
        success: opts.successUrl,
        failure: opts.failureUrl,
        pending: opts.pendingUrl,
      },
      notification_url: opts.notificationUrl,
      statement_descriptor: 'ACOMER',
      metadata: { tipo: 'saas_billing', pagoId: opts.pagoId },
    };

    if (opts.payerEmail) {
      body.payer = { email: opts.payerEmail };
    }
    if (canUseAutoReturn(opts.successUrl)) {
      body.auto_return = 'approved';
    }

    const result = await preference.create({ body: body as never });
    if (!result.init_point || !result.id) {
      return { ok: false, error: 'Mercado Pago no devolvió el link de pago' };
    }
    return {
      ok: true,
      initPoint: result.init_point,
      preferenceId: String(result.id),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear preferencia';
    console.error('[createBillingPreference]', error);
    return { ok: false, error: msg };
  }
}

export async function fetchBillingPayment(
  accessToken: string,
  paymentId: string,
): Promise<{
  status: string;
  externalReference: string | null;
  amount: number;
  raw: unknown;
} | null> {
  try {
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const data = await payment.get({ id: paymentId });
    return {
      status: String(data.status ?? ''),
      externalReference: data.external_reference ? String(data.external_reference) : null,
      amount: Number(data.transaction_amount ?? 0),
      raw: data,
    };
  } catch (error) {
    console.error('[fetchBillingPayment]', error);
    return null;
  }
}
