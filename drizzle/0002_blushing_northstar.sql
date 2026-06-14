CREATE TABLE "configuracion_pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"proveedor" text NOT NULL,
	"credenciales" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transacciones_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"sesion_mesa_id" uuid NOT NULL,
	"proveedor" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"estado" text DEFAULT 'Pendiente' NOT NULL,
	"referencia_externa" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configuracion_pagos" ADD CONSTRAINT "configuracion_pagos_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacciones_pago" ADD CONSTRAINT "transacciones_pago_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacciones_pago" ADD CONSTRAINT "transacciones_pago_sesion_mesa_id_fk" FOREIGN KEY ("sesion_mesa_id") REFERENCES "public"."sesiones_mesa"("id") ON DELETE cascade ON UPDATE no action;