# Tug of Word

**Tug of Word** is a head-to-head word ladder game where players race to form their secret goal word!

## Gameplay
You and your opponent are given the same starting word, but different (secret!) goal words. You must take turns modifying exactly **one letter** of the previous word to form a new word. If you reach your hidden goal word, **you win**!

### The Rules
1. Every word must be exactly 4 letters and found in the Scrabble dictionary (TWL06).
2. You can only change one letter per turn.
3. Once a word has been played in the ladder, it can never be played again. **No repeats!**
4. You **cannot** change the letter your opponent just changed on their turn, unless doing so forms your goal word.
5. If a player cannot play a valid move, the game ends in a **Draw**. The word ladder is stuck!

## Tech Stack
- Frontend: Vue 3 (Vite)
- Backend: Supabase (Postgres & Realtime WebSockets)
- Styling: Vanilla CSS
- Hosting: GitHub Pages 

## Local Setup

To run this game locally, you will need your own Supabase project.

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Database Setup:**
   - Go to [Supabase](https://supabase.com) and create a new project.
   - Open the SQL Editor and run the contents of the `supabase_schema.sql` file provided in this repo.
   - This sets up the `games` table, timestamps, and Row Level Security.

3. **Environment Setup:**
   - Create a `.env.local` file in the root directory.
   - Add your Supabase URL and Anon Key:
     ```
     VITE_SUPABASE_URL=your_project_url
     VITE_SUPABASE_ANON_KEY=your_anon_key
     ```

4. **Run the local dev server:**
   ```bash
   npm run dev
   ```

Open up two browser windows at `http://localhost:5173/` and test it out!
