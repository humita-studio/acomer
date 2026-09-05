-- Canales privados de Realtime (autorización con RLS sobre realtime.messages).
--
-- Aplicar con:  node scripts/apply-migration.mjs drizzle/0032_realtime_private_channels.sql
-- La app abre TODOS los canales como privados (shared/supabase/realtime.ts):
-- sin estas políticas el panel se queda sin realtime. Cierre final, manual:
-- Supabase → Realtime → Settings → "Private channels only".
--
-- admin_restaurant_<tenant>: sólo staff activo de ese local (JWT authenticated).
-- mesa_<sesion>: cualquier cliente (el id de sesión es el secreto), anon o staff.
-- Los broadcasts del servidor usan la secret key (service_role): no pasan por RLS.
--
-- Idempotente (drop if exists) y sin efecto mientras los canales sean públicos.

CREATE OR REPLACE FUNCTION public.es_staff_del_canal(topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles_empleados p
    WHERE p.user_id = auth.uid()
      AND p.activo
      AND topic = 'admin_restaurant_' || p.restaurant_id::text
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.es_staff_del_canal(text) FROM public;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.es_staff_del_canal(text) TO authenticated, anon, service_role;
--> statement-breakpoint

DROP POLICY IF EXISTS "staff lee el canal de su local" ON realtime.messages;
--> statement-breakpoint
CREATE POLICY "staff lee el canal de su local"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND public.es_staff_del_canal(realtime.topic())
);
--> statement-breakpoint

DROP POLICY IF EXISTS "staff escribe en el canal de su local" ON realtime.messages;
--> statement-breakpoint
CREATE POLICY "staff escribe en el canal de su local"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND public.es_staff_del_canal(realtime.topic())
);
--> statement-breakpoint

DROP POLICY IF EXISTS "comensal lee el canal de su sesion" ON realtime.messages;
--> statement-breakpoint
CREATE POLICY "comensal lee el canal de su sesion"
ON realtime.messages FOR SELECT
TO anon, authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND realtime.topic() LIKE 'mesa\_%'
);
--> statement-breakpoint

DROP POLICY IF EXISTS "comensal escribe en el canal de su sesion" ON realtime.messages;
--> statement-breakpoint
CREATE POLICY "comensal escribe en el canal de su sesion"
ON realtime.messages FOR INSERT
TO anon, authenticated
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND realtime.topic() LIKE 'mesa\_%'
);
