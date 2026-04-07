-- Guide subscriptions table
CREATE TABLE IF NOT EXISTS guide_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guide_id, user_id)
);

ALTER TABLE guide_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view guide subscriptions" ON guide_subscriptions
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage their own subscriptions" ON guide_subscriptions
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
