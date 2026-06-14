import type { PaymentProvider, PaymentMetadata, PaymentIntentResult, PaymentVerificationResult } from '../core/payment-provider.interface';

/**
 * MockProvider for local testing and development.
 * Simulates a payment provider without external API calls.
 */
export class MockProvider implements PaymentProvider {
  async createPaymentIntent(
    amount: number,
    transactionId: string,
    metadata: PaymentMetadata
  ): Promise<PaymentIntentResult> {
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // For the mock, the payment URL could be a dummy route in our own app
    // or we can just return success directly if we want to simulate a successful API call.
    return {
      success: true,
      paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/mock-checkout?tx=${transactionId}&amount=${amount}`,
      externalReference: `mock_pref_${Math.random().toString(36).substring(7)}`,
    };
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      status: 'Aprobado',
      monto: 0, // Mock doesn't really know the amount here unless we parse the id or fetch from DB
      referenciaExterna: paymentId,
      metadata: { mock: true, verifiedAt: new Date().toISOString() },
    };
  }
}
