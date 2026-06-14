CREATE TABLE "items_borrador_mesa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"sesion_mesa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"nombre_producto" text NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"modificadores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items_borrador_mesa" ADD CONSTRAINT "items_borrador_mesa_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_borrador_mesa" ADD CONSTRAINT "items_borrador_mesa_sesion_mesa_id_fk" FOREIGN KEY ("sesion_mesa_id") REFERENCES "public"."sesiones_mesa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_borrador_mesa" ADD CONSTRAINT "items_borrador_mesa_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;