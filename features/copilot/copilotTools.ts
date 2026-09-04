import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { tool, asSchema } from 'ai';
import { z } from 'zod';
import {
  categorias,
  comandaItems,
  datosEntrega,
  mesas,
  movimientosCaja,
  pedidos,
  perfilesEmpleados,
  productos,
  productosPrecios,
  promociones,
  resenasClientes,
  reservas,
  sesionesCaja,
  sesionesMesa,
  transaccionesPago,
} from '@/shared/db/schema';
import { withTenant } from '@/shared/db/secure-wrapper';
import { claimsFromSession, type AuthSession } from '@/features/auth/session';
import { hasPermission } from '@/features/authorization/roles';

// Día operativo en horario de Buenos Aires (igual que dashboard y KDS)
const INICIO_HOY = sql`(date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')) AT TIME ZONE 'America/Argentina/Buenos_Aires'`;
const FIN_HOY = sql`${INICIO_HOY} + interval '1 day'`;

/**
 * Crea las herramientas (Tools) para que el Copiloto de IA opere
 * sobre el restaurante de forma integral y segura utilizando withTenant.
 */
export function createCopilotTools(session: AuthSession) {
  const claims = claimsFromSession(session);
  const tenantId = session.restauranteId;

  return {
    consultarMetricasDelDia: tool({
      description:
        'Consulta las métricas de ventas y pedidos del restaurante para el día de hoy o la semana actual.',
      inputSchema: asSchema(
        z.object({
          periodo: z
            .enum(['hoy', 'semana'])
            .default('hoy')
            .describe('Período a consultar: hoy o semana'),
        }),
      ),
      execute: async ({ periodo }: { periodo: 'hoy' | 'semana' }) => {
        return await withTenant(claims, async (db) => {
          const intervalo = periodo === 'hoy' ? '1 day' : '7 days';

          // Consultas concurrentes en paralelo
          const [[ventasRes], pedidosRes] = await Promise.all([
            db
              .select({
                total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
                cantidad: sql<number>`count(${transaccionesPago.id})::int`,
              })
              .from(transaccionesPago)
              .where(
                and(
                  eq(transaccionesPago.restauranteId, tenantId),
                  eq(transaccionesPago.estado, 'Aprobado'),
                  sql`${transaccionesPago.createdAt} >= now() - ${sql.raw(`interval '${intervalo}'`)}`,
                ),
              ),
            db
              .select({
                tipo: sesionesMesa.tipo,
                cantidad: sql<number>`count(${pedidos.id})::int`,
              })
              .from(pedidos)
              .innerJoin(sesionesMesa, eq(pedidos.sesionMesaId, sesionesMesa.id))
              .where(
                and(
                  eq(pedidos.restauranteId, tenantId),
                  sql`${pedidos.createdAt} >= now() - ${sql.raw(`interval '${intervalo}'`)}`,
                ),
              )
              .groupBy(sesionesMesa.tipo),
          ]);

          const total = Number(ventasRes?.total || 0);
          const cantidadCobros = Number(ventasRes?.cantidad || 0);
          const ticketPromedio = cantidadCobros > 0 ? Math.round(total / cantidadCobros) : 0;

          const canales: Record<string, number> = {};
          let totalPedidos = 0;
          for (const p of pedidosRes) {
            canales[p.tipo] = p.cantidad;
            totalPedidos += p.cantidad;
          }

          return {
            periodo,
            totalFacturado: total,
            cantidadCobros,
            ticketPromedio,
            totalPedidos,
            desglosePorCanal: canales,
          };
        });
      },
    }),

    consultarEstadoSalon: tool({
      description:
        'Consulta el estado actual de las mesas del salón: ocupadas, libres, tiempo transcurrido y comensales.',
      inputSchema: asSchema(z.object({})),
      execute: async () => {
        return await withTenant(claims, async (db) => {
          // Consultas concurrentes de mesas y sesiones
          const [todasMesas, sesionesActivas] = await Promise.all([
            db
              .select({
                id: mesas.id,
                identificador: mesas.identificador,
                capacidad: mesas.capacidad,
              })
              .from(mesas)
              .where(and(eq(mesas.restauranteId, tenantId), isNull(mesas.deletedAt))),
            db
              .select({
                mesaId: sesionesMesa.mesaId,
                createdAt: sesionesMesa.createdAt,
              })
              .from(sesionesMesa)
              .where(
                and(
                  eq(sesionesMesa.restauranteId, tenantId),
                  eq(sesionesMesa.estado, 'Activa'),
                  eq(sesionesMesa.tipo, 'salon'),
                ),
              ),
          ]);

          const mapaSesiones = new Map(sesionesActivas.map((s) => [s.mesaId, s]));
          const ahora = Date.now();

          const detalleMesas = todasMesas.map((m) => {
            const sesion = mapaSesiones.get(m.id);
            const ocupada = Boolean(sesion);
            const minutosOcupada = sesion
              ? Math.round((ahora - new Date(sesion.createdAt).getTime()) / 60000)
              : 0;

            return {
              mesa: m.identificador,
              capacidad: m.capacidad,
              estado: ocupada ? 'Ocupada' : 'Libre',
              minutosOcupada: ocupada ? minutosOcupada : undefined,
            };
          });

          const ocupadasCount = detalleMesas.filter((m) => m.estado === 'Ocupada').length;

          return {
            totalMesas: todasMesas.length,
            ocupadas: ocupadasCount,
            libres: todasMesas.length - ocupadasCount,
            porcentajeOcupacion:
              todasMesas.length > 0 ? Math.round((ocupadasCount / todasMesas.length) * 100) : 0,
            mesas: detalleMesas,
          };
        });
      },
    }),

    consultarEstadoCaja: tool({
      description:
        'Consulta si la caja registradora está abierta, el saldo inicial y el dinero esperado en mano.',
      inputSchema: asSchema(z.object({})),
      execute: async () => {
        return await withTenant(claims, async (db) => {
          const [cajaAbierta] = await db
            .select()
            .from(sesionesCaja)
            .where(and(eq(sesionesCaja.restauranteId, tenantId), eq(sesionesCaja.estado, 'Abierta')))
            .orderBy(desc(sesionesCaja.abiertaAt))
            .limit(1);

          if (!cajaAbierta) {
            return {
              cajaAbierta: false,
              mensaje: 'La caja se encuentra cerrada actualmente.',
            };
          }

          // Movimientos de la sesión
          const movimientos = await db
            .select({
              tipo: movimientosCaja.tipo,
              monto: movimientosCaja.monto,
            })
            .from(movimientosCaja)
            .where(eq(movimientosCaja.sesionCajaId, cajaAbierta.id));

          let ingresos = 0;
          let egresos = 0;
          for (const mov of movimientos) {
            const m = Number(mov.monto);
            if (mov.tipo === 'ingreso') ingresos += m;
            if (mov.tipo === 'egreso' || mov.tipo === 'retiro') egresos += m;
          }

          // Cobros en efectivo de esta caja
          const [cobrosEfvo] = await db
            .select({
              total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
            })
            .from(transaccionesPago)
            .where(
              and(
                eq(transaccionesPago.sesionCajaId, cajaAbierta.id),
                eq(transaccionesPago.proveedor, 'efectivo'),
                eq(transaccionesPago.estado, 'Aprobado'),
              ),
            );

          const efectivoVentas = Number(cobrosEfvo?.total || 0);
          const montoInicial = Number(cajaAbierta.montoInicial || 0);
          const esperadoEnCaja = montoInicial + efectivoVentas + ingresos - egresos;

          return {
            cajaAbierta: true,
            abiertaAt: cajaAbierta.abiertaAt,
            montoInicial,
            ventasEfectivo: efectivoVentas,
            ingresosManuales: ingresos,
            egresosORetiros: egresos,
            totalEsperadoEnEfectivo: esperadoEnCaja,
          };
        });
      },
    }),

    consultarPlatosMasVendidos: tool({
      description: 'Obtiene los platos más vendidos del restaurante en los últimos 7 días.',
      inputSchema: asSchema(
        z.object({
          limite: z.number().default(5).describe('Cantidad máxima de platos a devolver'),
        }),
      ),
      execute: async ({ limite }: { limite: number }) => {
        return await withTenant(claims, async (db) => {
          const ranking = await db
            .select({
              nombre: comandaItems.nombreProductoSnapshot,
              cantidadTotal: sql<number>`sum(${comandaItems.cantidad})::int`,
            })
            .from(comandaItems)
            .where(
              and(
                eq(comandaItems.restauranteId, tenantId),
                sql`${comandaItems.createdAt} >= now() - interval '7 days'`,
              ),
            )
            .groupBy(comandaItems.nombreProductoSnapshot)
            .orderBy(sql`sum(${comandaItems.cantidad}) desc`)
            .limit(limite);

          return {
            platosMasVendidos: ranking,
          };
        });
      },
    }),

    pausarOActivarPlato: tool({
      description:
        'Pausa (oculta por falta de stock) o activa (reactiva) un plato o producto de la carta.',
      inputSchema: asSchema(
        z.object({
          nombrePlato: z.string().describe('Nombre del plato a pausar o reactivar'),
          accion: z.enum(['pausar', 'activar']).describe('Acción a realizar'),
        }),
      ),
      execute: async ({
        nombrePlato,
        accion,
      }: {
        nombrePlato: string;
        accion: 'pausar' | 'activar';
      }) => {
        return await withTenant(claims, async (db) => {
          const matches = await db
            .select({
              id: productos.id,
              nombre: productos.nombre,
              activo: productos.activo,
            })
            .from(productos)
            .where(
              and(
                eq(productos.restauranteId, tenantId),
                isNull(productos.deletedAt),
                ilike(productos.nombre, `%${nombrePlato.trim()}%`),
              ),
            )
            .limit(5);

          if (matches.length === 0) {
            return {
              exito: false,
              mensaje: `No encontré ningún plato con el nombre "${nombrePlato}". Verificá la ortografía o consultá la carta.`,
            };
          }

          const plato = matches[0];
          const nuevoEstado = accion === 'activar';

          await db
            .update(productos)
            .set({ activo: nuevoEstado })
            .where(and(eq(productos.id, plato.id), eq(productos.restauranteId, tenantId)));

          return {
            exito: true,
            platoId: plato.id,
            nombreReal: plato.nombre,
            nuevoEstado: nuevoEstado ? 'Activo (Disponible)' : 'Pausado (Agotado)',
            mensaje: `El plato "${plato.nombre}" fue ${
              nuevoEstado ? 'activado y ya está disponible' : 'pausado por falta de stock'
            } en salón y delivery.`,
          };
        });
      },
    }),

    buscarPlatosEnCarta: tool({
      description: 'Busca productos en la carta con su precio actual y estado de disponibilidad.',
      inputSchema: asSchema(
        z.object({
          busqueda: z.string().describe('Término de búsqueda (ej: cerveza, milanesa, cafe)'),
        }),
      ),
      execute: async ({ busqueda }: { busqueda: string }) => {
        return await withTenant(claims, async (db) => {
          const rows = await db
            .select({
              id: productos.id,
              nombre: productos.nombre,
              activo: productos.activo,
              precio: productosPrecios.precio,
            })
            .from(productos)
            .leftJoin(
              productosPrecios,
              and(
                eq(productosPrecios.productoId, productos.id),
                isNull(productosPrecios.vigentaHsta),
              ),
            )
            .where(
              and(
                eq(productos.restauranteId, tenantId),
                isNull(productos.deletedAt),
                ilike(productos.nombre, `%${busqueda.trim()}%`),
              ),
            )
            .limit(10);

          return {
            resultados: rows.map((r) => ({
              id: r.id,
              nombre: r.nombre,
              precio: Number(r.precio || 0),
              activo: r.activo,
            })),
          };
        });
      },
    }),

    consultarEstadoCocina: tool({
      description:
        'Consulta el estado de cocina / monitor KDS en vivo: comandas pendientes, en preparación, listas, pedidos demorados (>20 min) y qué platos se están cocinando ahora mismo.',
      inputSchema: asSchema(
        z.object({
          soloDemorados: z
            .boolean()
            .default(false)
            .describe('Si es true, filtra únicamente los pedidos con demoras de más de 20 minutos'),
        }),
      ),
      execute: async ({ soloDemorados }: { soloDemorados: boolean }) => {
        return await withTenant(claims, async (db) => {
          const tickets = await db
            .select({
              id: pedidos.id,
              estado: pedidos.estado,
              total: pedidos.total,
              notas: pedidos.notas,
              createdAt: pedidos.createdAt,
              tipoSesion: sesionesMesa.tipo,
              mesaIdentificador: mesas.identificador,
            })
            .from(pedidos)
            .innerJoin(sesionesMesa, eq(pedidos.sesionMesaId, sesionesMesa.id))
            .leftJoin(mesas, eq(sesionesMesa.mesaId, mesas.id))
            .where(
              and(
                eq(pedidos.restauranteId, tenantId),
                inArray(pedidos.estado, ['Pendiente', 'En Preparación', 'Listo']),
                gte(pedidos.createdAt, INICIO_HOY),
              ),
            )
            .orderBy(asc(pedidos.createdAt));

          const ahora = Date.now();
          const todos = tickets.map((t) => {
            const minutos = Math.max(0, Math.round((ahora - new Date(t.createdAt).getTime()) / 60000));
            const demorado = minutos >= 20 && t.estado !== 'Listo';
            const origen =
              t.tipoSesion === 'salon'
                ? t.mesaIdentificador || 'Salón'
                : t.tipoSesion === 'delivery'
                  ? 'Delivery'
                  : t.tipoSesion === 'takeaway'
                    ? 'Takeaway'
                    : 'Mostrador';

            return {
              id: t.id,
              origen,
              estado: t.estado,
              minutos,
              demorado,
              notas: t.notas,
              total: Number(t.total || 0),
            };
          });

          const pendientes = todos.filter((t) => t.estado === 'Pendiente').length;
          const enPreparacion = todos.filter((t) => t.estado === 'En Preparación').length;
          const listos = todos.filter((t) => t.estado === 'Listo').length;
          const demorados = todos.filter((t) => t.demorado);

          // Platos marchando en cocina (Pendiente + En Preparación)
          const pedidoIdsMarchando = tickets
            .filter((t) => t.estado === 'Pendiente' || t.estado === 'En Preparación')
            .map((t) => t.id);

          let platosEnMarcha: Array<{ plato: string; cantidad: number }> = [];
          if (pedidoIdsMarchando.length > 0) {
            const items = await db
              .select({
                plato: comandaItems.nombreProductoSnapshot,
                cantidad: sql<number>`sum(${comandaItems.cantidad})::int`,
              })
              .from(comandaItems)
              .where(
                and(
                  eq(comandaItems.restauranteId, tenantId),
                  inArray(comandaItems.pedidoId, pedidoIdsMarchando),
                ),
              )
              .groupBy(comandaItems.nombreProductoSnapshot)
              .orderBy(desc(sql`sum(${comandaItems.cantidad})`));

            platosEnMarcha = items;
          }

          const lista = soloDemorados ? demorados : todos;

          return {
            totalActivos: todos.length,
            pendientes,
            enPreparacion,
            listos,
            demoradosCount: demorados.length,
            platosEnMarcha,
            pedidos: lista.slice(0, 15),
          };
        });
      },
    }),

    consultarPedidosDelivery: tool({
      description:
        'Consulta los pedidos de delivery y takeaway online del día: estados, clientes, direcciones de entrega y demoras.',
      inputSchema: asSchema(
        z.object({
          soloActivos: z
            .boolean()
            .default(true)
            .describe('Si es true, muestra únicamente pedidos en curso (no entregados ni cancelados)'),
        }),
      ),
      execute: async ({ soloActivos }: { soloActivos: boolean }) => {
        return await withTenant(claims, async (db) => {
          const rows = await db
            .select({
              id: datosEntrega.id,
              nombreContacto: datosEntrega.nombreContacto,
              telefono: datosEntrega.telefono,
              direccion: datosEntrega.direccion,
              referencia: datosEntrega.referencia,
              costoEnvio: datosEntrega.costoEnvio,
              estadoEntrega: datosEntrega.estadoEntrega,
              horaEstimada: datosEntrega.horaEstimada,
              createdAt: datosEntrega.createdAt,
              tipoSesion: sesionesMesa.tipo,
            })
            .from(datosEntrega)
            .innerJoin(sesionesMesa, eq(datosEntrega.sesionMesaId, sesionesMesa.id))
            .where(
              and(
                eq(datosEntrega.restauranteId, tenantId),
                gte(datosEntrega.createdAt, INICIO_HOY),
              ),
            )
            .orderBy(desc(datosEntrega.createdAt));

          const ahora = Date.now();
          const todos = rows.map((r) => ({
            id: r.id,
            cliente: r.nombreContacto,
            telefono: r.telefono,
            direccion: r.direccion || 'Retiro en local (Takeaway)',
            tipo: r.tipoSesion || 'delivery',
            estado: r.estadoEntrega,
            costoEnvio: Number(r.costoEnvio || 0),
            minutosDesdePedido: Math.max(0, Math.round((ahora - new Date(r.createdAt).getTime()) / 60000)),
            horaEstimada: r.horaEstimada
              ? new Date(r.horaEstimada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : undefined,
          }));

          const estadosActivos = ['Recibido', 'EnPreparacion', 'Listo', 'EnCamino'];
          const activos = todos.filter((p) => estadosActivos.includes(p.estado));
          const entregados = todos.filter((p) => p.estado === 'Entregado').length;
          const cancelados = todos.filter((p) => p.estado === 'Cancelado').length;

          const lista = soloActivos ? activos : todos;

          return {
            totalPedidosHoy: todos.length,
            activosCount: activos.length,
            entregadosCount: entregados,
            canceladosCount: cancelados,
            pedidos: lista.slice(0, 12),
          };
        });
      },
    }),

    consultarReservas: tool({
      description:
        'Consulta las reservas de mesas para hoy o próximos días: comensales esperados, horarios, estado y mesas asignadas.',
      inputSchema: asSchema(
        z.object({
          diasAdelante: z
            .number()
            .default(0)
            .describe('0 para hoy, 1 para mañana, etc.'),
        }),
      ),
      execute: async ({ diasAdelante }: { diasAdelante: number }) => {
        return await withTenant(claims, async (db) => {
          const fechaBase = new Date();
          fechaBase.setDate(fechaBase.getDate() + diasAdelante);
          const diaTexto =
            diasAdelante === 0
              ? 'Hoy'
              : diasAdelante === 1
                ? 'Mañana'
                : fechaBase.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' });

          const diaInicio = sql`${INICIO_HOY} + ${sql.raw(`interval '${diasAdelante} days'`)}`;
          const diaFin = sql`${diaInicio} + interval '1 day'`;

          const rows = await db
            .select({
              id: reservas.id,
              nombreContacto: reservas.nombreContacto,
              telefono: reservas.telefono,
              inicio: reservas.inicio,
              duracionMin: reservas.duracionMin,
              cantidadPersonas: reservas.cantidadPersonas,
              estado: reservas.estado,
              origen: reservas.origen,
              notas: reservas.notas,
              mesaIdentificador: mesas.identificador,
            })
            .from(reservas)
            .leftJoin(mesas, eq(reservas.mesaId, mesas.id))
            .where(
              and(
                eq(reservas.restauranteId, tenantId),
                gte(reservas.inicio, diaInicio),
                lt(reservas.inicio, diaFin),
              ),
            )
            .orderBy(asc(reservas.inicio));

          let totalComensales = 0;
          let confirmadas = 0;
          let pendientes = 0;
          let sentadas = 0;

          const reservasFormateadas = rows.map((r) => {
            totalComensales += r.cantidadPersonas;
            if (r.estado === 'Confirmada') confirmadas++;
            if (r.estado === 'Pendiente') pendientes++;
            if (r.estado === 'Sentada') sentadas++;

            return {
              id: r.id,
              hora: new Date(r.inicio).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Argentina/Buenos_Aires',
              }),
              nombre: r.nombreContacto,
              personas: r.cantidadPersonas,
              mesa: r.mesaIdentificador || 'Sin asignar',
              telefono: r.telefono,
              estado: r.estado,
              notas: r.notas,
            };
          });

          return {
            dia: diaTexto,
            totalReservas: rows.length,
            totalComensales,
            confirmadas,
            pendientes,
            sentadas,
            reservas: reservasFormateadas,
          };
        });
      },
    }),

    consultarResenasClientes: tool({
      description:
        'Consulta las opiniones y reseñas dejadas por los comensales (estrellas de 1 a 5, comentarios, aspectos destacados y críticas a resolver).',
      inputSchema: asSchema(
        z.object({
          soloCriticas: z
            .boolean()
            .default(false)
            .describe('Si es true, muestra únicamente reseñas negativas (1 a 3 estrellas) que requieren atención del local'),
          limite: z.number().default(6).describe('Cantidad máxima de opiniones a listar'),
        }),
      ),
      execute: async ({ soloCriticas, limite }: { soloCriticas: boolean; limite: number }) => {
        return await withTenant(claims, async (db) => {
          const condiciones = [eq(resenasClientes.restauranteId, tenantId)];
          if (soloCriticas) {
            condiciones.push(lte(resenasClientes.estrellas, 3));
          }

          // Consultas concurrentes en paralelo
          const [stats, rows] = await Promise.all([
            db
              .select({
                total: sql<number>`count(${resenasClientes.id})::int`,
                promedio: sql<string>`coalesce(avg(${resenasClientes.estrellas}), 0)::numeric(10,1)`,
                cinco: sql<number>`count(case when ${resenasClientes.estrellas} = 5 then 1 end)::int`,
                cuatro: sql<number>`count(case when ${resenasClientes.estrellas} = 4 then 1 end)::int`,
                tres: sql<number>`count(case when ${resenasClientes.estrellas} = 3 then 1 end)::int`,
                dos: sql<number>`count(case when ${resenasClientes.estrellas} = 2 then 1 end)::int`,
                una: sql<number>`count(case when ${resenasClientes.estrellas} = 1 then 1 end)::int`,
                criticasNuevas: sql<number>`count(case when ${resenasClientes.estrellas} <= 3 and ${resenasClientes.estado} = 'nuevo' then 1 end)::int`,
              })
              .from(resenasClientes)
              .where(eq(resenasClientes.restauranteId, tenantId)),
            db
              .select({
                id: resenasClientes.id,
                estrellas: resenasClientes.estrellas,
                comentario: resenasClientes.comentario,
                aspectos: resenasClientes.aspectos,
                contactoNombre: resenasClientes.contactoNombre,
                contactoTelefono: resenasClientes.contactoTelefono,
                identificadorMesa: resenasClientes.identificadorMesa,
                origen: resenasClientes.origen,
                estado: resenasClientes.estado,
                createdAt: resenasClientes.createdAt,
              })
              .from(resenasClientes)
              .where(and(...condiciones))
              .orderBy(desc(resenasClientes.createdAt))
              .limit(limite),
          ]);

          const resumen = stats[0] || {
            total: 0,
            promedio: '0.0',
            cinco: 0,
            cuatro: 0,
            tres: 0,
            dos: 0,
            una: 0,
            criticasNuevas: 0,
          };

          return {
            totalResenas: resumen.total,
            promedioEstrellas: Number(resumen.promedio),
            criticasNuevas: resumen.criticasNuevas,
            distribucion: {
              5: resumen.cinco,
              4: resumen.cuatro,
              3: resumen.tres,
              2: resumen.dos,
              1: resumen.una,
            },
            resenas: rows.map((r) => ({
              id: r.id,
              estrellas: r.estrellas,
              comentario: r.comentario || 'Sin comentario escrito',
              aspectos: r.aspectos,
              cliente: r.contactoNombre || 'Anónimo',
              telefono: r.contactoTelefono,
              mesa: r.identificadorMesa,
              origen: r.origen,
              estado: r.estado,
              fecha: new Date(r.createdAt).toLocaleDateString('es-AR'),
            })),
          };
        });
      },
    }),

    consultarDesgloseMetodosPago: tool({
      description:
        'Consulta la recaudación financiera agrupada por cada método de pago (Mercado Pago, Efectivo en mano, Tarjeta física, Transferencia) de hoy o los últimos 7 días.',
      inputSchema: asSchema(
        z.object({
          periodo: z
            .enum(['hoy', 'semana'])
            .default('hoy')
            .describe('Período de análisis: hoy o semana'),
        }),
      ),
      execute: async ({ periodo }: { periodo: 'hoy' | 'semana' }) => {
        return await withTenant(claims, async (db) => {
          const intervalo = periodo === 'hoy' ? '1 day' : '7 days';

          const rows = await db
            .select({
              proveedor: transaccionesPago.proveedor,
              total: sql<string>`coalesce(sum(${transaccionesPago.monto}), 0)`,
              cantidad: sql<number>`count(${transaccionesPago.id})::int`,
            })
            .from(transaccionesPago)
            .where(
              and(
                eq(transaccionesPago.restauranteId, tenantId),
                eq(transaccionesPago.estado, 'Aprobado'),
                sql`${transaccionesPago.createdAt} >= now() - ${sql.raw(`interval '${intervalo}'`)}`,
              ),
            )
            .groupBy(transaccionesPago.proveedor);

          let granTotal = 0;
          let totalTransacciones = 0;
          for (const r of rows) {
            granTotal += Number(r.total);
            totalTransacciones += r.cantidad;
          }

          const nombresMetodos: Record<string, string> = {
            mercado_pago: 'Mercado Pago',
            efectivo: 'Efectivo',
            tarjeta_fisica: 'Tarjeta POS',
            transferencia: 'Transferencia',
          };

          const desglose = rows.map((r) => {
            const monto = Number(r.total);
            return {
              codigo: r.proveedor,
              nombre: nombresMetodos[r.proveedor] || r.proveedor,
              total: monto,
              cantidad: r.cantidad,
              porcentaje: granTotal > 0 ? Math.round((monto / granTotal) * 100) : 0,
            };
          });

          return {
            periodo,
            totalRecaudado: granTotal,
            totalTransacciones,
            metodos: desglose,
          };
        });
      },
    }),

    actualizarPrecioPlato: tool({
      description:
        'Actualiza el precio de venta de un producto de la carta de forma segura. Requiere permisos de gestión de precios. Cierra la vigencia del precio anterior y crea el nuevo valor en el historial contable.',
      inputSchema: asSchema(
        z.object({
          nombrePlato: z.string().describe('Nombre del plato o producto a actualizar'),
          nuevoPrecio: z.number().positive().describe('Nuevo precio en pesos (número positivo, ej: 8500)'),
        }),
      ),
      execute: async ({
        nombrePlato,
        nuevoPrecio,
      }: {
        nombrePlato: string;
        nuevoPrecio: number;
      }) => {
        if (!hasPermission(session.role, 'canManagePrices')) {
          return {
            exito: false,
            mensaje: 'Tu rol no tiene permisos para modificar precios en la carta.',
          };
        }

        return await withTenant(claims, async (db) => {
          const matches = await db
            .select({
              id: productos.id,
              nombre: productos.nombre,
            })
            .from(productos)
            .where(
              and(
                eq(productos.restauranteId, tenantId),
                isNull(productos.deletedAt),
                ilike(productos.nombre, `%${nombrePlato.trim()}%`),
              ),
            )
            .limit(5);

          if (matches.length === 0) {
            return {
              exito: false,
              mensaje: `No se encontró ningún producto con el nombre "${nombrePlato}".`,
            };
          }

          const prod = matches[0];

          // Obtener precio actual
          const [precioActualRow] = await db
            .select({ precio: productosPrecios.precio })
            .from(productosPrecios)
            .where(
              and(
                eq(productosPrecios.productoId, prod.id),
                eq(productosPrecios.restauranteId, tenantId),
                isNull(productosPrecios.vigentaHsta),
              ),
            )
            .limit(1);

          const precioAnterior = Number(precioActualRow?.precio || 0);

          // Transacción append-only
          await db.transaction(async (tx) => {
            // Cerrar vigencia anterior
            await tx
              .update(productosPrecios)
              .set({ vigentaHsta: new Date() })
              .where(
                and(
                  eq(productosPrecios.productoId, prod.id),
                  eq(productosPrecios.restauranteId, tenantId),
                  isNull(productosPrecios.vigentaHsta),
                ),
              );

            // Crear nuevo precio vigente
            await tx.insert(productosPrecios).values({
              restauranteId: tenantId,
              productoId: prod.id,
              precio: nuevoPrecio.toString(),
              creadoPor: session.user.id,
            });
          });

          return {
            exito: true,
            platoId: prod.id,
            nombre: prod.nombre,
            precioAnterior,
            nuevoPrecio,
            mensaje: `El precio de "${prod.nombre}" se actualizó de $${precioAnterior.toLocaleString('es-AR')} a $${nuevoPrecio.toLocaleString('es-AR')}.`,
          };
        });
      },
    }),

    ajustarPreciosMasivo: tool({
      description:
        'Ajusta masivamente los precios de toda la carta o de una categoría específica aplicando un porcentaje de aumento o descuento (ej: 10 para aumentar 10%, -5 para reducir 5%).',
      inputSchema: asSchema(
        z.object({
          porcentaje: z
            .number()
            .min(-90)
            .max(300)
            .describe('Porcentaje de ajuste: positivo para aumento (ej: 15), negativo para descuento (ej: -10)'),
          nombreCategoria: z
            .string()
            .optional()
            .describe('Nombre de categoría opcional para filtrar el ajuste (ej: Bebidas, Hamburguesas, Postres)'),
        }),
      ),
      execute: async ({
        porcentaje,
        nombreCategoria,
      }: {
        porcentaje: number;
        nombreCategoria?: string;
      }) => {
        if (!hasPermission(session.role, 'canManagePrices')) {
          return {
            exito: false,
            mensaje: 'Tu rol no tiene permisos para realizar ajustes masivos de precios.',
          };
        }

        return await withTenant(claims, async (db) => {
          let categoriaId: string | undefined;
          let categoriaNombreReal: string | undefined;

          if (nombreCategoria) {
            const [cat] = await db
              .select({ id: categorias.id, nombre: categorias.nombre })
              .from(categorias)
              .where(
                and(
                  eq(categorias.restauranteId, tenantId),
                  isNull(categorias.deletedAt),
                  ilike(categorias.nombre, `%${nombreCategoria.trim()}%`),
                ),
              )
              .limit(1);

            if (!cat) {
              return {
                exito: false,
                mensaje: `No se encontró la categoría "${nombreCategoria}".`,
              };
            }
            categoriaId = cat.id;
            categoriaNombreReal = cat.nombre;
          }

          // Obtener productos y sus precios vigentes
          const items = await db
            .select({
              id: productos.id,
              nombre: productos.nombre,
              precioActual: productosPrecios.precio,
            })
            .from(productos)
            .innerJoin(
              productosPrecios,
              and(
                eq(productosPrecios.productoId, productos.id),
                isNull(productosPrecios.vigentaHsta),
              ),
            )
            .where(
              and(
                eq(productos.restauranteId, tenantId),
                isNull(productos.deletedAt),
                categoriaId ? eq(productos.categoriaId, categoriaId) : sql`true`,
              ),
            );

          if (items.length === 0) {
            return {
              exito: false,
              mensaje: 'No se encontraron productos activos con precio para ajustar.',
            };
          }

          const factor = 1 + porcentaje / 100;
          const ahora = new Date();
          const ejemplos: Array<{ nombre: string; anterior: number; nuevo: number }> = [];
          const ids: string[] = [];
          const nuevosPrecios: Array<{
            restauranteId: string;
            productoId: string;
            precio: string;
            creadoPor: string;
          }> = [];

          for (const item of items) {
            const actual = Number(item.precioActual || 0);
            if (actual <= 0) continue;
            const nuevo = Math.round(actual * factor);
            ids.push(item.id);
            nuevosPrecios.push({
              restauranteId: tenantId,
              productoId: item.id,
              precio: nuevo.toString(),
              creadoPor: session.user.id,
            });

            if (ejemplos.length < 4) {
              ejemplos.push({
                nombre: item.nombre,
                anterior: actual,
                nuevo,
              });
            }
          }

          if (ids.length > 0) {
            await db.transaction(async (tx) => {
              // 1. Cerrar todos los precios viejos en 1 sola consulta batch
              await tx
                .update(productosPrecios)
                .set({ vigentaHsta: ahora })
                .where(
                  and(
                    inArray(productosPrecios.productoId, ids),
                    eq(productosPrecios.restauranteId, tenantId),
                    isNull(productosPrecios.vigentaHsta),
                  ),
                );

              // 2. Insertar todos los nuevos precios en 1 sola consulta batch
              await tx.insert(productosPrecios).values(nuevosPrecios);
            });
          }

          return {
            exito: true,
            porcentaje,
            categoria: categoriaNombreReal || 'Toda la carta',
            totalProductosAjustados: items.length,
            ejemplos,
            mensaje: `Se aplicó un ajuste de ${porcentaje > 0 ? `+${porcentaje}%` : `${porcentaje}%`} sobre ${items.length} productos ${categoriaNombreReal ? `de la categoría "${categoriaNombreReal}"` : 'de la carta'}.`,
          };
        });
      },
    }),

    consultarPromocionesActivas: tool({
      description:
        'Consulta las promociones, descuentos, combos y 2x1 activos en el restaurante.',
      inputSchema: asSchema(z.object({})),
      execute: async () => {
        return await withTenant(claims, async (db) => {
          const rows = await db
            .select({
              id: promociones.id,
              nombre: promociones.nombre,
              tipo: promociones.tipo,
              valor: promociones.valor,
              alcance: promociones.alcance,
              activa: promociones.activa,
              vigenteDesde: promociones.vigenteDesde,
              vigenteHasta: promociones.vigenteHasta,
            })
            .from(promociones)
            .where(
              and(
                eq(promociones.restauranteId, tenantId),
                eq(promociones.activa, true),
              ),
            );

          return {
            totalPromociones: rows.length,
            promociones: rows.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              tipo: p.tipo,
              valor: Number(p.valor || 0),
              alcance: p.alcance,
            })),
          };
        });
      },
    }),

    consultarEquipoStaff: tool({
      description:
        'Consulta el equipo de trabajo y personal del local: cantidad de empleados registrados, roles (mozo, cocina, cajero, admin) y estado de actividad.',
      inputSchema: asSchema(z.object({})),
      execute: async () => {
        return await withTenant(claims, async (db) => {
          const rows = await db
            .select({
              id: perfilesEmpleados.id,
              rol: perfilesEmpleados.rol,
              activo: perfilesEmpleados.activo,
              createdAt: perfilesEmpleados.createdAt,
            })
            .from(perfilesEmpleados)
            .where(eq(perfilesEmpleados.restauranteId, tenantId));

          const conteoRoles: Record<string, number> = {};
          let activos = 0;

          for (const emp of rows) {
            if (emp.activo) activos++;
            conteoRoles[emp.rol] = (conteoRoles[emp.rol] || 0) + 1;
          }

          return {
            totalEmpleados: rows.length,
            activos,
            inactivos: rows.length - activos,
            distribucionPorRol: conteoRoles,
          };
        });
      },
    }),
  };
}
