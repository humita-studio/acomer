CREATE TABLE "ambientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "elementos_plano" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"tipo" text DEFAULT 'pared' NOT NULL,
	"pos_x" integer DEFAULT 0 NOT NULL,
	"pos_y" integer DEFAULT 0 NOT NULL,
	"ancho" integer DEFAULT 1 NOT NULL,
	"alto" integer DEFAULT 1 NOT NULL,
	"rotacion" integer DEFAULT 0 NOT NULL,
	"etiqueta" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "elementos_plano_tipo_check" CHECK (tipo IN ('pared','barra','contorno','decoracion'))
);
--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "ambiente_id" uuid;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "pos_x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "pos_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "ancho" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "alto" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "forma" text DEFAULT 'cuadrada' NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "capacidad" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "rotacion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ambientes" ADD CONSTRAINT "ambientes_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elementos_plano" ADD CONSTRAINT "elementos_plano_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elementos_plano" ADD CONSTRAINT "elementos_plano_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_ambiente_id_ambientes_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_forma_check" CHECK (forma IN ('redonda','cuadrada'));