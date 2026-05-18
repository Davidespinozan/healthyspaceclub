-- ============================================================
-- Agregar streak_count + last_active_date a user_profiles
-- ============================================================
-- Necesario para PublicProfile: hoy el streak vive solo en
-- localStorage (Zustand persist) y posts[0].streak (denormalizado).
-- Movemos la fuente de verdad a una columna persistida que se
-- actualiza desde los 3 callsites de check-in (setDailyCheckin,
-- saveNightCheckIn, saveDailyCheckIn).
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date date;

-- Index para futuros queries de leaderboard / top users por streak.
-- WHERE streak_count > 0 mantiene el index chico (la mayoría de users
-- nuevos arrancan con 0).
CREATE INDEX IF NOT EXISTS user_profiles_streak_idx
  ON user_profiles(streak_count DESC)
  WHERE streak_count > 0;
