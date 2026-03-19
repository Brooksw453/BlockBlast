/* ============================================
   Block Blast // Neon Edition — Game Logic
   ============================================ */

// ---------- Game Configuration ----------
const rows = 8;
const cols = 8;
let board = [];
let score = 0;
let displayedScore = 0;
let highScore = 0;
let gameOver = false;

// Combo & streak
let combo = 0;
let lastPlacementCleared = false;

// ---------- Block Shapes ----------
const shapes = [
  [[0,0]],                                         // Single block
  [[0,0],[1,0]],                                   // 2-block horizontal
  [[0,0],[1,0],[2,0]],                             // 3-block horizontal
  [[0,0],[0,1]],                                   // 2-block vertical
  [[0,0],[0,1],[0,2]],                             // 3-block vertical
  [[0,0],[1,0],[0,1]],                             // L shape (3)
  [[0,0],[1,0],[2,0],[1,1]],                       // T shape (4)
  [[0,0],[1,0],[0,1],[1,1]],                       // 2x2 square
  [[0,0],[1,0],[2,0],[3,0]],                       // 4-block horizontal
  [[0,0],[0,1],[0,2],[0,3]],                       // 4-block vertical
  // New shapes for variety
  [[0,0],[0,1],[0,2],[1,2],[2,2]],                 // 5-block L
  [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]], // 3x3 square
  [[0,0],[1,0],[1,1],[2,1]],                       // Zigzag horizontal
  [[0,0],[0,1],[1,1],[1,2]],                       // Zigzag vertical
  [[1,0],[0,1],[1,1],[2,1],[1,2]],                 // Plus/cross
  [[0,0],[1,0],[2,0],[3,0],[4,0]],                 // 5-block horizontal
  [[0,0],[0,1],[0,2],[0,3],[0,4]],                 // 5-block vertical
  [[0,0],[1,0],[2,0],[2,1]],                       // L shape (4, right)
  [[0,0],[1,0],[0,1],[0,2]],                       // L shape (4, left)
];
const maxColorIndex = 6;

// ---------- Piece Tray ----------
let pieceTray = [];
let currentPieceIndex = 0;
let movingPiece = false;
let currentPieceRow = 0;
let currentPieceCol = 0;

// ---------- Drag State ----------
let isDragging = false;
let dragGhost = null;

// ---------- DOM References ----------
const startMenu = document.getElementById('startMenu');
const gameContainer = document.getElementById('gameContainer');
const scoreSpan = document.getElementById('score');
const highScoreSpan = document.getElementById('highScore');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const gameBoardElement = document.getElementById('gameBoard');
const pieceTrayElement = document.getElementById('pieceTray');
const gameOverOverlay = document.getElementById('gameOver');
const finalScoreSpan = document.getElementById('finalScore');
const gameOverHighScore = document.getElementById('gameOverHighScore');
const comboDisplay = document.getElementById('comboDisplay');
const comboCount = document.getElementById('comboCount');

// Buttons
const startButton = document.getElementById('startButton');
const settingsButton = document.getElementById('settingsButton');
const openSettingsButton = document.getElementById('openSettings');
const closeSettingsButton = document.getElementById('closeSettings');
const restartButton = document.getElementById('restartButton');

// Audio
const placeSound = document.getElementById('placeSound');
const clearSound = document.getElementById('clearSound');
const gameoverSound = document.getElementById('gameoverSound');
const sfxVolumeSlider = document.getElementById('sfxVolume');

// ---------- Sound Helper ----------
let audioUnlocked = false;

// Unlock audio on first user interaction (required by browsers & iframes)
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // Create and play a silent buffer to unlock the audio context
  const sounds = [placeSound, clearSound, gameoverSound];
  sounds.forEach(s => {
    if (s) {
      s.volume = 0;
      s.play().then(() => {
        s.pause();
        s.currentTime = 0;
        s.volume = parseFloat(sfxVolumeSlider.value);
      }).catch(() => {});
    }
  });

  // Remove listeners after unlock
  document.removeEventListener('touchstart', unlockAudio);
  document.removeEventListener('mousedown', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('mousedown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

function playSound(sound) {
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

// ---------- Board ----------
function initBoard() {
  board = [];
  gameBoardElement.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = 0;
      const cell = document.createElement('div');
      cell.classList.add('cell');
      gameBoardElement.appendChild(cell);
    }
  }
}

function renderBoard() {
  const cells = gameBoardElement.getElementsByClassName('cell');
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellElem = cells[index];
      cellElem.className = 'cell';
      const value = board[r][c];
      if (value > 0) {
        cellElem.classList.add('filled' + value);
      }
      index++;
    }
  }
}

// ---------- Piece Generation ----------
function generatePieces() {
  pieceTray = [];
  for (let i = 0; i < 3; i++) {
    const shapeIndex = Math.floor(Math.random() * shapes.length);
    const shape = shapes[shapeIndex];
    const color = Math.floor(Math.random() * maxColorIndex) + 1;
    pieceTray.push({ shape, color, placed: false });
  }
  currentPieceIndex = 0;
  movingPiece = false;
  renderPieceTray();
}

// ---------- Piece Tray Rendering ----------
function renderPieceTray() {
  pieceTrayElement.innerHTML = '';
  pieceTray.forEach((piece, index) => {
    const pieceDiv = document.createElement('div');
    pieceDiv.classList.add('piece');
    if (index === currentPieceIndex && !movingPiece) {
      pieceDiv.classList.add('selected');
    }
    if (piece.placed) {
      pieceDiv.style.opacity = '0.2';
      pieceDiv.style.pointerEvents = 'none';
    }

    // Calculate shape bounds for centering
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    piece.shape.forEach(([dx, dy]) => {
      minX = Math.min(minX, dx);
      minY = Math.min(minY, dy);
      maxX = Math.max(maxX, dx);
      maxY = Math.max(maxY, dy);
    });
    const shapeWidth = maxX - minX + 1;
    const shapeHeight = maxY - minY + 1;
    const maxDim = Math.max(shapeWidth, shapeHeight, 4);
    const blockSize = 18;
    const offsetX = Math.floor((maxDim - shapeWidth) / 2);
    const offsetY = Math.floor((maxDim - shapeHeight) / 2);

    piece.shape.forEach(([dx, dy]) => {
      const mini = document.createElement('div');
      mini.classList.add('mini-block');
      if (piece.color) mini.classList.add('mini' + piece.color);
      mini.style.left = (dx - minX + offsetX) * blockSize + 'px';
      mini.style.top = (dy - minY + offsetY) * blockSize + 'px';
      pieceDiv.appendChild(mini);
    });

    // Mouse drag
    pieceDiv.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (piece.placed) return;
      startDrag(index, e.clientX, e.clientY, false);
    });

    // Touch drag — single continuous gesture: touch piece → drag to board → release
    pieceDiv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (piece.placed) return;
      const touch = e.touches[0];
      startDrag(index, touch.clientX, touch.clientY, true);
    }, { passive: false });

    pieceTrayElement.appendChild(pieceDiv);
  });
}

// ---------- Placement Logic ----------
function canPlacePiece(piece, topLeftRow, topLeftCol) {
  for (const [dx, dy] of piece.shape) {
    const r = topLeftRow + dy;
    const c = topLeftCol + dx;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    if (board[r][c] !== 0) return false;
  }
  return true;
}

function placePieceOnBoard(piece, topLeftRow, topLeftCol) {
  for (const [dx, dy] of piece.shape) {
    const r = topLeftRow + dy;
    const c = topLeftCol + dx;
    board[r][c] = piece.color;
  }
}

// ---------- Preview ----------
function clearPreview() {
  const cells = gameBoardElement.getElementsByClassName('cell');
  for (let cell of cells) {
    cell.classList.remove('preview', 'invalid',
      'preview-1', 'preview-2', 'preview-3',
      'preview-4', 'preview-5', 'preview-6');
  }
}

function showPreview(piece, topLeftRow, topLeftCol) {
  clearPreview();
  let valid = true;

  for (const [dx, dy] of piece.shape) {
    const r = topLeftRow + dy;
    const c = topLeftCol + dx;
    if (r < 0 || r >= rows || c < 0 || c >= cols || board[r][c] !== 0) {
      valid = false;
      break;
    }
  }

  for (const [dx, dy] of piece.shape) {
    const r = topLeftRow + dy;
    const c = topLeftCol + dx;
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    const cellIndex = r * cols + c;
    const cellElem = gameBoardElement.getElementsByClassName('cell')[cellIndex];
    cellElem.classList.add('preview');
    cellElem.classList.add('preview-' + piece.color);
    if (!valid) cellElem.classList.add('invalid');
  }

  return valid;
}

// ---------- Line Clearing ----------
// Check and clear full rows/columns. Returns { count, cells } for this pass only.
function clearFullLines() {
  let linesCleared = 0;
  const clearedCells = [];

  // Check rows
  for (let r = 0; r < rows; r++) {
    let full = true;
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === 0) { full = false; break; }
    }
    if (full) {
      linesCleared++;
      for (let c = 0; c < cols; c++) {
        clearedCells.push({ r, c, color: board[r][c] });
        const cellElem = gameBoardElement.getElementsByClassName('cell')[r * cols + c];
        cellElem.classList.add('clearing');
      }
      for (let c = 0; c < cols; c++) board[r][c] = 0;
    }
  }

  // Check columns
  for (let c = 0; c < cols; c++) {
    let full = true;
    for (let r = 0; r < rows; r++) {
      if (board[r][c] === 0) { full = false; break; }
    }
    if (full) {
      linesCleared++;
      for (let r = 0; r < rows; r++) {
        if (!clearedCells.some(cell => cell.r === r && cell.c === c)) {
          clearedCells.push({ r, c, color: board[r][c] });
        }
        const cellElem = gameBoardElement.getElementsByClassName('cell')[r * cols + c];
        cellElem.classList.add('clearing');
      }
      for (let r = 0; r < rows; r++) board[r][c] = 0;
    }
  }

  if (linesCleared > 0) {
    playSound(clearSound);
  }

  return { count: linesCleared, cells: clearedCells };
}

// ---------- Gravity ----------
// Drop blocks down to fill empty gaps. Returns array of { fromR, fromC, toR, color } moves.
function applyGravity() {
  const moves = [];

  for (let c = 0; c < cols; c++) {
    // Start from bottom, find empty cells and pull blocks down
    let writeRow = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (board[r][c] !== 0) {
        if (r !== writeRow) {
          moves.push({ fromR: r, fromC: c, toR: writeRow, color: board[r][c] });
          board[writeRow][c] = board[r][c];
          board[r][c] = 0;
        }
        writeRow--;
      }
    }
  }

  return moves;
}

// Animate gravity drops on the DOM, then re-render
function animateGravityDrops(moves, callback) {
  if (moves.length === 0) {
    callback();
    return;
  }

  const cells = gameBoardElement.getElementsByClassName('cell');

  moves.forEach(({ fromR, fromC, toR, color }) => {
    const fromIndex = fromR * cols + fromC;
    const toIndex = toR * cols + fromC;
    const fromElem = cells[fromIndex];
    const toElem = cells[toIndex];
    const cellHeight = fromElem.getBoundingClientRect().height + 4; // include gap
    const dropDistance = (toR - fromR) * cellHeight;

    // Temporarily show the block at its original position with a drop animation
    fromElem.classList.add('filled' + color);
    fromElem.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    fromElem.style.transform = `translateY(${dropDistance}px)`;
    fromElem.style.zIndex = '5';
  });

  // After animation completes, render the actual board state
  setTimeout(() => {
    // Clear transition styles
    const allCells = gameBoardElement.getElementsByClassName('cell');
    for (let cell of allCells) {
      cell.style.transition = '';
      cell.style.transform = '';
      cell.style.zIndex = '';
    }
    renderBoard();
    callback();
  }, 280);
}

// ---------- Cascade System ----------
// Runs the full cascade loop: clear → particles → gravity → re-check → repeat
function runCascade(cascadeLevel, totalLinesCleared, totalClearedCells) {
  const { count: linesCleared, cells: clearedCells } = clearFullLines();

  if (linesCleared === 0) {
    // No more clears — cascade is done
    finishCascade(totalLinesCleared, totalClearedCells);
    return;
  }

  totalLinesCleared += linesCleared;
  totalClearedCells.push(...clearedCells);

  // Increase combo for each cascade level
  combo++;
  const multiplier = Math.min(combo, 5);

  // Score: lines * 10 * multiplier, cascade bonus for levels > 0
  let lineScore = linesCleared * 10 * multiplier;
  if (linesCleared >= 2) lineScore += linesCleared * 5;
  if (cascadeLevel > 0) lineScore += linesCleared * 15; // cascade bonus
  score += lineScore;

  // Show combo
  if (combo >= 2) {
    showCombo(multiplier);
  }

  // Screen shake scales with cascade level
  if (linesCleared >= 2 || combo >= 3 || cascadeLevel > 0) {
    screenShake(2 + linesCleared + cascadeLevel, 250);
  }

  // Particle effects
  if (typeof particles !== 'undefined') {
    setTimeout(() => {
      particles.emitLineClear(clearedCells, gameBoardElement);

      if (combo >= 2) {
        const boardRect = gameBoardElement.getBoundingClientRect();
        particles.emitCombo(
          boardRect.left + boardRect.width / 2,
          boardRect.top + boardRect.height / 2,
          multiplier
        );
      }
    }, 200);

    // Score popup
    const midCell = clearedCells[Math.floor(clearedCells.length / 2)];
    const cellElems = gameBoardElement.getElementsByClassName('cell');
    const midElem = cellElems[midCell.r * cols + midCell.c];
    if (midElem) {
      const pos = midElem.getBoundingClientRect();
      const cascadeText = cascadeLevel > 0 ? ' CASCADE!' : '';
      const text = combo >= 2 ? `+${lineScore} x${multiplier}${cascadeText}` : `+${lineScore}${cascadeText}`;
      const popupColor = cascadeLevel > 0 ? '#ffff00' : '#00ffff';
      particles.emitScorePopup(pos.left + pos.width / 2, pos.top, text, popupColor);
    }
  }

  animateScore(score);

  // After flash animation, apply gravity then check for more clears
  setTimeout(() => {
    renderBoard();

    // Apply gravity
    const gravityMoves = applyGravity();

    if (gravityMoves.length > 0) {
      // Animate the drops, then check for new clears (cascade)
      animateGravityDrops(gravityMoves, () => {
        // Small pause before next cascade check for visual drama
        setTimeout(() => {
          runCascade(cascadeLevel + 1, totalLinesCleared, totalClearedCells);
        }, 150);
      });
    } else {
      // No gravity needed, but still check for cascade (column clears might not trigger gravity)
      finishCascade(totalLinesCleared, totalClearedCells);
    }
  }, 400);
}

// Called when the cascade loop is fully done
function finishCascade(totalLinesCleared, totalClearedCells) {
  // If nothing was cleared at all, reset combo
  if (totalLinesCleared === 0) {
    combo = 0;
    hideCombo();
  }

  // Check for perfect clear
  const isPerfect = board.every(row => row.every(cell => cell === 0));
  if (isPerfect) {
    score += 50;
    if (typeof particles !== 'undefined') {
      particles.emitPerfectClear(gameBoardElement);
      const boardRect = gameBoardElement.getBoundingClientRect();
      particles.emitScorePopup(
        boardRect.left + boardRect.width / 2,
        boardRect.top + boardRect.height / 2,
        'PERFECT! +50',
        '#ffff00'
      );
    }
    screenShake(5, 400);
  }

  animateScore(score);
  updateHighScore();

  // Generate new pieces if all placed
  if (pieceTray.every(p => p.placed)) {
    generatePieces();
  }

  renderPieceTray();

  // Check game over
  if (checkGameOver()) {
    triggerGameOver();
  }
}

// ---------- Scoring ----------
function animateScore(target) {
  const startVal = displayedScore;
  const diff = target - startVal;
  if (diff === 0) return;
  const duration = 400;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out
    const eased = 1 - Math.pow(1 - progress, 3);
    displayedScore = Math.round(startVal + diff * eased);
    scoreSpan.textContent = displayedScore;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('blockBlastHighScore', highScore);
  }
  highScoreSpan.textContent = highScore;
  highScoreDisplay.textContent = "High Score: " + highScore;
}

function showCombo(multiplier) {
  comboCount.textContent = multiplier;
  comboDisplay.style.display = 'inline';
  comboDisplay.style.animation = 'none';
  // Force reflow
  comboDisplay.offsetHeight;
  comboDisplay.style.animation = 'comboPopIn 0.3s ease';
}

function hideCombo() {
  comboDisplay.style.display = 'none';
}

// ---------- Screen Shake ----------
function screenShake(intensity = 3, duration = 250) {
  gameBoardElement.style.setProperty('--shake-intensity', intensity + 'px');
  gameBoardElement.classList.add('shaking');
  setTimeout(() => gameBoardElement.classList.remove('shaking'), duration);
}

// ---------- Game Over ----------
function checkGameOver() {
  for (let i = 0; i < pieceTray.length; i++) {
    if (pieceTray[i].placed) continue;
    const piece = pieceTray[i];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (canPlacePiece(piece, r, c)) return false;
      }
    }
  }
  return true;
}

function triggerGameOver() {
  gameOver = true;
  movingPiece = false;
  isDragging = false;
  removeDragGhost();
  clearPreview();
  hideCombo();

  // Particle rain
  if (typeof particles !== 'undefined') {
    particles.emitGameOver(gameBoardElement);
  }

  // Delay overlay to let particles play
  setTimeout(() => {
    finalScoreSpan.textContent = score;
    updateHighScore();
    if (score === highScore && score !== 0) {
      gameOverHighScore.textContent = "New High Score!";
    } else {
      gameOverHighScore.textContent = "High Score: " + highScore;
    }
    gameOverOverlay.style.display = 'block';
    playSound(gameoverSound);
  }, 600);
}

// ---------- Confirm Placement ----------
function confirmPlacePiece() {
  if (!movingPiece) return;
  const piece = pieceTray[currentPieceIndex];

  if (!canPlacePiece(piece, currentPieceRow, currentPieceCol)) return;

  // Place on board
  placePieceOnBoard(piece, currentPieceRow, currentPieceCol);
  score += piece.shape.length;

  // Mark placed
  pieceTray[currentPieceIndex].placed = true;
  movingPiece = false;

  // Collect placed cell positions for particles
  const placedCells = piece.shape.map(([dx, dy]) => ({
    r: currentPieceRow + dy,
    c: currentPieceCol + dx
  }));

  // Animate placed blocks
  placedCells.forEach(({ r, c }) => {
    const cellElem = gameBoardElement.getElementsByClassName('cell')[r * cols + c];
    cellElem.classList.add('placed');
  });

  playSound(placeSound);
  renderBoard();
  animateScore(score);

  // Placement particles
  if (typeof particles !== 'undefined') {
    particles.emitBlockPlace(placedCells, gameBoardElement, piece.color);
  }

  // Start the cascade system: clear → gravity → re-check → repeat
  // cascadeLevel 0 = initial clear from placement
  runCascade(0, 0, []);
}

// ---------- Drag & Drop (Mouse + Touch) ----------
let dragIsTouch = false;      // Whether current drag is touch-based
let dragGhostW = 0;           // Ghost width for centering
let dragGhostH = 0;           // Ghost height for centering
let dragOverBoard = false;    // Whether finger/cursor is currently over the board

function startDrag(pieceIndex, clientX, clientY, isTouch) {
  if (gameOver) return;
  if (pieceTray[pieceIndex].placed) return;

  currentPieceIndex = pieceIndex;
  movingPiece = true;
  isDragging = true;
  dragIsTouch = !!isTouch;
  dragOverBoard = false;
  renderPieceTray();

  // Create ghost element
  createDragGhost(pieceTray[pieceIndex]);

  // Position ghost at finger/cursor immediately
  positionGhost(clientX, clientY);

  // Try to show preview if already over the board
  updateDragPosition(clientX, clientY);
}

function createDragGhost(piece) {
  removeDragGhost();

  dragGhost = document.createElement('div');
  dragGhost.classList.add('drag-ghost');

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  piece.shape.forEach(([dx, dy]) => {
    minX = Math.min(minX, dx); minY = Math.min(minY, dy);
    maxX = Math.max(maxX, dx); maxY = Math.max(maxY, dy);
  });

  const blockSize = 36;
  const gap = 2;
  piece.shape.forEach(([dx, dy]) => {
    const mini = document.createElement('div');
    mini.classList.add('mini-block');
    mini.classList.add('mini' + piece.color);
    mini.style.width = blockSize + 'px';
    mini.style.height = blockSize + 'px';
    mini.style.left = (dx - minX) * (blockSize + gap) + 'px';
    mini.style.top = (dy - minY) * (blockSize + gap) + 'px';
    dragGhost.appendChild(mini);
  });

  // Calculate total ghost dimensions for centering
  dragGhostW = (maxX - minX + 1) * (blockSize + gap);
  dragGhostH = (maxY - minY + 1) * (blockSize + gap);

  document.body.appendChild(dragGhost);
}

function positionGhost(x, y) {
  if (!dragGhost) return;
  // Center ghost horizontally on finger, offset above for touch so user can see
  const offsetY = dragIsTouch ? dragGhostH + 30 : dragGhostH / 2 + 10;
  dragGhost.style.left = (x - dragGhostW / 2) + 'px';
  dragGhost.style.top = (y - offsetY) + 'px';
}

function removeDragGhost() {
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
}

function updateDragPosition(clientX, clientY) {
  const boardRect = gameBoardElement.getBoundingClientRect();
  const cellWidth = boardRect.width / cols;
  const cellHeight = boardRect.height / rows;

  // For touch: map to where the ghost is visually (above the finger)
  // For mouse: map directly to cursor position
  const targetY = dragIsTouch ? clientY - dragGhostH - 30 + dragGhostH / 2 : clientY;
  const targetX = clientX;

  // Check if the target point is within/near the board
  const margin = cellWidth; // allow some margin outside board edge
  const overBoard = (
    targetX >= boardRect.left - margin &&
    targetX <= boardRect.right + margin &&
    targetY >= boardRect.top - margin &&
    targetY <= boardRect.bottom + margin
  );

  if (overBoard) {
    dragOverBoard = true;
    let newCol = Math.floor((targetX - boardRect.left) / cellWidth);
    let newRow = Math.floor((targetY - boardRect.top) / cellHeight);
    newCol = Math.max(0, Math.min(newCol, cols - 1));
    newRow = Math.max(0, Math.min(newRow, rows - 1));
    currentPieceRow = newRow;
    currentPieceCol = newCol;
    showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
  } else {
    dragOverBoard = false;
    clearPreview();
  }
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  removeDragGhost();

  if (movingPiece && dragOverBoard) {
    const piece = pieceTray[currentPieceIndex];
    if (canPlacePiece(piece, currentPieceRow, currentPieceCol)) {
      confirmPlacePiece();
    } else {
      cancelMovePiece();
    }
  } else {
    cancelMovePiece();
  }
}

function cancelMovePiece() {
  movingPiece = false;
  isDragging = false;
  dragOverBoard = false;
  removeDragGhost();
  clearPreview();
  renderPieceTray();
}

// Global mouse handlers for drag
document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  e.preventDefault();
  positionGhost(e.clientX, e.clientY);
  updateDragPosition(e.clientX, e.clientY);
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  endDrag();
});

// Global touch handlers for drag — on document for uninterrupted tracking
document.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  e.preventDefault();
  const touch = e.touches[0];
  positionGhost(touch.clientX, touch.clientY);
  updateDragPosition(touch.clientX, touch.clientY);
}, { passive: false });

document.addEventListener('touchend', () => {
  if (!isDragging) return;
  endDrag();
});

document.addEventListener('touchcancel', () => {
  if (!isDragging) return;
  cancelMovePiece();
});

// ---------- Keyboard Controls (secondary) ----------
function moveSelection(direction) {
  if (movingPiece) return;
  const prevIndex = currentPieceIndex;
  currentPieceIndex += direction;
  currentPieceIndex = Math.max(0, Math.min(currentPieceIndex, pieceTray.length - 1));
  // Skip placed pieces
  while (currentPieceIndex >= 0 && currentPieceIndex < pieceTray.length &&
         pieceTray[currentPieceIndex].placed) {
    currentPieceIndex += direction;
  }
  currentPieceIndex = Math.max(0, Math.min(currentPieceIndex, pieceTray.length - 1));
  if (currentPieceIndex !== prevIndex) renderPieceTray();
}

function pickUpPiece(index) {
  if (pieceTray[index].placed) return;
  movingPiece = true;
  currentPieceIndex = index;
  currentPieceRow = 3;
  currentPieceCol = 3;
  showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
  renderPieceTray();
}

document.addEventListener('keydown', (e) => {
  if (gameOver) return;
  if (isDragging) return; // don't mix keyboard and mouse drag

  switch(e.key) {
    case 'ArrowLeft':
      if (movingPiece) {
        currentPieceCol = Math.max(0, currentPieceCol - 1);
        showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
      } else {
        moveSelection(-1);
      }
      break;
    case 'ArrowRight':
      if (movingPiece) {
        currentPieceCol = Math.min(cols - 1, currentPieceCol + 1);
        showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
      } else {
        moveSelection(1);
      }
      break;
    case 'ArrowUp':
      if (movingPiece) {
        currentPieceRow = Math.max(0, currentPieceRow - 1);
        showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
      }
      break;
    case 'ArrowDown':
      if (movingPiece) {
        currentPieceRow = Math.min(rows - 1, currentPieceRow + 1);
        showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
      }
      break;
    case ' ':
      e.preventDefault();
      if (!movingPiece) pickUpPiece(currentPieceIndex);
      break;
    case 'Enter':
      if (movingPiece) confirmPlacePiece();
      else pickUpPiece(currentPieceIndex);
      break;
    case 'Escape':
      cancelMovePiece();
      break;
  }
});

// ---------- Start / Restart ----------
function startGame() {
  score = 0;
  displayedScore = 0;
  combo = 0;
  scoreSpan.textContent = '0';
  hideCombo();

  initBoard();
  generatePieces();

  startMenu.style.display = 'none';
  gameContainer.style.display = 'flex';
  gameOverOverlay.style.display = 'none';
  gameOver = false;

  if (typeof particles !== 'undefined') {
    particles.startAmbient();
  }
}

// ---------- Button Handlers ----------
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
settingsButton.addEventListener('click', () => {
  document.getElementById('settingsPanel').style.display = 'flex';
});
openSettingsButton.addEventListener('click', () => {
  document.getElementById('settingsPanel').style.display = 'flex';
});
closeSettingsButton.addEventListener('click', () => {
  document.getElementById('settingsPanel').style.display = 'none';
});

// Volume control
sfxVolumeSlider.addEventListener('input', () => {
  const vol = parseFloat(sfxVolumeSlider.value);
  if (placeSound) placeSound.volume = vol;
  if (clearSound) clearSound.volume = vol;
  if (gameoverSound) gameoverSound.volume = vol;
});

// ---------- Initial Setup ----------
window.addEventListener('load', () => {
  initBoard();
  renderBoard();

  const storedHighScore = localStorage.getItem('blockBlastHighScore');
  highScore = storedHighScore ? (parseInt(storedHighScore, 10) || 0) : 0;
  highScoreSpan.textContent = highScore;
  highScoreDisplay.textContent = "High Score: " + highScore;

  const sfxVol = parseFloat(sfxVolumeSlider.value);
  if (placeSound) placeSound.volume = sfxVol;
  if (clearSound) clearSound.volume = sfxVol;
  if (gameoverSound) gameoverSound.volume = sfxVol;
});
