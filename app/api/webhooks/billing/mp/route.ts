import { NextRequest, NextResponse } from 'next/server';
import { verifyMercadoPagoSignature } from '@/features/pagos/webhook/verify-mp-signature';
import { fetchBillingPayment, getBillingAccessToken } from '@/features/billing/mpBilling';
import { settleBillingPayment } from '@/features/billing/billingActions';

/**
 * Webhook de cobros SaaS (suscripción acomer).
 * Distinto de /api/webhooks/pagos/* (cobros del local al comensal).
 *
 * Configurar en el panel MP de la app de acomer:
 *   URL: https://acomer.com.ar/api/webhooks/billing/mp
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');

    const body = (await req.json().catch(() => ({}))) as {
      data?: { id?: string | number };
      id?: string | number;
      type?: string;
      action?: string;
    };

    const bodyType = body.type || body.action;
    const isPayment =
      topic === 'payment' ||
      bodyType === 'payment' ||
      String(bodyType || '').includes('payment');

    if (topic && topic !== 'payment' && !isPayment) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const paymentId =
      url.searchParams.get('id') ||
      url.searchParams.get('data.id') ||
      (body.data?.id != null ? String(body.data.id) : null) ||
      (body.id != null ? String(body.id) : null);

    if (!paymentId || !/^\d{1,20}$/.test(paymentId)) {
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 });
    }

    const sig = verifyMercadoPagoSignature({
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId: paymentId,
    });
    if (!sig.ok) {
      console.warn('[webhook/billing] invalid signature:', sig.reason);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const token = getBillingAccessToken();
    if (!token) {
      console.error('[webhook/billing] MP_BILLING_ACCESS_TOKEN missing');
      return NextResponse.json({ error: 'Billing not configured' }, { status: 500 });
    }

    const payment = await fetchBillingPayment(token, paymentId);
    if (!payment?.externalReference) {
      return NextResponse.json({ error: 'Payment not found or no external_reference' }, { status: 404 });
    }

    const result = await settleBillingPayment({
      pagoId: payment.externalReference,
      mpPaymentId: paymentId,
      amount: payment.amount,
      mpStatus: payment.status,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, result: result.message });
  } catch (error) {
    console.error('[webhook/billing]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
