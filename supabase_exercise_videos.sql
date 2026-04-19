-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS exercise_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_name text NOT NULL,
  variation text NOT NULL DEFAULT 'default',
  video_url text NOT NULL,
  equipment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(exercise_name, variation)
);

CREATE INDEX IF NOT EXISTS idx_exercise_videos_name ON exercise_videos(exercise_name);

ALTER TABLE exercise_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read exercise videos" ON exercise_videos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert exercise videos" ON exercise_videos FOR INSERT WITH CHECK (true);
