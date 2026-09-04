import dns from 'node:dns';
import { createGoogle } from '@ai-sdk/google';

// En entornos Node/Windows sin IPv6 nativo en el router/ISP, evita el timeout de 30s de resolución DNS
if (typeof dns !== 'undefined' && typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    // Ignorar si el runtime no lo soporta
  }
}

/**
 * Obtiene la API Key configurada para Google Gemini.
 * Soporta tanto GEMINI_API_KEY como GOOGLE_GENERATIVE_AI_API_KEY.
 */
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export function isGeminiConfigured(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key.trim().length > 0);
}

/**
 * Instancia del proveedor de Google AI SDK.
 */
export const googleAI = createGoogle({
  apiKey: getGeminiApiKey() || '',
});

/**
 * Modelo de Gemini a utilizar.
 * Por defecto usamos gemini-3.1-flash-lite por su latencia ultra-rápida (sub-2s)
 * y respuesta inmediata en invocación de herramientas, evitando la saturación de 3.8/3.6.
 * Se puede sobreescribir vía GEMINI_MODEL_ID en el archivo .env si se desea.
 */
export const activeModelId = process.env.GEMINI_MODEL_ID || 'gemini-3.1-flash-lite';

export const geminiModel = googleAI(activeModelId);

