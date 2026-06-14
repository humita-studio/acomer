export interface PaymentMetadata {
  restaurantName: string;
  items: Array<{
    title: string;
    description?: string;
    unitPrice: number;
    quantity: number;
  }>;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
}

export interface PaymentIntentResult {
  success: boolean;
  paymentUrl?: string; // URL to redirect the user to (e.g. MP checkout url)
  externalReference?: string; // ID assigned by the provider
  error?: string;
}

export interface PaymentVerificationResult {
  status: 'Aprobado' | 'Pendiente' | 'Rechazado' | 'Cancelado';
  monto: number;
  referenciaExterna: string;
  metadata?: any;
}

export interface PaymentProvider {
  /**
   * Initializes a payment intent and returns the URL to redirect the user
   */
  createPaymentIntent(
    amount: number,
    transactionId: string, // Our internal transaction ID to use as reference
    metadata: PaymentMetadata
  ): Promise<PaymentIntentResult>;

  /**
   * Verifies a payment based on the provider's external reference or our transaction ID
   * Usually called by the webhook
   */
  verifyPayment(externalReference: string): Promise<PaymentVerificationResult>;
}
