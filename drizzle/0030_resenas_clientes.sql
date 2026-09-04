-- ============================================================================
-- 0030: Configuración de reseñas y feedback inteligente de clientes
-- ============================================================================

CREATE TABLE IF NOT EXISTS "configuracion_resenas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "google_review_url" text,
  "resenas_activas" boolean DEFAULT true NOT NULL,
  "min_estrellas_google" integer DEFAULT 4 NOT NULL,
  "recibir_alerta_negativa" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_resenas_restaurant_id_fk'
  ) THEN
    ALTER TABLE "configuracion_resenas"
      ADD CONSTRAINT "configuracion_resenas_restaurant_id_fk"
      FOREIGN KEY ("restaurant_id")
      REFERENCES "public"."restaurantes"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "configuracion_resenas_restaurant_id_idx"
  ON "configuracion_resenas" USING btree ("restaurant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "resenas_clientes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "origen" varchar(20) DEFAULT 'mesa' NOT NULL,
  "mesa_id" uuid,
  "pedido_id" uuid,
  "identificador_mesa" text,
  "estrellas" integer NOT NULL,
  "aspectos" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "comentario" text,
  "contacto_nombre" text,
  "contacto_telefono" text,
  "derivada_a_google" boolean DEFAULT false NOT NULL,
  "estado" varchar(20) DEFAULT 'nuevo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resenas_clientes_restaurant_id_fk'
  ) THEN
    ALTER TABLE "resenas_clientes"
      ADD CONSTRAINT "resenas_clientes_restaurant_id_fk"
      FOREIGN KEY ("restaurant_id")
      REFERENCES "public"."restaurantes"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resenas_clientes_mesa_id_fk'
  ) THEN
    ALTER TABLE "resenas_clientes"
      ADD CONSTRAINT "resenas_clientes_mesa_id_fk"
      FOREIGN KEY ("mesa_id")
      REFERENCES "public"."mesas"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resenas_clientes_pedido_id_fk'
  ) THEN
    ALTER TABLE "resenas_clientes"
      ADD CONSTRAINT "resenas_clientes_pedido_id_fk"
      FOREIGN KEY ("pedido_id")
      REFERENCES "public"."pedidos"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "resenas_clientes_restaurante_created_at_idx"
  ON "resenas_clientes" USING btree ("restaurant_id", "created_at" DESC);
--> statement-breakpoint

-- RLS
ALTER TABLE "configuracion_resenas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "configuracion_resenas_select" ON configuracion_resenas;
--> statement-breakpoint
CREATE POLICY "configuracion_resenas_select" ON configuracion_resenas
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint

DROP POLICY IF EXISTS "configuracion_resenas_insert" ON configuracion_resenas;
--> statement-breakpoint
CREATE POLICY "configuracion_resenas_insert" ON configuracion_resenas
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint

DROP POLICY IF EXISTS "configuracion_resenas_update" ON configuracion_resenas;
--> statement-breakpoint
CREATE POLICY "configuracion_resenas_update" ON configuracion_resenas
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint

ALTER TABLE "resenas_clientes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "resenas_clientes_select" ON resenas_clientes;
--> statement-breakpoint
CREATE POLICY "resenas_clientes_select" ON resenas_clientes
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint

DROP POLICY IF EXISTS "resenas_clientes_insert" ON resenas_clientes;
--> statement-breakpoint
CREATE POLICY "resenas_clientes_insert" ON resenas_clientes
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint

DROP POLICY IF EXISTS "resenas_clientes_update" ON resenas_clientes;
--> statement-breakpoint
CREATE POLICY "resenas_clientes_update" ON resenas_clientes
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());
