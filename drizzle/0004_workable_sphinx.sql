-- ============================================================================
-- CAJA: tablas sesiones_caja y movimientos_caja
-- NOTA: drizzle-kit generó además sentencias de drift sobre mesas/elementos_plano
--   (parent_mesa_id, tipos real) que YA están aplicadas en la DB vía
--   0005_freeform_y_division.sql. Se removieron a mano para que esta migración
--   sea segura de aplicar sobre la base actual. El snapshot 0004 sí refleja el
--   schema completo, por lo que los `generate` futuros quedan limpios.
-- ============================================================================

CREATE TABLE "sesiones_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"abierta_por" uuid NOT NULL,
	"cerrada_por" uuid,
	"estado" text DEFAULT 'Abierta' NOT NULL,
	"monto_inicial" numeric(10, 2) DEFAULT '0' NOT NULL,
	"monto_final_contado" numeric(10, 2),
	"monto_esperado" numeric(10, 2),
	"diferencia" numeric(10, 2),
	"notas_cierre" text,
	"abierta_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_at" timestamp with time zone,
	CONSTRAINT "sesiones_caja_estado_check" CHECK (estado IN ('Abierta','Cerrada'))
);
--> statement-breakpoint
CREATE TABLE "movimientos_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"sesion_caja_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"concepto" text,
	"registrado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_caja_tipo_check" CHECK (tipo IN ('ingreso','egreso','retiro'))
);
--> statement-breakpoint
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_sesion_caja_id_fk" FOREIGN KEY ("sesion_caja_id") REFERENCES "public"."sesiones_caja"("id") ON DELETE cascade ON UPDATE no action;
