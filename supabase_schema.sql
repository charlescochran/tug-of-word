-- Create the games table
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_code VARCHAR(10) NOT NULL UNIQUE,
    player1_id VARCHAR(50) NOT NULL,
    player2_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'in_progress', 'p1_won', 'p2_won', 'tied'
    start_word VARCHAR(4) NOT NULL,
    p1_goal VARCHAR(4) NOT NULL,
    p2_goal VARCHAR(4) NOT NULL,
    words JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_modified_index INTEGER,
    current_turn_player_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) but allow anonymous access for MVP
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone
CREATE POLICY "Allow public read access" ON public.games
    FOR SELECT
    USING (true);

-- Allow insert access to anyone
CREATE POLICY "Allow public insert access" ON public.games
    FOR INSERT
    WITH CHECK (true);

-- Allow update access to anyone
CREATE POLICY "Allow public update access" ON public.games
    FOR UPDATE
    USING (true);

-- Allow delete access to anyone
CREATE POLICY "Allow public delete access" ON public.games
    FOR DELETE
    USING (true);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function before update
CREATE TRIGGER update_games_modtime
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Enable realtime for the games table
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;

-- AUTOMATED CLEANUP (Requires pg_cron extension)
-- Deletes abandoned games that are older than 3 days (runs daily at midnight).
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'delete-old-games',
    '0 0 * * *',
    $$ DELETE FROM public.games WHERE created_at < NOW() - INTERVAL '3 days' $$
);
