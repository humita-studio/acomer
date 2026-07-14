/**
 * El proveedor mock de pagos solo se permite en desarrollo o con flag explícito.
 * En producción real no debe aparecer en la UI ni liquidar cobros simulados.
 */
export function isPaymentMockAllowed(): boolean {
  if (process.env.ALLOW_PAYMENT_MOCK === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}
