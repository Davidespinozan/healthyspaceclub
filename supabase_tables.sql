-- Run this in Supabase Dashboard → SQL Editor

-- User profiles for the Club
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Club posts (social feed)
CREATE TABLE IF NOT EXISTS club_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  username text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  streak integer DEFAULT 0,
  workout_summary text DEFAULT '',
  photo_url text DEFAULT '',
  text text DEFAULT '',
  fire_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Fire reactions (track who fired what)
CREATE TABLE IF NOT EXISTS club_fires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES club_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_club_posts_created ON club_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_posts_user ON club_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_club_fires_post ON club_fires(post_id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_fires ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can read, authenticated can write their own
-- For now with anon key, allow all operations (tighten later with auth)
CREATE POLICY "Anyone can read profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert profiles" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profiles" ON user_profiles FOR UPDATE USING (true);

CREATE POLICY "Anyone can read posts" ON club_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert posts" ON club_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update posts" ON club_posts FOR UPDATE USING (true);

CREATE POLICY "Anyone can read fires" ON club_fires FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fires" ON club_fires FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete fires" ON club_fires FOR DELETE USING (true);

-- Storage buckets (run these separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('club', 'club', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
