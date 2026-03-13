<template>
  <div class="lobby-container animate-fade">
    <div v-if="loading" class="status-message">Connecting to game...</div>
    <template v-else>
      <div class="lobby-content" style="max-width: 450px; margin: 0 auto; width: 100%;">

        <div style="background: rgba(0, 0, 0, 0.25); border-radius: 16px; padding: 2.5rem 2rem; box-shadow: inset 0 4px 15px rgba(0, 0, 0, 0.5); border: 1px solid rgba(0, 0, 0, 0.3); margin: auto 0; position: relative;">
          <div>
             <button class="primary" @click="createGame" style="width: 100%; padding: 1.2rem; font-size: 1.1rem; letter-spacing: 2px;">Create Game</button>
          </div>
          
          <div class="lobby-divider" style="margin: 2rem 0;">
             <span style="font-size: 0.9rem; font-weight: 700; color: #fff; letter-spacing: 2px;">OR</span>
          </div>
          
          <div class="join-section" style="display: flex; flex-direction: column; gap: 0;">
            <input 
              ref="codeInput"
              v-model="joinCode" 
              type="text" 
              maxlength="4" 
              placeholder="ENTER GAME CODE" 
              @keyup.enter.prevent="joinCode.length === 4 ? joinGame() : null"
              style="font-size: 0.9rem; padding: 1rem; letter-spacing: 6px; background: rgba(0,0,0,0.4); border: 2px solid rgba(255,255,255,0.1); width: 100%; box-sizing: border-box; border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;"
            />
            <button class="secondary" style="width: 100%; padding: 0.8rem; font-size: 1rem; letter-spacing: 2px; border-top-left-radius: 0; border-top-right-radius: 0;" @click="joinGame" :disabled="joinCode.length !== 4">
              Join Game
            </button>
          </div>
          <div class="error-message" :class="{ 'error-visible': isErrorVisible }" style="text-align: center; position: absolute; left: 0; right: 0; bottom: -2.5rem;">{{ errorMessage || ' ' }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { supabase, generateAccessCode } from '../services/supabase';
import { generateGameWords } from '../utils/gameLogic';

const emit = defineEmits(['game-joined']);

const joinCode = ref('');
const errorMessage = ref('');
const isErrorVisible = ref(false);
const loading = ref(false);
const codeInput = ref(null);

onMounted(() => {
  if (codeInput.value) {
    codeInput.value.focus();
  }
});

function saveSession(code, playerId) {
  localStorage.setItem('tugOfWord_latest', JSON.stringify({ code, playerId }));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem('tugOfWord_latest'));
  } catch (e) {
    return null;
  }
}

let errorTimeout = null;
function showError(msg) {
  errorMessage.value = msg;
  isErrorVisible.value = true;
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => {
    isErrorVisible.value = false;
  }, 3500);
}

async function createGame() {
  loading.value = true;
  isErrorVisible.value = false;
  const accessCode = generateAccessCode();
  const words = generateGameWords();
  const playerId = 'p1_' + Math.random().toString(36).substr(2, 9);
  
  const { data, error } = await supabase
    .from('games')
    .insert([{
      access_code: accessCode,
      player1_id: playerId,
      status: 'waiting',
      start_word: words.start_word,
      p1_goal: words.p1_goal,
      p2_goal: words.p2_goal,
      words: [],
      current_turn_player_id: playerId
    }])
    .select()
    .single();
    
  if (error) {
    showError('Failed to create game. Check connection/environment variables.');
    console.error(error);
    loading.value = false;
    return;
  }
  
  saveSession(accessCode, playerId);
  emit('game-joined', { game: data, playerId });
}

async function joinGame() {
  const code = joinCode.value.toUpperCase();
  if (code.length !== 4) return;
  
  loading.value = true;
  isErrorVisible.value = false;
  
  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('access_code', code)
    .maybeSingle();
    
  if (error || !game) {
    showError('Game not found.');
    loading.value = false;
    return;
  }
  
  if (game.status !== 'waiting' && game.status !== 'in_progress' && !game.status.includes('proposes')) {
    showError('Game already finished.');
    loading.value = false;
    return;
  }

  showError("Reconnecting... detecting empty seat.");
  
  const channel = supabase.channel(`game_${code}`);
  let handled = false;

  const handlePresence = async (activeIds) => {
      if (handled) return;
      handled = true;
      supabase.removeChannel(channel);
      
      let assignedId = null;
      
      if (game.status === 'waiting') {
         if (activeIds.includes(game.player1_id)) {
            // P1 is actively waiting, so this new connection must be P2!
            assignedId = 'p2_' + Math.random().toString(36).substr(2, 9);
            const startingPlayerId = Math.random() < 0.5 ? game.player1_id : assignedId;
            const { data: updatedGame, error: updateError } = await supabase
              .from('games')
              .update({ player2_id: assignedId, status: 'in_progress', current_turn_player_id: startingPlayerId })
              .eq('id', game.id)
              .select().single();
              
            if (updateError) {
              showError('Failed to join game.');
              loading.value = false;
              return;
            }
            saveSession(code, assignedId);
            emit('game-joined', { game: updatedGame, playerId: assignedId });
            return;
         } else {
            // P1 is NOT active. P1 must have disconnected and is now returning.
            assignedId = game.player1_id; 
            saveSession(code, assignedId);
            emit('game-joined', { game, playerId: assignedId });
            return;
         }
      } else {
         // IN PROGRESS
         if (activeIds.includes(game.player1_id) && !activeIds.includes(game.player2_id)) {
            assignedId = game.player2_id;
         } else if (activeIds.includes(game.player2_id) && !activeIds.includes(game.player1_id)) {
            assignedId = game.player1_id;
         } else if (activeIds.length === 0) {
            // Both offline! Check local storage.
            const session = getSession();
            if (session && session.code === code) {
                assignedId = session.playerId;
            } else {
                assignedId = game.player1_id; // Arbitrary fallback
            }
         } else {
             showError('Game is full.');
             loading.value = false;
             return;
         }
         
         saveSession(code, assignedId);
         emit('game-joined', { game, playerId: assignedId });
      }
  };

  channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      handlePresence(Object.keys(state));
  }).subscribe((status) => {
      if (status === 'SUBSCRIBED') {
          setTimeout(() => {
              if (!handled) handlePresence([]);
          }, 1000);
      }
  });
}
</script>
