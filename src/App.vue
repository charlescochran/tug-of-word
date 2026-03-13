<template>
  <div id="app">
    <!-- Letter-box title (always shown, color adapts to context) -->
    <div class="letterbox-title">
      <div v-for="letter in ['T','U','G']" :key="'title-'+letter" class="letter-box" :class="titleLetterClass" :style="titleLetterStyle">{{ letter }}</div>
      <div v-for="letter in ['O','F']" :key="'title-'+letter" class="letter-box">{{ letter }}</div>
      <div v-for="letter in ['W','O','R','D']" :key="'title2-'+letter" class="letter-box" :class="titleLetterClass" :style="titleLetterStyle">{{ letter }}</div>
    </div>
    <div class="glass-panel" :class="{ 'lobby-panel': !gameState }">
      <Lobby 
        v-if="!gameState" 
        @game-joined="onGameJoined" 
      />
      <GameBoard 
        v-else 
        :game="gameState" 
        :playerId="playerId" 
        @leave-game="onLeaveGame"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue';
import Lobby from './components/Lobby.vue';
import GameBoard from './components/GameBoard.vue';

const gameState = ref(null);
const playerId = ref(null);

watchEffect(() => {
  if (gameState.value?.access_code) {
    let h = 2166136261;
    const code = gameState.value.access_code;
    for (let i = 0; i < code.length; i++) {
       h ^= code.charCodeAt(i);
       h = Math.imul(h, 16777619);
    }
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
    
    const hue1 = (h >>> 0) % 360;
    const hue2 = (hue1 + 180) % 360; // Perfect complementary opposite color
    
    const s = 100;
    const l = 65;
    
    // HSL to RGB conversion for box-shadow pulse animation
    const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
    const x = c * (1 - Math.abs((hue1 / 60) % 2 - 1));
    const m = l / 100 - c / 2;
    let r1, g1, b1;
    if (hue1 < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (hue1 < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (hue1 < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (hue1 < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (hue1 < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const rgb1 = `${Math.round((r1 + m) * 255)}, ${Math.round((g1 + m) * 255)}, ${Math.round((b1 + m) * 255)}`;

    document.documentElement.style.setProperty('--p1-color', `hsl(${hue1}, ${s}%, ${l}%)`);
    document.documentElement.style.setProperty('--p2-color', `hsl(${hue2}, ${s}%, ${l}%)`);
    document.documentElement.style.setProperty('--p1-color-rgb', rgb1);
    document.documentElement.style.setProperty('--p1-shadow', `hsla(${hue1}, ${s}%, ${l}%, 0.4)`);
    document.documentElement.style.setProperty('--p2-shadow', `hsla(${hue2}, ${s}%, ${l}%, 0.4)`);
  } else {
    // Reset to defaults for lobby
    document.documentElement.style.removeProperty('--p1-color');
    document.documentElement.style.removeProperty('--p2-color');
    document.documentElement.style.removeProperty('--p1-color-rgb');
    document.documentElement.style.removeProperty('--p1-shadow');
    document.documentElement.style.removeProperty('--p2-shadow');
  }
});

const titleLetterClass = computed(() => {
  if (!gameState.value) return 'p1-modified'; // Default blue in lobby
  return ''; // In-game: use inline styles instead
});

const titleLetterStyle = computed(() => {
  if (!gameState.value || !playerId.value) return {};
  const isP1 = playerId.value === gameState.value.player1_id;
  const color = isP1 ? 'var(--p1-color)' : 'var(--p2-color)';
  return {
    color: color,
    borderColor: color,
    textShadow: `0 0 10px ${color}`,
    boxShadow: `inset 0 0 10px ${isP1 ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 0, 127, 0.2)'}`
  };
});

function onGameJoined(payload) {
  gameState.value = payload.game;
  playerId.value = payload.playerId;
}

function onLeaveGame() {
  gameState.value = null;
  playerId.value = null;
}
</script>
