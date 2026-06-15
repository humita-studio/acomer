-- Plano: posiciones libres (coordenadas fraccionarias) + división de mesas
-- Aplicar con: node scripts/apply-migration.mjs ./drizzle/0005_freeform_y_division.sql

ALTER TABLE "mesas" ALTER COLUMN "pos_x" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "mesas" ALTER COLUMN "pos_y" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "mesas" ALTER COLUMN "ancho" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "mesas" ALTER COLUMN "alto" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "elementos_plano" ALTER COLUMN "pos_x" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "elementos_plano" ALTER COLUMN "pos_y" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "elementos_plano" ALTER COLUMN "ancho" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "elementos_plano" ALTER COLUMN "alto" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "mesas" ADD COLUMN "parent_mesa_id" uuid;--> statement-breakpoint
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_parent_mesa_id_fk" FOREIGN KEY ("parent_mesa_id") REFERENCES "public"."mesas"("id") ON DELETE cascade ON UPDATE no action;
