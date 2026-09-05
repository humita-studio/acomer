/**
 * ¿Supabase Auth puede mandar emails (SMTP propio configurado)?
 *
 * El SMTP de cortesía de Supabase solo entrega a los miembros del proyecto, así
 * que "olvidé mi contraseña" y el invite por email prometían un mail que nunca
 * llegaba. Con el flag apagado (default) esos dos flujos se esconden y la
 * recuperación pasa por el dueño (clave temporal) o por soporte.
 * Prender con `NEXT_PUBLIC_AUTH_EMAIL_HABILITADO=1` recién con SMTP configurado
 * (ver docs/CONFIGURAR.md).
 */
export const AUTH_EMAIL_HABILITADO = process.env.NEXT_PUBLIC_AUTH_EMAIL_HABILITADO === '1';
