-- ============================================================================
-- RESERVAS + TAKEAWAY/DELIVERY: DDL + RLS + AUDIT
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0007_reservas_delivery.sql
--
-- Archivo autocontenido (DDL + RLS + audit), aplicado fuera del journal de
-- drizzle-kit — mismo criterio que las tablas de caja (su DDL tampoco está
-- journaled; 0006 sólo agrega RLS+audit). fn_audit_log y
-- get_current_restaurant_id ya existen (0001_rls_and_audit.sql).
-- ============================================================================

-- 1) sesiones_mesa: generalizar para pedidos sin mesa (takeaway/delivery)
ALTER TABLE sesiones_mesa ALTER COLUMN mesa_id DROP NOT NULL;--> statement-breakpoint
ALTER TABLE sesiones_mesa ADD COLUMN tipo text NOT NULL DEFAULT 'salon';--> statement-breakpoint
ALTER TABLE sesiones_mesa ADD CONSTRAINT sesiones_mesa_tipo_check CHECK (tipo IN ('salon','takeaway','delivery'));--> statement-breakpoint

-- 2) datos_entrega: contacto/entrega 1:1 con la sesión (takeaway/delivery)
CREATE TABLE datos_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  sesion_mesa_id uuid NOT NULL UNIQUE REFERENCES sesiones_mesa(id) ON DELETE CASCADE,
  nombre_contacto text NOT NULL,
  telefono text NOT NULL,
  direccion text,
  referencia text,
  costo_envio numeric(10,2) NOT NULL DEFAULT 0,
  estado_entrega text NOT NULL DEFAULT 'Recibido'
    CHECK (estado_entrega IN ('Recibido','EnPreparacion','Listo','EnCamino','Entregado','Cancelado')),
  hora_estimada timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- 3) reservas
CREATE TABLE reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre_contacto text NOT NULL,
  telefono text NOT NULL,
  mesa_id uuid REFERENCES mesas(id) ON DELETE SET NULL,
  ambiente_id uuid REFERENCES ambientes(id) ON DELETE SET NULL,
  inicio timestamptz NOT NULL,
  duracion_min integer NOT NULL DEFAULT 90,
  cantidad_personas integer NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente','Confirmada','Sentada','NoShow','Cancelada','Cumplida')),
  origen text NOT NULL DEFAULT 'online' CHECK (origen IN ('online','telefono','walkin')),
  sesion_mesa_id uuid REFERENCES sesiones_mesa(id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX reservas_tenant_inicio_idx ON reservas (restaurant_id, inicio);--> statement-breakpoint

-- ============================================================================
-- ROW LEVEL SECURITY (mismo patrón que 0006: filtra por restaurant_id del JWT)
-- ============================================================================
ALTER TABLE datos_entrega ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "datos_entrega_select" ON datos_entrega FOR SELECT USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "datos_entrega_insert" ON datos_entrega FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "datos_entrega_update" ON datos_entrega FOR UPDATE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "datos_entrega_delete" ON datos_entrega FOR DELETE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint

CREATE POLICY "reservas_select" ON reservas FOR SELECT USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "reservas_insert" ON reservas FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "reservas_update" ON reservas FOR UPDATE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint
CREATE POLICY "reservas_delete" ON reservas FOR DELETE USING (restaurant_id = get_current_restaurant_id());--> statement-breakpoint

-- NOTA: las server actions del flujo público (crear reserva / iniciar pedido
-- externo) insertan vía la conexión `db` (DATABASE_URL), que corre con un rol
-- dueño de tabla y BYPASSA RLS — igual que `abrirOReusarSesion` hoy. Estas
-- policies aplican al acceso vía PostgREST/anon, como defensa en profundidad.

-- ============================================================================
-- AUDIT (fn_audit_log ya existe; ambas tablas tienen id + restaurant_id)
-- ============================================================================
CREATE TRIGGER tr_audit_datos_entrega AFTER INSERT OR UPDATE OR DELETE ON datos_entrega FOR EACH ROW EXECUTE FUNCTION fn_audit_log();--> statement-breakpoint
CREATE TRIGGER tr_audit_reservas AFTER INSERT OR UPDATE OR DELETE ON reservas FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
