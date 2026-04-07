-- Add places JSONB column to guides for standalone (non-plan) guides
ALTER TABLE guides ADD COLUMN IF NOT EXISTS places JSONB DEFAULT '[]';

-- Allow owners to update their own guides
DO $$ BEGIN
  CREATE POLICY "Users can update their own guides" ON guides
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
