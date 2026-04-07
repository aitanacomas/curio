-- Guide collaborators table
CREATE TABLE IF NOT EXISTS guide_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guide_id, user_id)
);

ALTER TABLE guide_collaborators ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view guide collaborators" ON guide_collaborators
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Guide owners can manage collaborators" ON guide_collaborators
    FOR ALL USING (
      auth.uid() = invited_by
      OR auth.uid() = (SELECT user_id FROM guides WHERE id = guide_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
