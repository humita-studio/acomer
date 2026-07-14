import { NextRequest, NextResponse } from 'next/server';
import { verifyMercadoPagoSignature } from '@/features/pagos/webhook/verify-mp-signature';
import { processPaymentNotification } from '@/features/pagos/webhook/process-payment-notification';

/**
 * Webhook de pagos (Mercado Pago y mock).
 *
 * Contrato esperado de la notification_url:
 *   /api/webhooks/pagos/mercado_pago?tenantId=<uuid>
 *
 * Seguridad:
 * - tenantId obligatorio (multi-tenant)
 * - firma x-signature si MP_WEBHOOK_SECRET está seteado
 * - liquidación atómica + idempotente en processPaymentNotification
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      console.warn('[webhook/pagos] missing tenantId');
      return NextResponse.json(
        { error: 'tenantId is required in webhook URL' },
        { status: 400 },
      );
    }

    let paymentIdToVerify: string | null = null;
    const topic = searchParams.get('topic') || searchParams.get('type');

    // Body se lee una sola vez.
    const body = (await req.json().catch(() => ({}))) as {
      data?: { id?: string | number };
      id?: string | number;
      type?: string;
      action?: string;
    };

    if (provider === 'mercado_pago') {
      // MP: ?topic=payment&id=…  o  ?type=payment&data.id=…
      // También body: { type: 'payment', data: { id } }
      const bodyType = body.type || body.action;
      const isPayment =
        topic === 'payment' ||
        bodyType === 'payment' ||
        String(bodyType || '').includes('payment');

      if (topic && topic !== 'payment' && !isPayment) {
        return NextResponse.json({ received: true, ignored: true });
      }

      paymentIdToVerify =
        searchParams.get('id') ||
        searchParams.get('data.id') ||
        (body.data?.id != null ? String(body.data.id) : null) ||
        (body.id != null ? String(body.id) : null);

      // Firma (opcional si no hay secret en env).
      const sig = verifyMercadoPagoSignature({
        xSignature: req.headers.get('x-signature'),
        xRequestId: req.headers.get('x-request-id'),
        dataId: paymentIdToVerify || '',
      });
      if (!sig.ok) {
        console.warn('[webhook/pagos] invalid signature:', sig.reason);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      if (sig.skipped) {
        console.warn(
          '[webhook/pagos] MP_WEBHOOK_SECRET not set — signature check skipped',
        );
      }
    } else if (provider === 'mock') {
      paymentIdToVerify =
        searchParams.get('id') ||
        (body.data?.id != null ? String(body.data.id) : null) ||
        (body.id != null ? String(body.id) : null);
    } else {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    if (!paymentIdToVerify) {
      return NextResponse.json({ error: 'No payment ID found' }, { status: 400 });
    }

    const outcome = await processPaymentNotification({
      provider,
      tenantId,
      paymentId: paymentIdToVerify,
    });

    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.httpStatus },
      );
    }

    return NextResponse.json({
      success: true,
      status: outcome.status,
      alreadyProcessed: outcome.alreadyProcessed ?? false,
      settlement: outcome.settlement,
    });
  } catch (error) {
    console.error('[webhook/pagos]', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
