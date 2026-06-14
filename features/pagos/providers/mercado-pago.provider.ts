import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import type { PaymentProvider, PaymentMetadata, PaymentIntentResult, PaymentVerificationResult } from '../core/payment-provider.interface';

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
            unit_price: Number(amount),
            currency_id: 'ARS',
          }];

      const isLocalhostSubdomain = metadata.successUrl.startsWith('http://') && metadata.successUrl.includes('localhost') && !metadata.successUrl.startsWith('http://localhost');
      
      const body: any = {
        items,
        back_urls: {
          success: metadata.successUrl,
          failure: metadata.failureUrl,
          pending: metadata.pendingUrl,
        },
        external_reference: transactionId, // Fundamental: conectamos MP con nuestra DB
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhooks/pagos/mercado_pago?tenantId=${this.tenantId}`,
      };

      if (!isLocalhostSubdomain) {
        body.auto_return = 'approved';
      }

      console.log('--- MP PREFERENCE BODY ---');
      console.log(JSON.stringify(body, null, 2));
      console.log('--------------------------');

      const result = await preference.create({ body });

      return {
        success: true,
        paymentUrl: result.init_point, // URL para redirigir al comensal
        externalReference: result.id,  // ID de la preferencia
      };
    } catch (error: any) {
      console.error('Error creating MP Preference:', error);
      return {
        success: false,
        error: error.message || 'Error al comunicarse con Mercado Pago',
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
    } catch (error: any) {
      console.error('Error verifying MP Payment:', error);
      throw new Error(`Error validando pago en Mercado Pago: ${error.message}`);
    }
  }
}
