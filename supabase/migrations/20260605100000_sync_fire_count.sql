-- Mantener club_posts.fire_count en sync con club_fires (igual que comments_count).
-- Antes el fire_count solo se actualizaba en el cliente (estado local), así que
-- al recargar volvía al valor viejo de la BD → "los fires no se guardan".

CREATE OR REPLACE FUNCTION sync_fire_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE club_posts SET fire_count = fire_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE club_posts SET fire_count = GREATEST(0, fire_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_fire_count ON club_fires;
CREATE TRIGGER trg_sync_fire_count
  AFTER INSERT OR DELETE ON club_fires
  FOR EACH ROW EXECUTE FUNCTION sync_fire_count();

-- Reconciliar contadores existentes (por si hay desajuste por el bug anterior).
UPDATE club_posts p
SET fire_count = COALESCE((SELECT count(*) FROM club_fires f WHERE f.post_id = p.id), 0);
