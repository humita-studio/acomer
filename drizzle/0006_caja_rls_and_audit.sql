-- ============================================================================
-- CAJA: RLS + AUDIT para sesiones_caja y movimientos_caja
-- (archivo escrito a mano, NO va en meta/_journal.json — igual que
--  0001_rls_and_audit.sql y 0004_floorplan_rls_and_audit.sql.
--  Aplicar manualmente luego de 0004_workable_sphinx.sql)
-- ============================================================================

ALTER TABLE sesiones_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SESIONES_CAJA POLICIES
-- ============================================================================

CREATE POLICY "sesiones_caja_select" ON sesiones_caja
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "sesiones_caja_insert" ON sesiones_caja
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "sesiones_caja_update" ON sesiones_caja
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "sesiones_caja_delete" ON sesiones_caja
  FOR DELETE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- MOVIMIENTOS_CAJA POLICIES
-- ============================================================================

CREATE POLICY "movimientos_caja_select" ON movimientos_caja
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "movimientos_caja_insert" ON movimientos_caja
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "movimientos_caja_update" ON movimientos_caja
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "movimientos_caja_delete" ON movimientos_caja
  FOR DELETE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- AUDIT TRIGGERS (fn_audit_log ya existe; ambas tablas tienen id + restaurant_id)
-- ============================================================================

CREATE TRIGGER tr_audit_sesiones_caja AFTER INSERT OR UPDATE OR DELETE ON sesiones_caja FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_movimientos_caja AFTER INSERT OR UPDATE OR DELETE ON movimientos_caja FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
