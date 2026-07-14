-- ============================================================================
-- STAFF ALERTS: avisos operativos persistidos (llamar mozo, etc.)
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0025_staff_alerts.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS "staff_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "cuerpo" text NOT NULL,
  "href" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_alerts_restaurant_id_fk'
  ) THEN
    ALTER TABLE "staff_alerts"
      ADD CONSTRAINT "staff_alerts_restaurant_id_fk"
      FOREIGN KEY ("restaurant_id")
      REFERENCES "public"."restaurantes"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "staff_alerts_restaurante_created_at_idx"
  ON "staff_alerts" USING btree ("restaurant_id", "created_at");
--> statement-breakpoint

ALTER TABLE "staff_alerts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "staff_alerts_select" ON staff_alerts;
--> statement-breakpoint
CREATE POLICY "staff_alerts_select" ON staff_alerts
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint

DROP POLICY IF EXISTS "staff_alerts_insert" ON staff_alerts;
--> statement-breakpoint
CREATE POLICY "staff_alerts_insert" ON staff_alerts
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());
