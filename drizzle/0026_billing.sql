-- ============================================================================
-- Billing SaaS: plan + trial/periodo en restaurantes + ledger de pagos de suscripción
-- ============================================================================

ALTER TABLE "restaurantes" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'pro' NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurantes" ADD COLUMN IF NOT EXISTS "billing_status" text DEFAULT 'trial' NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurantes" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "restaurantes" ADD COLUMN IF NOT EXISTS "period_ends_at" timestamp with time zone;
--> statement-breakpoint

-- Backfill: locales existentes = trial de 14 días desde ahora (o exempt si preferís a mano)
UPDATE "restaurantes"
SET
  "plan" = COALESCE(NULLIF("plan", ''), 'pro'),
  "billing_status" = COALESCE(NULLIF("billing_status", ''), 'trial'),
  "trial_ends_at" = COALESCE("trial_ends_at", now() + interval '14 days')
WHERE "deleted_at" IS NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "restaurantes" ADD CONSTRAINT "restaurantes_plan_check"
    CHECK (plan IN ('basico','pro','a_medida'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "restaurantes" ADD CONSTRAINT "restaurantes_billing_status_check"
    CHECK (billing_status IN ('trial','active','past_due','cancelled','exempt'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pagos_suscripcion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "plan" text NOT NULL,
  "monto" numeric(12, 2) NOT NULL,
  "estado" text DEFAULT 'pending' NOT NULL,
  "mp_preference_id" text,
  "mp_payment_id" text,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "pagos_suscripcion_restaurant_id_fk"
    FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "pagos_suscripcion_estado_check"
    CHECK (estado IN ('pending','approved','rejected','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "pagos_suscripcion_plan_check"
    CHECK (plan IN ('basico','pro','a_medida'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pagos_suscripcion_restaurant_idx" ON "pagos_suscripcion" ("restaurant_id");
--> statement-breakpoint

ALTER TABLE "pagos_suscripcion" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "pagos_suscripcion_select" ON pagos_suscripcion;
--> statement-breakpoint
CREATE POLICY "pagos_suscripcion_select" ON pagos_suscripcion
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "pagos_suscripcion_insert" ON pagos_suscripcion;
--> statement-breakpoint
CREATE POLICY "pagos_suscripcion_insert" ON pagos_suscripcion
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "pagos_suscripcion_update" ON pagos_suscripcion;
--> statement-breakpoint
CREATE POLICY "pagos_suscripcion_update" ON pagos_suscripcion
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());
