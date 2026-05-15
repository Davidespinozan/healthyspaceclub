-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS meal_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_name text UNIQUE NOT NULL,
  steps text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_recipes_name ON meal_recipes(meal_name);

ALTER TABLE meal_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read recipes" ON meal_recipes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert recipes" ON meal_recipes FOR INSERT WITH CHECK (true);
