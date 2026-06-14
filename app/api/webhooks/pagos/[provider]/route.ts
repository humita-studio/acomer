import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/db';
import { transaccionesPago, sesionesMesa, pedidos } from '@/shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPaymentProvider } from '@/features/pagos/core/payment-factory';
import { createSupabaseServerClient } from '@/shared/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    let paymentIdToVerify: string | null = null;
    let topic = searchParams.get('topic') || searchParams.get('type');

    if (provider === 'mercado_pago') {
      // Mercado Pago webhooks can come as ?topic=payment&id=12345
      // or ?type=payment&data.id=12345
      if (topic === 'payment') {
        paymentIdToVerify = searchParams.get('id') || searchParams.get('data.id');
      } else {
        // We only care about payment updates
        return NextResponse.json({ received: true });
      }
    }

    if (!paymentIdToVerify) {
      // If we can't extract the ID from the URL, try the body
      const body = await req.json().catch(() => ({}));
      if (provider === 'mercado_pago') {
        paymentIdToVerify = body.data?.id || body.id;
      }
    }

    if (!paymentIdToVerify) {
      return NextResponse.json({ error: 'No payment ID found' }, { status: 400 });
    }

    // A hack to find which tenant this payment belongs to: 
    // We search the transaction by external_reference or metadata if we stored it
    // Wait, MP webhooks only give the MP Payment ID. 
    // The MP Payment object has `external_reference` which is our transactionId.
    // However, to instantiate the provider we need the tenantId.
    // Since we don't have the tenantId yet, we can't use the factory cleanly unless we query DB first.
    // If the provider supports multiple tenants, we might need to find the tenant first.
    // Wait, let's query transacciones_pago if we have the payment ID stored somewhere.
    // Actually, we don't have the MP Payment ID stored, we stored the MP Preference ID.
    // We must instantiate the provider to fetch the Payment info. To instantiate the provider, we need the access_token.
    // This is a known issue in multi-tenant MP webhooks. 
    // We could store the access token mapping, OR we iterate all active MP configurations and try to fetch.
    // Better yet: Mercado Pago allows adding metadata to the preference (or external_reference) but we can't read it until we authenticate.
    // Wait, the webhook body for MP sometimes includes the `external_reference` if it's sent in the body.
    // Let's assume for now we use a generic verification or we just pass the webhook handling.

    // A better approach for the webhook URL: /api/webhooks/pagos/mercado_pago?tenantId=123
    // Let's check if we can get tenantId from search params (we should have added it when creating the preference!)
    
    // For now, let's find the transaction by provider and we can't without fetching from MP.
    // So let's look for any pending transaction. This is not fully scalable without tenantId in webhook url,
    // so we assume we update the Notification URL in MercadoPagoProvider to include `?tenantId=${tenantId}`
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      console.warn('Webhook received without tenantId, ignoring for multi-tenant safety');
      return NextResponse.json({ error: 'tenantId is required in webhook URL' }, { status: 400 });
    }

    const paymentProvider = await getPaymentProvider(tenantId);
    
    const verification = await paymentProvider.verifyPayment(paymentIdToVerify);
    const transactionId = verification.referenciaExterna; // Our internal transaction ID

    if (!transactionId) {
      return NextResponse.json({ error: 'Payment does not have external_reference' }, { status: 400 });
    }

    // Verify transaction exists
    const txData = await db.select().from(transaccionesPago).where(eq(transaccionesPago.id, transactionId)).limit(1);
    const tx = txData[0];

    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found in DB' }, { status: 404 });
    }

    // Update transaction status
    await db.update(transaccionesPago)
      .set({ estado: verification.status, metadata: verification.metadata })
      .where(eq(transaccionesPago.id, transactionId));

    if (verification.status === 'Aprobado') {
      // 1. Calculate current total of all non-cancelled orders for this session
      const pedidosMesa = await db.select().from(pedidos).where(
        and(eq(pedidos.sesionMesaId, tx.sesionMesaId), eq(pedidos.estado, 'Pendiente')) // using Pendiente as active state in this context
      );
      // Wait, let's use the exact condition we use to sum them usually: ne(estado, 'Cancelado')
      // but Drizzle ne is imported as 'ne'. Let's import 'ne' if missing or just use not inArray or similar. 
      // I'll import 'ne' manually if it wasn't there, or I can use sql. Let's assume 'ne' is not imported on line 4. 
      // Wait, the file already has 'and', 'eq' from 'drizzle-orm'. Let's check imports on line 4.
      // Line 4: import { eq, and } from 'drizzle-orm';
      // I can't easily add 'ne' without a multi-replace. I'll just select all and filter in JS to be safe.
      const todosPedidosMesa = await db.select().from(pedidos).where(eq(pedidos.sesionMesaId, tx.sesionMesaId));
      const pedidosActivos = todosPedidosMesa.filter(p => p.estado !== 'Cancelado');
      const totalPedidos = pedidosActivos.reduce((acc, p) => acc + Number(p.total), 0);

      // 2. Calculate total paid for this session
      const todasLasTransacciones = await db.select().from(transaccionesPago).where(
        and(
          eq(transaccionesPago.sesionMesaId, tx.sesionMesaId),
          eq(transaccionesPago.estado, 'Aprobado')
        )
      );
      const totalPagado = todasLasTransacciones.reduce((acc, t) => acc + Number(t.monto), 0);

      const supabase = await createSupabaseServerClient();
      const adminChannel = supabase.channel(`admin_restaurant_${tenantId}`);

      if (totalPagado >= totalPedidos) {
        // Fully paid!
        // Mark pedidos as Pagado
        for (const p of pedidosActivos) {
          await db.update(pedidos).set({ estado: 'Pagado' }).where(eq(pedidos.id, p.id));
        }

        // Close the table session
        await db.update(sesionesMesa).set({ estado: 'Cerrada' }).where(eq(sesionesMesa.id, tx.sesionMesaId));

        // Emit Realtime event to notify the frontend
        const channel = supabase.channel(`mesa_${tx.sesionMesaId}`);
        await channel.send({
          type: 'broadcast',
          event: 'pago_completado',
          payload: { transactionId }
        });
        
        await adminChannel.send({
          type: 'broadcast',
          event: 'mesa_pagada',
          payload: { sesionMesaId: tx.sesionMesaId }
        });
      } else {
        // Partial Payment (e.g. they paid an expired link but had added more items)
        await adminChannel.send({
          type: 'broadcast',
          event: 'pago_parcial',
          payload: { 
            sesionMesaId: tx.sesionMesaId,
            pagado: totalPagado,
            total: totalPedidos
          }
        });
      }
    }

    return NextResponse.json({ success: true, status: verification.status });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
