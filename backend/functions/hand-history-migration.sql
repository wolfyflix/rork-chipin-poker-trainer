-- Add hand_history table for cloud-synced Who Won results
CREATE TABLE IF NOT EXISTS public.hand_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  board JSONB NOT NULL DEFAULT '[]'::jsonb,
  winners TEXT[] NOT NULL DEFAULT '{}',
  winning_hand TEXT NOT NULL DEFAULT '',
  tie BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS so users can only see their own hand history
ALTER TABLE public.hand_history ENABLE ROW LEVEL SECURITY;

-- Users can insert their own hand history
CREATE POLICY "Users can insert own hand history"
  ON public.hand_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own hand history
CREATE POLICY "Users can read own hand history"
  ON public.hand_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own hand history
CREATE POLICY "Users can delete own hand history"
  ON public.hand_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_hand_history_user_id
  ON public.hand_history(user_id, created_at DESC);
