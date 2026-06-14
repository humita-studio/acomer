-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE restaurantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE modificadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE modificadores_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_modificadores_disponibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_mesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_item_modificadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER: Get current restaurant_id from JWT or session
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_restaurant_id() RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'restaurant_id')::uuid;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS uuid AS $$
  SELECT auth.uid();
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- RESTAURANTES POLICIES
-- ============================================================================

-- Users can only view restaurants they're associated with
CREATE POLICY "restaurantes_select_own" ON restaurantes
  FOR SELECT
  USING (
    id IN (
      SELECT restaurant_id FROM perfiles_empleados
      WHERE user_id = get_current_user_id()
    )
  );

-- Only restaurant owners can insert/update/delete
CREATE POLICY "restaurantes_insert_own" ON restaurantes
  FOR INSERT
  WITH CHECK (
    id IN (
      SELECT restaurant_id FROM perfiles_empleados
      WHERE user_id = get_current_user_id() AND rol = 'owner'
    )
  );

CREATE POLICY "restaurantes_update_own" ON restaurantes
  FOR UPDATE
  USING (
    id IN (
      SELECT restaurant_id FROM perfiles_empleados
      WHERE user_id = get_current_user_id() AND rol = 'owner'
    )
  );

CREATE POLICY "restaurantes_delete_own" ON restaurantes
  FOR DELETE
  USING (
    id IN (
      SELECT restaurant_id FROM perfiles_empleados
      WHERE user_id = get_current_user_id() AND rol = 'owner'
    )
  );

-- ============================================================================
-- PERFILES_EMPLEADOS POLICIES
-- ============================================================================

CREATE POLICY "perfiles_empleados_select" ON perfiles_empleados
  FOR SELECT
  USING (
    restaurant_id = get_current_restaurant_id()
  );

CREATE POLICY "perfiles_empleados_insert" ON perfiles_empleados
  FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM perfiles_empleados
      WHERE user_id = get_current_user_id() AND rol = 'owner'
    )
  );

CREATE POLICY "perfiles_empleados_update" ON perfiles_empleados
  FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM perfiles_empleados
      WHERE user_id = get_current_user_id() AND rol IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- CATEGORIAS POLICIES
-- ============================================================================

CREATE POLICY "categorias_select" ON categorias
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "categorias_insert" ON categorias
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "categorias_update" ON categorias
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "categorias_delete" ON categorias
  FOR DELETE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- PRODUCTOS POLICIES
-- ============================================================================

CREATE POLICY "productos_select" ON productos
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "productos_insert" ON productos
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "productos_update" ON productos
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "productos_delete" ON productos
  FOR DELETE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- PRODUCTOS_PRECIOS POLICIES
-- ============================================================================

CREATE POLICY "productos_precios_select" ON productos_precios
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "productos_precios_insert" ON productos_precios
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- MODIFICADORES POLICIES
-- ============================================================================

CREATE POLICY "modificadores_select" ON modificadores
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "modificadores_insert" ON modificadores
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "modificadores_update" ON modificadores
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "modificadores_delete" ON modificadores
  FOR DELETE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- MODIFICADORES_PRECIOS POLICIES
-- ============================================================================

CREATE POLICY "modificadores_precios_select" ON modificadores_precios
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "modificadores_precios_insert" ON modificadores_precios
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- PRODUCTO_MODIFICADORES_DISPONIBLES POLICIES
-- ============================================================================

CREATE POLICY "producto_modificadores_select" ON producto_modificadores_disponibles
  FOR SELECT
  USING (
    producto_id IN (
      SELECT id FROM productos WHERE restaurant_id = get_current_restaurant_id()
    )
  );

CREATE POLICY "producto_modificadores_insert" ON producto_modificadores_disponibles
  FOR INSERT
  WITH CHECK (
    producto_id IN (
      SELECT id FROM productos WHERE restaurant_id = get_current_restaurant_id()
    )
  );

CREATE POLICY "producto_modificadores_delete" ON producto_modificadores_disponibles
  FOR DELETE
  USING (
    producto_id IN (
      SELECT id FROM productos WHERE restaurant_id = get_current_restaurant_id()
    )
  );

-- ============================================================================
-- MESAS POLICIES
-- ============================================================================

CREATE POLICY "mesas_select" ON mesas
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "mesas_insert" ON mesas
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "mesas_update" ON mesas
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "mesas_delete" ON mesas
  FOR DELETE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- SESIONES_MESA POLICIES
-- ============================================================================

CREATE POLICY "sesiones_mesa_select" ON sesiones_mesa
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "sesiones_mesa_insert" ON sesiones_mesa
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "sesiones_mesa_update" ON sesiones_mesa
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- PEDIDOS POLICIES
-- ============================================================================

CREATE POLICY "pedidos_select" ON pedidos
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "pedidos_insert" ON pedidos
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "pedidos_update" ON pedidos
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- COMANDA_ITEMS POLICIES
-- ============================================================================

CREATE POLICY "comanda_items_select" ON comanda_items
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "comanda_items_insert" ON comanda_items
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "comanda_items_update" ON comanda_items
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- COMANDA_ITEM_MODIFICADORES POLICIES
-- ============================================================================

CREATE POLICY "comanda_item_modificadores_select" ON comanda_item_modificadores
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "comanda_item_modificadores_insert" ON comanda_item_modificadores
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- AUDIT_LOG POLICIES
-- ============================================================================

CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS _audit_log_buffer AS TABLE audit_log WITH NO DATA;

CREATE OR REPLACE FUNCTION fn_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_registro_id uuid;
  v_accion text;
BEGIN
  -- Determine the action
  IF TG_OP = 'INSERT' THEN
    v_registro_id := NEW.id;
    v_accion := 'INSERT';
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := NEW.id;
    v_accion := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_registro_id := OLD.id;
    v_accion := 'DELETE';
  END IF;

  -- Determine restaurant_id
  DECLARE
    v_restaurant_id uuid;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_restaurant_id := OLD.restaurant_id;
    ELSE
      v_restaurant_id := NEW.restaurant_id;
    END IF;

    -- Insert audit log entry
    INSERT INTO audit_log (
      id, restaurant_id, tabla, registro_id, accion,
      datos_anteriores, datos_nuevos, realizado_por, realizado_at
    ) VALUES (
      gen_random_uuid(),
      v_restaurant_id,
      TG_TABLE_NAME,
      v_registro_id,
      v_accion,
      CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
      CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
      get_current_user_id(),
      now()
    );
  END;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to all tables except audit_log and restaurantes (special handling)
CREATE TRIGGER tr_audit_categorias AFTER INSERT OR UPDATE OR DELETE ON categorias FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_productos AFTER INSERT OR UPDATE OR DELETE ON productos FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_productos_precios AFTER INSERT OR UPDATE OR DELETE ON productos_precios FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_modificadores AFTER INSERT OR UPDATE OR DELETE ON modificadores FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_modificadores_precios AFTER INSERT OR UPDATE OR DELETE ON modificadores_precios FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_mesas AFTER INSERT OR UPDATE OR DELETE ON mesas FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_sesiones_mesa AFTER INSERT OR UPDATE OR DELETE ON sesiones_mesa FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_pedidos AFTER INSERT OR UPDATE OR DELETE ON pedidos FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_comanda_items AFTER INSERT OR UPDATE OR DELETE ON comanda_items FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_comanda_item_modificadores AFTER INSERT OR UPDATE OR DELETE ON comanda_item_modificadores FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_perfiles_empleados AFTER INSERT OR UPDATE OR DELETE ON perfiles_empleados FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Special audit for restaurantes (uses id, not restaurant_id)
CREATE OR REPLACE FUNCTION fn_audit_log_restaurantes() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    id, restaurant_id, tabla, registro_id, accion,
    datos_anteriores, datos_nuevos, realizado_por, realizado_at
  ) VALUES (
    gen_random_uuid(),
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP::text,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    get_current_user_id(),
    now()
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_audit_restaurantes AFTER INSERT OR UPDATE OR DELETE ON restaurantes FOR EACH ROW EXECUTE FUNCTION fn_audit_log_restaurantes();
