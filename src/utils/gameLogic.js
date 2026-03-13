import playWords from '../assets/4words_connected.json';
import commonWords from '../assets/4words_common.json';

// Helper to get a random valid start/goal word
export function getRandomWord() {
  const index = Math.floor(Math.random() * commonWords.length);
  return commonWords[index];
}

// Generate starting word and goal words that have NO positional matches (no green letters)
export function generateGameWords() {
  const startWord = getRandomWord();
  let p1Goal = startWord;
  let p2Goal = startWord;

  while (hasPositionalMatches(startWord, p1Goal)) {
    p1Goal = getRandomWord();
  }

  // Ensure p2 doesn't match startWord and ideally isn't exactly p1's goal word
  while (hasPositionalMatches(startWord, p2Goal) || p2Goal === p1Goal) {
    p2Goal = getRandomWord();
  }

  return { start_word: startWord, p1_goal: p1Goal, p2_goal: p2Goal };
}

function hasPositionalMatches(word1, word2) {
  if (word1 === word2) return true;
  for (let i = 0; i < 4; i++) {
    if (word1[i] === word2[i]) return true;
  }
  return false;
}

export function validateTurn(newWord, previousWord, lastModifiedIndex, playedWords, goalWord) {
  const newWordLower = newWord.toLowerCase();

  if (newWordLower.length !== 4) {
    return { valid: false, error: 'Word must be exactly 4 letters.' };
  }

  if (!playWords.includes(newWordLower)) {
    return { valid: false, error: 'Word not in dictionary.' };
  }

  if (playedWords.some(play => play.word === newWordLower)) {
    return { valid: false, error: 'Word has already been played.' };
  }

  let diffCount = 0;
  let modifiedIndex = -1;
  for (let i = 0; i < 4; i++) {
    if (newWordLower[i] !== previousWord[i]) {
      diffCount++;
      modifiedIndex = i;
    }
  }

  if (diffCount !== 1) {
    return { valid: false, error: 'Must change exactly one letter.' };
  }

  // Rule: A player cannot modify the letter position that was just modified by the previous player, 
  // unless doing so will form their goal word and win them the game
  if (modifiedIndex === lastModifiedIndex) {
    if (newWordLower !== goalWord.toLowerCase()) {
      return { valid: false, error: 'Can\'t change a letter twice in a row...\n(Unless winning the game!)' };
    }
  }

  return { valid: true, error: null, modifiedIndex };
}

export function isGameTied(currentWord, lastModifiedIndex, playedWords, p1Goal, p2Goal) {
  const usedWords = new Set(playedWords.map(p => p.word));
  const playWordsSet = new Set(playWords);

  function isReachable(goalWord) {
    const queue = [{ word: currentWord, lastIndex: lastModifiedIndex }];
    const visited = new Set();
    visited.add(currentWord + ':' + lastModifiedIndex);

    if (currentWord === goalWord) return true;

    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];

      if (u.word === goalWord) return true;

      for (let i = 0; i < 4; i++) {
        for (let charCode = 97; charCode <= 122; charCode++) {
          const letter = String.fromCharCode(charCode);
          if (letter === u.word[i]) continue;

          const nextWord = u.word.substring(0, i) + letter + u.word.substring(i + 1);

          if (!playWordsSet.has(nextWord)) continue;
          if (usedWords.has(nextWord)) continue;

          if (i === u.lastIndex && nextWord !== goalWord) continue;

          if (nextWord === goalWord) return true;

          const stateKey = nextWord + ':' + i;
          if (!visited.has(stateKey)) {
            visited.add(stateKey);
            queue.push({ word: nextWord, lastIndex: i });
          }
        }
      }
    }
    return false;
  }

  return !isReachable(p1Goal) && !isReachable(p2Goal);
}
