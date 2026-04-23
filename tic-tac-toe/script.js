const boardElement = document.getElementById("board");
const boardWrapElement = document.getElementById("boardWrap");
const winLineElement = document.getElementById("winLine");
const statusElement = document.getElementById("status");
const restartButton = document.getElementById("restartBtn");
const newGameButton = document.getElementById("newGameBtn");
const modeSelect = document.getElementById("modeSelect");
const modeTextElement = document.getElementById("modeText");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const roundCountElement = document.getElementById("roundCount");
const xPanelElement = document.getElementById("xPanel");
const oPanelElement = document.getElementById("oPanel");
const xScoreElement = document.getElementById("xScore");
const oScoreElement = document.getElementById("oScore");
const drawScoreElement = document.getElementById("drawScore");
const cells = Array.from(document.querySelectorAll(".cell"));

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

let boardState = Array(9).fill("");
let currentPlayer = "X";
let gameOver = false;
let score = loadScore();
let soundEnabled = true;
let selectedMode = "pvp";
let isAiThinking = false;
let roundsPlayed = 0;

const modeLabels = {
  pvp: "2 Players",
  "ai-easy": "Vs AI (Easy)",
  "ai-hard": "Vs AI (Hard)",
};

function loadScore() {
  try {
    const saved = JSON.parse(localStorage.getItem("ttt-score") || "null");
    if (
      saved &&
      typeof saved.X === "number" &&
      typeof saved.O === "number" &&
      typeof saved.draw === "number"
    ) {
      return saved;
    }
  } catch (error) {
    return { X: 0, O: 0, draw: 0 };
  }
  return { X: 0, O: 0, draw: 0 };
}

function saveScore() {
  localStorage.setItem("ttt-score", JSON.stringify(score));
}

function updateStatus(message) {
  statusElement.textContent = message;
}

function updateModeLabel() {
  modeTextElement.textContent = modeLabels[selectedMode] || "2 Players";
}

function updateRoundDisplay() {
  roundCountElement.textContent = String(roundsPlayed + 1);
}

function setActivePlayerPanel() {
  xPanelElement.classList.toggle("active", currentPlayer === "X" && !gameOver);
  oPanelElement.classList.toggle("active", currentPlayer === "O" && !gameOver);
}

function updateScoreboard() {
  xScoreElement.textContent = String(score.X);
  oScoreElement.textContent = String(score.O);
  drawScoreElement.textContent = String(score.draw);
}

function playTone(freq, duration, volume = 0.04) {
  if (!soundEnabled) {
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }
  const ctx = new AudioContextClass();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
  oscillator.onended = () => ctx.close();
}

function playMoveSound() {
  playTone(currentPlayer === "X" ? 460 : 320, 0.08);
}

function playWinSound() {
  playTone(560, 0.1);
  setTimeout(() => playTone(700, 0.12), 70);
}

function playDrawSound() {
  playTone(300, 0.12);
}

function clearWinLine() {
  winLineElement.classList.remove("show");
  winLineElement.style.width = "0";
}

function drawWinningLine(line) {
  const [start, , end] = line;
  const startCell = cells[start];
  const endCell = cells[end];
  const wrapRect = boardWrapElement.getBoundingClientRect();
  const startRect = startCell.getBoundingClientRect();
  const endRect = endCell.getBoundingClientRect();

  const startX = startRect.left + startRect.width / 2 - wrapRect.left;
  const startY = startRect.top + startRect.height / 2 - wrapRect.top;
  const endX = endRect.left + endRect.width / 2 - wrapRect.left;
  const endY = endRect.top + endRect.height / 2 - wrapRect.top;

  const length = Math.hypot(endX - startX, endY - startY);
  const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;

  winLineElement.style.left = `${startX}px`;
  winLineElement.style.top = `${startY - 3}px`;
  winLineElement.style.transform = `rotate(${angle}deg)`;
  winLineElement.style.setProperty("--line-length", `${length}px`);
  winLineElement.classList.remove("show");
  void winLineElement.offsetWidth;
  winLineElement.classList.add("show");
}

function getWinner() {
  for (const line of winningLines) {
    const [a, b, c] = line;
    if (
      boardState[a] &&
      boardState[a] === boardState[b] &&
      boardState[a] === boardState[c]
    ) {
      return { winner: boardState[a], line };
    }
  }
  return null;
}

function renderBoard() {
  cells.forEach((cell, index) => {
    const value = boardState[index];
    const previousValue = cell.textContent;
    cell.textContent = value;
    cell.classList.remove("x", "o");
    if (value) {
      cell.classList.add(value.toLowerCase());
    }
    if (!previousValue && value) {
      cell.classList.remove("pop");
      void cell.offsetWidth;
      cell.classList.add("pop");
    } else {
      cell.classList.remove("pop");
    }
    cell.disabled = Boolean(value) || gameOver;
    cell.classList.remove("winner");
  });
}

function endGame(result) {
  gameOver = true;
  isAiThinking = false;
  roundsPlayed += 1;
  updateRoundDisplay();
  if (result.winner) {
    score[result.winner] += 1;
    updateStatus(`Player ${result.winner} wins!`);
    result.line.forEach((index) => cells[index].classList.add("winner"));
    drawWinningLine(result.line);
    playWinSound();
  } else {
    score.draw += 1;
    updateStatus("It's a draw!");
    playDrawSound();
  }
  saveScore();
  updateScoreboard();
  setActivePlayerPanel();
  cells.forEach((cell) => {
    if (!cell.textContent) {
      cell.disabled = true;
    }
  });
}

function getEmptyCells(state = boardState) {
  return state.map((value, index) => (value ? null : index)).filter((i) => i !== null);
}

function getBestMove() {
  const ai = "O";
  const human = "X";

  function minimax(state, isMaximizing) {
    const winner = evaluateState(state);
    if (winner === ai) {
      return 1;
    }
    if (winner === human) {
      return -1;
    }
    if (state.every((cell) => cell)) {
      return 0;
    }

    const empties = getEmptyCells(state);
    if (isMaximizing) {
      let best = -Infinity;
      for (const idx of empties) {
        state[idx] = ai;
        best = Math.max(best, minimax(state, false));
        state[idx] = "";
      }
      return best;
    }

    let best = Infinity;
    for (const idx of empties) {
      state[idx] = human;
      best = Math.min(best, minimax(state, true));
      state[idx] = "";
    }
    return best;
  }

  let bestScore = -Infinity;
  let move = getEmptyCells()[0];
  for (const idx of getEmptyCells()) {
    boardState[idx] = ai;
    const scoreValue = minimax(boardState, false);
    boardState[idx] = "";
    if (scoreValue > bestScore) {
      bestScore = scoreValue;
      move = idx;
    }
  }
  return move;
}

function evaluateState(state) {
  for (const [a, b, c] of winningLines) {
    if (state[a] && state[a] === state[b] && state[a] === state[c]) {
      return state[a];
    }
  }
  return null;
}

function maybePlayAiTurn() {
  const aiMode = selectedMode !== "pvp";
  if (!aiMode || gameOver || currentPlayer !== "O") {
    return;
  }
  isAiThinking = true;
  updateStatus("AI is thinking...");
  cells.forEach((cell) => {
    if (!cell.textContent) {
      cell.disabled = true;
    }
  });

  setTimeout(() => {
    if (gameOver) {
      isAiThinking = false;
      return;
    }
    const moveIndex =
      selectedMode === "ai-hard"
        ? getBestMove()
        : getEmptyCells()[Math.floor(Math.random() * getEmptyCells().length)];
    makeMove(moveIndex);
    isAiThinking = false;
  }, 320);
}

function makeMove(cellIndex) {
  if (boardState[cellIndex] || gameOver) {
    return;
  }

  boardState[cellIndex] = currentPlayer;
  playMoveSound();
  renderBoard();

  const result = getWinner();
  if (result) {
    endGame(result);
    return;
  }

  if (boardState.every((cell) => cell)) {
    endGame({ winner: null, line: [] });
    return;
  }

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  setActivePlayerPanel();
  const aiMode = selectedMode !== "pvp";
  if (aiMode && currentPlayer === "O") {
    maybePlayAiTurn();
  } else {
    updateStatus(`Player ${currentPlayer}'s turn`);
  }
}

function handleMove(event) {
  const target = event.target;
  if (!target.classList.contains("cell") || gameOver || isAiThinking) {
    return;
  }
  const cellIndex = Number(target.dataset.index);
  if (selectedMode !== "pvp" && currentPlayer === "O") {
    return;
  }
  makeMove(cellIndex);
}

function resetGame() {
  boardState = Array(9).fill("");
  currentPlayer = "X";
  gameOver = false;
  isAiThinking = false;
  clearWinLine();
  updateStatus("Player X's turn");
  setActivePlayerPanel();
  renderBoard();
}

function startNewMatch() {
  score = { X: 0, O: 0, draw: 0 };
  roundsPlayed = 0;
  saveScore();
  updateScoreboard();
  updateRoundDisplay();
  resetGame();
}

function setMode(mode) {
  selectedMode = mode;
  updateModeLabel();
  resetGame();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundToggleBtn.textContent = soundEnabled ? "Sound: On" : "Sound: Off";
}

boardElement.addEventListener("click", handleMove);
restartButton.addEventListener("click", resetGame);
newGameButton.addEventListener("click", startNewMatch);
modeSelect.addEventListener("change", (event) => setMode(event.target.value));
soundToggleBtn.addEventListener("click", toggleSound);
window.addEventListener("resize", () => {
  if (!gameOver) {
    return;
  }
  const result = getWinner();
  if (result) {
    drawWinningLine(result.line);
  }
});

updateScoreboard();
updateModeLabel();
updateRoundDisplay();
setActivePlayerPanel();
resetGame();
