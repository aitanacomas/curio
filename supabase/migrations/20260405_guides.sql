-- Guides table: published travel guides based on user plans
CREATE TABLE IF NOT EXISTS guides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination TEXT,
  description TEXT,
  cover_url TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guides are viewable by everyone" ON guides
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own guides" ON guides
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own guides" ON guides
  FOR DELETE USING (auth.uid() = user_id);
