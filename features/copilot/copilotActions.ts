'use server';

import { generateText, stepCountIs } from 'ai';
import { getCurrentSession } from '@/features/auth/session';
import { geminiModel, isGeminiConfigured } from '@/shared/ai/gemini';
import { createCopilotTools } from './copilotTools';

export type MensajeChat = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  herramientasUsadas?: string[];
  createdAt?: string;
};

export type RespuestaCopilot =
  | {
      success: true;
      mensaje: MensajeChat;
    }
  | {
      success: false;
      error: string;
    };

export async function enviarMensajeCopilotAction(
  historial: Array<{ role: 'user' | 'assistant'; content: string }>,
  nuevoTexto: string,
): Promise<RespuestaCopilot> {
  const session = await getCurrentSession();
  if (!session) {
    return {
      success: false,
      error: 'Sesión no iniciada o vencida. Por favor recargá la página.',
    };
  }

  if (!isGeminiConfigured()) {
    return {
      success: false,
      error:
        'No se configuró la API Key de Google Gemini (GEMINI_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY). Agregala a las variables de entorno para habilitar el Copiloto.',
    };
  }

  const promptTrimmed = nuevoTexto.trim();
  if (!promptTrimmed) {
    return {
      success: false,
      error: 'El mensaje no puede estar vacío.',
    };
  }

  try {
    const tools = createCopilotTools(session);

    const systemPrompt = `
Sos el Copiloto Operativo Inteligente de ACOMER para el restaurante "${session.nombreRestaurante}".
Tu rol es asistir al dueño, encargado o personal del local en la operación diaria gastronómica.

Tenés a tu disposición herramientas que consultan y modifican la base de datos en tiempo real:
- consultarMetricasDelDia: ventas totales, cantidad de pedidos y canales (salón vs delivery).
- consultarEstadoSalon: mesas ocupadas, libres, minutos que llevan sentados y comensales.
- consultarEstadoCaja: si la caja está abierta, fondo inicial, recaudación en efectivo y saldo esperado en mano.
- consultarPlatosMasVendidos: ranking de los platos con más salida de los últimos 7 días.
- pausarOActivarPlato: pausar un plato por falta de stock o reactivarlo cuando vuelve a haber insumos.
- buscarPlatosEnCarta: buscar precios y disponibilidad de platos específicos.

Reglas de respuesta:
1. Hablá en español rioplatense o neutro, con tono profesional, ágil, conciso y directo al grano (los gastronómicos están trabajando a las corridas).
2. Formateá los números monetarios con signo pesos y separador de miles si corresponde (ej: $14.500).
3. Si el usuario te pide un dato operativo (ventas, mesas, caja, platos), EJECUTÁ la herramienta correspondiente de inmediato. No adivines ni inventes datos.
4. Cuando sea útil sugerir navegar a una sección del sistema, incluí un link en markdown como:
   - [Ver Salón de Mesas](/admin/mesas)
   - [Ver Monitor de Cocina](/admin/cocina)
   - [Ver Arqueo de Caja](/admin/caja)
   - [Ver Reportes de Ventas](/admin/reportes)
   - [Ver Carta Digital](/admin/carta)
   - [Ver Configuración del Local](/admin/configuracion)
5. Si ejecutás una acción (ej: pausar un plato), confirmá con claridad el nombre del plato y el resultado exacto.
`;

    // Armamos historial acotado a los últimos 8 mensajes para contexto limpio
    const mensajesFormateados = [
      ...historial.slice(-8).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: promptTrimmed },
    ];

    const result = await generateText({
      model: geminiModel,
      system: systemPrompt,
      messages: mensajesFormateados,
      tools,
      stopWhen: stepCountIs(5),
    });

    // Detectar qué herramientas fueron llamadas
    const herramientasInvocadas = result.steps
      ? result.steps
          .flatMap((s) => s.toolCalls || [])
          .map((tc) => tc.toolName)
          .filter((v, i, a) => a.indexOf(v) === i)
      : [];

    const nuevoMensaje: MensajeChat = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant',
      content: result.text,
      herramientasUsadas: herramientasInvocadas,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      mensaje: nuevoMensaje,
    };
  } catch (err: unknown) {
    console.error('Error en Copilot:', err);
    const msg = err instanceof Error ? err.message : 'Error al procesar consulta';
    return {
      success: false,
      error: `Error al consultar con el Copiloto: ${msg}`,
    };
  }
}
