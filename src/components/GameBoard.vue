<template>
  <div class="game-board animate-fade">

    <div class="game-code-box">
      <span class="game-code-label">Game Code</span>
      <span class="game-code-value" :style="{ color: myColor, textShadow: '0 0 8px ' + myShadowColor }">{{ gameData.access_code }}</span>
    </div>

    <div v-if="gameData.status === 'waiting'" class="waiting-container">
      <div class="pulse-ring"></div>
      <p class="animate-pulse-slow status-message" style="margin-top: 1rem;">Waiting for Player 2...</p>
    </div>

    <template v-else>
      <div v-if="gameData.status === 'in_progress'" class="status-message">
        <span v-if="isMyTurn">Your Turn!</span>
        <span v-else class="animate-pulse-slow" style="opacity: 0.7">Waiting for Opponent...</span>
      </div>
      <div v-else-if="gameData.status === 'p1_proposes_draw' || gameData.status === 'p2_proposes_draw'" class="status-message">
        <template v-if="(gameData.status === 'p1_proposes_draw' && !isPlayer1) || (gameData.status === 'p2_proposes_draw' && isPlayer1)">
          Opponent offered a draw.
          <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; justify-content: center;">
            <button class="text-btn secondary" @click="acceptDraw">Accept</button>
            <button class="text-btn secondary" @click="declineDraw">Decline</button>
          </div>
        </template>
        <template v-else>
          <span class="animate-pulse-slow" style="opacity: 0.7">Waiting for opponent to accept draw...</span>
        </template>
      </div>

      <div class="scrollback" ref="scrollbackDiv">
        <div class="word-display">
          <div class="letter-box" v-for="(letter, idx) in gameData.start_word" :key="'start-'+idx">
            {{ letter }}
          </div>
        </div>

        <div class="word-display" v-for="(play, i) in gameData.words" :key="'play-'+i">
          <div
            v-for="(letter, idx) in play.word"
            :key="'play-'+i+'-'+idx"
            class="letter-box"
            :class="{
              'p1-modified': play.player_id === gameData.player1_id && play.modified_index === idx,
              'p2-modified': play.player_id === gameData.player2_id && play.modified_index === idx
            }"
          >
            {{ letter }}
          </div>
        </div>
      </div>

      <div class="current-play-area" v-if="gameData.status === 'in_progress' && isMyTurn">
        <div class="error-message" :class="{ 'error-visible': isErrorVisible }">{{ errorMessage || ' ' }}</div>
        <div class="word-display">
           <input 
             ref="wordInput"
             v-model="currentInput" 
             type="text" 
             maxlength="4" 
             @keyup.enter="submitTurn"
             placeholder="Type a word"
           />
        </div>
        <button class="primary" :style="{ '--btn-color': myColor, '--btn-shadow': myShadowColor }" @click="submitTurn" style="color: black;">Submit</button>
      </div>

      <div class="goal-area">
        <div class="goal-label">Your Secret Goal</div>
        <div class="word-display goal-word">
          <div class="letter-box" v-for="(letter, idx) in myGoal" :key="'goal-'+idx">
            {{ letter }}
          </div>
        </div>
      </div>

      <div class="match-actions" v-if="gameData.status === 'in_progress' || gameData.status.includes('proposes')">
        <button class="text-btn danger" @click="confirmResign">Resign</button>
        <button class="text-btn secondary" @click="confirmDraw" v-if="gameData.status === 'in_progress'">Offer Draw</button>
      </div>

      <!-- Custom Confirmation Modal -->
      <Teleport to="body">
        <div v-if="showConfirmModal" class="modal-overlay">
          <div class="modal-content animate-fade">
            <p style="margin-bottom: 2rem;">{{ confirmMessage }}</p>
            <div style="display: flex; gap: 1rem; justify-content: center; align-items: stretch; width: 100%;">
              <button class="primary" :style="{ '--btn-color': myColor, '--btn-shadow': myShadowColor }" @click="executeConfirm" style="color: black; flex: 1; padding: 0.8rem;">Yes</button>
              <button class="text-btn secondary" @click="closeConfirm" style="flex: 1; padding: 0.8rem; margin: 0;">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Start Game Modal -->
        <div v-if="showStartModal && gameData.status === 'in_progress'" class="modal-overlay" @click="closeStartModal">
          <div class="modal-content animate-fade" @click.stop>
            <h2 style="color: var(--text-bright); margin-bottom: 1rem;">Your Secret Goal</h2>
            <div class="word-display goal-word" style="margin-bottom: 1.5rem;">
              <div class="letter-box" v-for="(letter, idx) in myGoal" :key="'startmodal-'+idx">
                {{ letter }}
              </div>
            </div>
            <p style="font-size: 0.95rem; margin-bottom: 1.5rem; color: var(--text-main);">
              Change one letter at a time to reach this word before your opponent reaches theirs!
            </p>
            <button class="primary" :style="{ '--btn-color': myColor, '--btn-shadow': myShadowColor }" @click="closeStartModal" style="color: black;">Let's Go!</button>
          </div>
        </div>

        <!-- Game Over Modal -->
        <div v-if="isGameOver" class="modal-overlay">
          <div class="modal-content animate-fade">
            <h2 :style="{ color: gameOverColor, marginBottom: '1rem', fontSize: '2rem' }">{{ gameOverTitle }}</h2>
            <p style="margin-bottom: 2rem;">{{ gameOverMessage }}</p>
            <button class="text-btn secondary" @click="leaveGracefully">Back to Lobby</button>
          </div>
        </div>
      </Teleport>
      
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { supabase } from '../services/supabase';
import { validateTurn, isGameTied } from '../utils/gameLogic';

const props = defineProps({
  game: Object,
  playerId: String
});
const emit = defineEmits(['leave-game']);

const gameData = ref(props.game);
const currentInput = ref('');
const errorMessage = ref('');
const isErrorVisible = ref(false);
const scrollbackDiv = ref(null);
const wordInput = ref(null);
let channel = null;
let activePlayersCount = ref(1); // Default to just us

const showConfirmModal = ref(false);
const confirmMessage = ref('');
let confirmAction = null;

function promptConfirm(message, action) {
  confirmMessage.value = message;
  confirmAction = action;
  showConfirmModal.value = true;
}

function executeConfirm() {
  if (confirmAction) confirmAction();
  closeConfirm();
}

function closeConfirm() {
  showConfirmModal.value = false;
  confirmAction = null;
}

const isPlayer1 = computed(() => props.playerId === gameData.value.player1_id);
const myGoal = computed(() => isPlayer1.value ? gameData.value.p1_goal : gameData.value.p2_goal);
const isMyTurn = computed(() => gameData.value.current_turn_player_id === props.playerId);

const myColor = computed(() => isPlayer1.value ? 'var(--p1-color)' : 'var(--p2-color)');
const myShadowColor = computed(() => isPlayer1.value ? 'var(--p1-shadow)' : 'var(--p2-shadow)');

const showStartModal = ref(props.game.words.length === 0);
function closeStartModal() { 
  showStartModal.value = false; 
  // Focus the input box immediately after closing the modal if it's our turn
  if (isMyTurn.value) {
    nextTick(() => { if (wordInput.value) wordInput.value.focus(); });
  }
}

function handleGlobalKeydown(e) {
  if (showStartModal.value && (e.key === 'Enter' || e.key === 'Escape')) {
    closeStartModal();
  }
}

const isGameOver = computed(() => ['p1_won', 'p2_won', 'tied', 'p1_resigned', 'p2_resigned', 'p1_accepted_draw', 'p2_accepted_draw'].includes(gameData.value.status));

const gameOverTitle = computed(() => {
  if (gameData.value.status === 'tied') return "It's a Tie!";
  if (gameData.value.status.includes('accepted_draw')) return "It's a Draw!";
  if (gameData.value.status.includes('won')) {
    const p1Won = gameData.value.status === 'p1_won';
    return (p1Won && isPlayer1.value) || (!p1Won && !isPlayer1.value) ? "You Win!" : "You Lose!";
  }
  if (gameData.value.status.includes('resigned')) {
    const p1Resigned = gameData.value.status === 'p1_resigned';
    return (p1Resigned && isPlayer1.value) || (!p1Resigned && !isPlayer1.value) ? "You Resigned!" : "Opponent Resigned!";
  }
  return "Game Over";
});

const gameOverMessage = computed(() => {
  if (gameData.value.status === 'tied') return "The word ladder is stuck. Neither player can reach their goal!";
  if (gameData.value.status.includes('accepted_draw')) {
    const iAccepted = (gameData.value.status === 'p1_accepted_draw' && isPlayer1.value) || (gameData.value.status === 'p2_accepted_draw' && !isPlayer1.value);
    return iAccepted ? "You accepted the draw request." : "Your opponent accepted the draw request.";
  }
  if (gameData.value.status.includes('won')) {
    const p1Won = gameData.value.status === 'p1_won';
    return (p1Won && isPlayer1.value) || (!p1Won && !isPlayer1.value) ? "You reached your goal word!" : "Your opponent reached their goal word.";
  }
  if (gameData.value.status.includes('resigned')) {
    const p1Resigned = gameData.value.status === 'p1_resigned';
    return (p1Resigned && isPlayer1.value) || (!p1Resigned && !isPlayer1.value) ? "You forfeited the match." : "You win!";
  }
  return "";
});

const gameOverColor = computed(() => {
  if (gameData.value.status === 'tied' || gameData.value.status.includes('accepted_draw')) return "var(--text-bright)";
  
  if (gameData.value.status.includes('resigned')) {
    const p1Resigned = gameData.value.status === 'p1_resigned';
    // If I resigned, show error color. If they resigned, show my player color (I won!)
    if ((p1Resigned && isPlayer1.value) || (!p1Resigned && !isPlayer1.value)) {
       return "var(--error-color)";
    } else {
       return myColor.value;
    }
  }

  if (gameData.value.status.includes('won')) {
    const p1Won = gameData.value.status === 'p1_won';
    const iWon = (p1Won && isPlayer1.value) || (!p1Won && !isPlayer1.value);
    return iWon ? myColor.value : "var(--error-color)";
  }

  return myColor.value;
});

const previousWord = computed(() => {
  const words = gameData.value.words;
  if (words && words.length > 0) return words[words.length - 1].word;
  return gameData.value.start_word;
});

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  
  channel = supabase.channel(`game_${props.game.access_code}`, {
    config: { presence: { key: props.playerId } }
  });
  
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      activePlayersCount.value = Object.keys(state).length;
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${props.game.id}` }, (payload) => {
      gameData.value = payload.new;
      errorMessage.value = '';
      
      // Auto-close confirmation modals if the game ends abruptly (like an opponent resigning)
      if (['p1_won', 'p2_won', 'tied', 'p1_resigned', 'p2_resigned', 'p1_accepted_draw', 'p2_accepted_draw'].includes(payload.new.status)) {
        closeConfirm();
      }
      
      scrollToBottom();
      
      // Auto-focus input when it becomes our turn
      if (payload.new.status === 'in_progress' && payload.new.current_turn_player_id === props.playerId) {
        nextTick(() => {
          if (wordInput.value) wordInput.value.focus();
        });
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'games', filter: `id=eq.${props.game.id}` }, () => {
      // The other player deleted the game while we were looking at it!
      emit('leave-game');
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });
});

async function cleanupGameIfLast() {
  if (activePlayersCount.value <= 1) {
    // We are the absolute last person observing this game! Wipe the row securely.
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/games?id=eq.${gameData.value.id}`;
    
    try {
      await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        keepalive: true
      });
    } catch(e) { /* ignore */ }
  }
}

function handleBeforeUnload(e) {
  cleanupGameIfLast();
}

async function leaveGracefully() {
  await cleanupGameIfLast();
  emit('leave-game');
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  
  if (gameData.value.status !== 'waiting') {
     cleanupGameIfLast();
  }

  if (channel) {
    supabase.removeChannel(channel);
  }
});

function scrollToBottom() {
  nextTick(() => {
    if (scrollbackDiv.value) {
      scrollbackDiv.value.scrollTop = scrollbackDiv.value.scrollHeight;
    }
  });
}

function confirmResign() {
  promptConfirm("Are you sure you want to resign?", () => {
    // You can resign at any point unless the game is already over
    updateGameStatus(isPlayer1.value ? 'p1_resigned' : 'p2_resigned', ['in_progress', 'p1_proposes_draw', 'p2_proposes_draw']);
  });
}

function confirmDraw() {
  promptConfirm("Are you sure you want to offer a draw?", () => {
    // You can only offer a draw if the game is actively in progress
    updateGameStatus(isPlayer1.value ? 'p1_proposes_draw' : 'p2_proposes_draw', ['in_progress']);
  });
}

async function acceptDraw() {
  const expectedStatus = isPlayer1.value ? 'p2_proposes_draw' : 'p1_proposes_draw';
  await updateGameStatus(isPlayer1.value ? 'p1_accepted_draw' : 'p2_accepted_draw', [expectedStatus]);
}

async function declineDraw() {
  const expectedStatus = isPlayer1.value ? 'p2_proposes_draw' : 'p1_proposes_draw';
  await updateGameStatus('in_progress', [expectedStatus]);
}

async function updateGameStatus(newStatus, validCurrentStatuses = null) {
  let query = supabase.from('games').update({ status: newStatus }).eq('id', gameData.value.id);
  
  if (validCurrentStatuses && validCurrentStatuses.length > 0) {
    query = query.in('status', validCurrentStatuses);
  }
  
  const { error } = await query;
  if (error) console.error("Failed to update status", error);
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

async function submitTurn() {
  const newWord = currentInput.value.trim().toLowerCase();
  isErrorVisible.value = false;
  
  const allPlayedWords = [
    { word: gameData.value.start_word },
    ...(gameData.value.words || [])
  ];

  const validation = validateTurn(
    newWord,
    previousWord.value,
    gameData.value.last_modified_index,
    allPlayedWords,
    myGoal.value
  );
  
  if (!validation.valid) {
    showError(validation.error);
    return;
  }
  
  const modifiedIndex = validation.modifiedIndex;
  const newPlay = { word: newWord, player_id: props.playerId, modified_index: modifiedIndex };
  const updatedWords = [...(gameData.value.words || []), newPlay];
  const updatedWordsForTieCheck = [...allPlayedWords, newPlay];
  
  let newStatus = gameData.value.status;
  const opponentGoal = isPlayer1.value ? gameData.value.p2_goal : gameData.value.p1_goal;
  
  if (newWord === myGoal.value.toLowerCase()) {
    // Player reached their own goal — they win!
    newStatus = isPlayer1.value ? 'p1_won' : 'p2_won';
  } else if (newWord === opponentGoal.toLowerCase()) {
    // Player accidentally played the opponent's goal — opponent wins!
    newStatus = isPlayer1.value ? 'p2_won' : 'p1_won';
  } else {
    // Check if the move created a tie (neither goal reachable)
    if (isGameTied(newWord, modifiedIndex, updatedWordsForTieCheck, gameData.value.p1_goal, gameData.value.p2_goal)) {
      newStatus = 'tied';
    }
  }
  
  const nextPlayerId = isPlayer1.value ? gameData.value.player2_id : gameData.value.player1_id;
  
  // Optimistic UI update for perceived instantaneous rendering
  gameData.value = {
    ...gameData.value,
    words: updatedWords,
    last_modified_index: modifiedIndex,
    current_turn_player_id: nextPlayerId,
    status: newStatus
  };
  currentInput.value = '';
  scrollToBottom();
  
  const { error } = await supabase
    .from('games')
    .update({
      words: updatedWords,
      last_modified_index: modifiedIndex,
      current_turn_player_id: nextPlayerId,
      status: newStatus
    })
    .eq('id', gameData.value.id)
    .eq('status', 'in_progress');
    
  if (error) {
    showError('Failed to submit move.');
    console.error(error);
  } else {
    currentInput.value = '';
  }
}
</script>
