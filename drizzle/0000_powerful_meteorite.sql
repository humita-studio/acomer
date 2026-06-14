CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"tabla" text NOT NULL,
	"registro_id" uuid NOT NULL,
	"accion" text,
	"datos_anteriores" jsonb,
	"datos_nuevos" jsonb,
	"realizado_por" uuid,
	"realizado_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "audit_log_accion_check" CHECK (accion IN ('INSERT','UPDATE','DELETE'))
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "comanda_item_modificadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"comanda_item_id" uuid NOT NULL,
	"modificador_id" uuid NOT NULL,
	"nombre_modificador_snapshot" text NOT NULL,
	"precio_extra_snapshot" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comanda_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"pedido_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(5, 0) DEFAULT '1' NOT NULL,
	"nombre_producto_snapshot" text NOT NULL,
	"precio_unitario_snapshot" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mesas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"identificador" text NOT NULL,
	"qr_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "mesas_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "modificadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text,
	"disponible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modificadores_precios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"modificador_id" uuid NOT NULL,
	"precio_extra" numeric(10, 2) DEFAULT '0' NOT NULL,
	"vigente_desde" timestamp with time zone DEFAULT now(),
	"vigente_hasta" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"sesion_mesa_id" uuid NOT NULL,
	"estado" text DEFAULT 'Pendiente' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perfiles_empleados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"rol" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perfiles_empleados_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "perfiles_empleados_rol_check" CHECK (rol IN ('owner','admin','cajero','mozo','cocina'))
);
--> statement-breakpoint
CREATE TABLE "producto_modificadores_disponibles" (
	"producto_id" uuid NOT NULL,
	"modificador_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"permite_adicionales" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "productos_precios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"precio" numeric(10, 2) NOT NULL,
	"vigente_desde" timestamp with time zone DEFAULT now(),
	"vigente_hasta" timestamp with time zone,
	"creado_por" uuid
);
--> statement-breakpoint
CREATE TABLE "restaurantes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "restaurantes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sesiones_mesa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"mesa_id" uuid NOT NULL,
	"estado" text DEFAULT 'Activa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_item_modificadores" ADD CONSTRAINT "comanda_item_mod_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_item_modificadores" ADD CONSTRAINT "comanda_item_mod_comanda_item_id_fk" FOREIGN KEY ("comanda_item_id") REFERENCES "public"."comanda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_item_modificadores" ADD CONSTRAINT "comanda_item_mod_modificador_id_fk" FOREIGN KEY ("modificador_id") REFERENCES "public"."modificadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_items" ADD CONSTRAINT "comanda_items_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_items" ADD CONSTRAINT "comanda_items_pedido_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_items" ADD CONSTRAINT "comanda_items_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificadores" ADD CONSTRAINT "modificadores_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificadores_precios" ADD CONSTRAINT "modificadores_precios_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificadores_precios" ADD CONSTRAINT "modificadores_precios_modificador_id_fk" FOREIGN KEY ("modificador_id") REFERENCES "public"."modificadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_sesion_mesa_id_fk" FOREIGN KEY ("sesion_mesa_id") REFERENCES "public"."sesiones_mesa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfiles_empleados" ADD CONSTRAINT "perfiles_empleados_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_modificadores_disponibles" ADD CONSTRAINT "producto_mod_disponibles_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_modificadores_disponibles" ADD CONSTRAINT "producto_mod_disponibles_modificador_id_fk" FOREIGN KEY ("modificador_id") REFERENCES "public"."modificadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_precios" ADD CONSTRAINT "productos_precios_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_precios" ADD CONSTRAINT "productos_precios_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones_mesa" ADD CONSTRAINT "sesiones_mesa_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones_mesa" ADD CONSTRAINT "sesiones_mesa_mesa_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mesas_qr_token_idx" ON "mesas" USING btree ("qr_token");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurantes_slug_idx" ON "restaurantes" USING btree ("slug");