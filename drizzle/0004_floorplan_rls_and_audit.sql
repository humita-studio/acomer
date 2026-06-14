-- ============================================================================
-- PLANO DEL LOCAL: RLS + AUDIT para ambientes y elementos_plano
-- (archivo escrito a mano, NO va en meta/_journal.json — igual que
--  0001_rls_and_audit.sql. Aplicar manualmente luego de 0003_floorplan.sql)
-- ============================================================================

ALTER TABLE ambientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE elementos_plano ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- AMBIENTES POLICIES
-- ============================================================================

CREATE POLICY "ambientes_select" ON ambientes
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "ambientes_insert" ON ambientes
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "ambientes_update" ON ambientes
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "ambientes_delete" ON ambientes
  FOR DELETE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- ELEMENTOS_PLANO POLICIES
-- ============================================================================

CREATE POLICY "elementos_plano_select" ON elementos_plano
  FOR SELECT
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "elementos_plano_insert" ON elementos_plano
  FOR INSERT
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "elementos_plano_update" ON elementos_plano
  FOR UPDATE
  USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "elementos_plano_delete" ON elementos_plano
  FOR DELETE
  USING (restaurant_id = get_current_restaurant_id());

-- ============================================================================
-- AUDIT TRIGGERS (fn_audit_log ya existe; ambas tablas tienen id + restaurant_id)
-- ============================================================================

CREATE TRIGGER tr_audit_ambientes AFTER INSERT OR UPDATE OR DELETE ON ambientes FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
CREATE TRIGGER tr_audit_elementos_plano AFTER INSERT OR UPDATE OR DELETE ON elementos_plano FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
