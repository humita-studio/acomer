'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { getCurrentSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';
import { geminiModel, isGeminiConfigured } from '@/shared/ai/gemini';

export type ProductoDetectado = {
  nombre: string;
  descripcion?: string;
  categoria: string;
  precio: number;
  disponible: boolean;
};

export type EscaneoMenuResult =
  | {
      success: true;
      categorias: string[];
      productos: ProductoDetectado[];
    }
  | {
      success: false;
      message: string;
    };

const MenuExtractionSchema = z.object({
  categorias: z
    .array(z.string())
    .describe('Lista de categorías o secciones identificadas en la carta (ej: Entradas, Pastas, Carnes, Bebidas, Postres).'),
  productos: z.array(
    z.object({
      nombre: z.string().describe('Nombre del plato, bebida o ítem.'),
      descripcion: z
        .string()
        .optional()
        .describe('Ingredientes, guarnición o descripción del plato si figura en la carta.'),
      categoria: z
        .string()
        .describe('Categoría a la que pertenece este ítem (debe coincidir con una de las categorías detectadas).'),
      precio: z
        .number()
        .describe('Precio en número entero o decimal. Si los precios tienen puntos como miles (ej: 4.500), convertilo a número 4500. Si no tiene precio visible, colocá 0.'),
      disponible: z.boolean().default(true),
    }),
  ),
});

/**
 * Analiza una imagen o PDF de una carta/menú gastronómico usando Gemini 3.8 Flash
 * y extrae de forma estructurada todas las categorías y productos detectados.
 */
export async function escanearMenuConIaAction({
  dataBase64,
  mimeType,
}: {
  dataBase64: string;
  mimeType: string;
}): Promise<EscaneoMenuResult> {
  const session = await getCurrentSession();
  if (!session || !hasPermission(session.role, 'canManageMenu')) {
    return {
      success: false,
      message: 'No tenés permiso para gestionar el menú.',
    };
  }

  if (!isGeminiConfigured()) {
    return {
      success: false,
      message:
        'No se encontró la variable GEMINI_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY configurada. Por favor agregala en tu archivo de entorno para utilizar el escaneo con IA.',
    };
  }

  if (!dataBase64) {
    return {
      success: false,
      message: 'No se envió ningún archivo para analizar.',
    };
  }

  try {
    // Normalizar base64 quitando data URL prefix si existe
    const cleanBase64 = dataBase64.replace(/^data:[^;]+;base64,/, '');

    const promptText = `
Sos un especialista en digitalización de cartas y menús para locales gastronómicos (restaurantes, bares, pizzerías, cafeterías).
Tu tarea es leer minuciosamente el archivo adjunto (que puede ser una foto de carta en papel, pizarrón, folleto o PDF) y digitalizar todo el menú.

Reglas de extracción:
1. Agrupá los productos por categorías naturales (ej: "Entradas", "Pizzas", "Pastas", "Carnes & Parrilla", "Hamburguesas", "Bebidas", "Cervezas", "Tragos", "Postres").
2. Si un plato tiene ingredientes o descripción escrita abajo, incluila en el campo "descripcion".
3. Precios:
   - Convertí siempre a número simple. Ej: "$ 3.500" o "3500.-" -> 3500.
   - Si un plato tiene opciones de tamaño (ej: "Chica: 3000 / Grande: 5000"), creá dos productos separados (ej: "Pizza Muzzarella (Chica)" y "Pizza Muzzarella (Grande)").
4. Corregí errores tipográficos obvios causados por letra manuscrita o mala iluminación, manteniendo fidelidad al menú real.
5. Devolvé todos los platos encontrados sin omitir ninguno.
`;

    const isPdf = mimeType === 'application/pdf';

    const result = await generateObject({
      model: geminiModel,
      schema: MenuExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            isPdf
              ? {
                  type: 'file',
                  data: cleanBase64,
                  mediaType: 'application/pdf',
                }
              : {
                  type: 'image',
                  image: cleanBase64,
                },
          ],
        },
      ],
    });

    const parsed = result.object;

    if (!parsed.productos || parsed.productos.length === 0) {
      return {
        success: false,
        message: 'No se detectaron productos legibles en la imagen. Verificá que la carta esté bien iluminada y enfocada.',
      };
    }

    return {
      success: true,
      categorias: parsed.categorias,
      productos: parsed.productos,
    };
  } catch (err: unknown) {
    console.error('Error al escanear menú con Gemini:', err);
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return {
      success: false,
      message: `Error al procesar la imagen con Gemini: ${msg}`,
    };
  }
}
