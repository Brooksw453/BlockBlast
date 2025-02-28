// Game configuration and state variables
const rows = 8;
const cols = 8;
let board = [];  // 2D array to represent the board state (0 = empty, >0 = filled with color index)
let score = 0;
let highScore = 0;
let gameOver = false;

// Define block shapes (Block Blast-style pieces)
// Each shape is an array of [dx, dy] offsets for blocks relative to the shape's top-left corner
const shapes = [
  [[0,0]],                                         // Single block
  [[0,0],[1,0]],                                   // 2-block line (horizontal)
  [[0,0],[1,0],[2,0]],                             // 3-block line (horizontal)
  [[0,0],[0,1]],                                   // 2-block line (vertical)
  [[0,0],[0,1],[0,2]],                             // 3-block line (vertical)
  [[0,0],[1,0],[0,1]],                             // L shape (3 blocks)
  [[0,0],[1,0],[2,0],[1,1]],                       // T shape (4 blocks)
  [[0,0],[1,0],[0,1],[1,1]],                       // 2x2 square
  [[0,0],[1,0],[2,0],[3,0]],                       // 4-block line (horizontal)
  [[0,0],[0,1],[0,2],[0,3]]                        // 4-block line (vertical)
  // (Additional shapes can be added if desired)
];
// Color indices correspond to CSS classes filled1..filled6. We will assign colors 1-6 randomly to pieces.
const maxColorIndex = 6;

// Piece tray and selection
let pieceTray = [];       // Will hold up to 3 piece objects: {shape: [...], color: n, placed: bool}
let currentPieceIndex = 0;  // Index in pieceTray of the currently selected piece
let movingPiece = false;    // Whether a piece is currently picked up for moving (selection confirmed)

// References to DOM elements
const startMenu = document.getElementById('startMenu');
const gameContainer = document.getElementById('gameContainer');
const scoreBoard = document.getElementById('scoreBoard');
const scoreSpan = document.getElementById('score');
const highScoreSpan = document.getElementById('highScore');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const gameBoardElement = document.getElementById('gameBoard');
const pieceTrayElement = document.getElementById('pieceTray');
const gameOverOverlay = document.getElementById('gameOver');
const finalScoreSpan = document.getElementById('finalScore');
const gameOverHighScore = document.getElementById('gameOverHighScore');
// Buttons
const startButton = document.getElementById('startButton');
const settingsButton = document.getElementById('settingsButton');
const openSettingsButton = document.getElementById('openSettings');
const closeSettingsButton = document.getElementById('closeSettings');
const restartButton = document.getElementById('restartButton');
// Audio elements
const bgMusic = document.getElementById('bgMusic');
const placeSound = document.getElementById('placeSound');
const clearSound = document.getElementById('clearSound');
const gameoverSound = document.getElementById('gameoverSound');
// Volume controls
const musicVolumeSlider = document.getElementById('musicVolume');
const sfxVolumeSlider = document.getElementById('sfxVolume');

// Initialize board array and create board cells in the DOM
function initBoard() {
  board = [];
  gameBoardElement.innerHTML = ''; // clear existing cells
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = 0;
      // Create a div for each cell and append to gameBoard
      const cell = document.createElement('div');
      cell.classList.add('cell');
      // Optionally assign an id or data attribute for debugging (e.g., cell-0-0)
      // cell.id = `cell-${r}-${c}`;
      gameBoardElement.appendChild(cell);
    }
  }
}

// Render the board state to the DOM
function renderBoard() {
  const cells = gameBoardElement.getElementsByClassName('cell');
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellElem = cells[index];
      // Reset cell classes (preserve base 'cell' class, remove others)
      cellElem.className = 'cell';
      const value = board[r][c];
      if (value > 0) {
        // Add filled class corresponding to color index
        cellElem.classList.add('filled' + value);
      }
      index++;
    }
  }
}

// Generate a new set of up to 3 pieces for the tray
function generatePieces() {
  pieceTray = [];
  for (let i = 0; i < 3; i++) {
    const shapeIndex = Math.floor(Math.random() * shapes.length);
    const shape = shapes[shapeIndex];
    const color = Math.floor(Math.random() * maxColorIndex) + 1; // random 1..6
    pieceTray.push({ shape: shape, color: color, placed: false });
  }
  currentPieceIndex = 0;
  movingPiece = false;
  renderPieceTray();
}

// Render the piece tray UI
function renderPieceTray() {
  pieceTrayElement.innerHTML = ''; // clear current tray display
  pieceTray.forEach((piece, index) => {
    // Create container div for the piece
    const pieceDiv = document.createElement('div');
    pieceDiv.classList.add('piece');
    if (index === currentPieceIndex && !movingPiece) {
      // Highlight if this piece is currently selected (in selection mode)
      pieceDiv.classList.add('selected');
    }
    if (piece.placed) {
      pieceDiv.style.opacity = '0.3'; // dim the piece if already placed
    }
    // Determine shape bounds to center it in the preview box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    piece.shape.forEach(([dx, dy]) => {
      if (dx < minX) minX = dx;
      if (dy < minY) minY = dy;
      if (dx > maxX) maxX = dx;
      if (dy > maxY) maxY = dy;
    });
    const shapeWidth = maxX - minX + 1;
    const shapeHeight = maxY - minY + 1;
    // We use a 4x4 preview box (80px). Compute offset to center the shape within 4x4 if smaller.
    const offsetX = Math.floor((4 - shapeWidth) / 2);
    const offsetY = Math.floor((4 - shapeHeight) / 2);
    const blockSize = 18; // size of mini-block in px (as set in CSS)
    // Create mini-block divs for each part of the shape
    piece.shape.forEach(([dx, dy]) => {
      const mini = document.createElement('div');
      mini.classList.add('mini-block');
      // Apply color class corresponding to piece.color (if within 1-6 range)
      if (piece.color) {
        mini.classList.add('mini' + piece.color);
      }
      // Position the mini-block within the container
      const left = (dx - minX + offsetX) * blockSize;
      const top = (dy - minY + offsetY) * blockSize;
      mini.style.left = left + 'px';
      mini.style.top = top + 'px';
      pieceDiv.appendChild(mini);
    });
    pieceTrayElement.appendChild(pieceDiv);
  });
}

// Check if a given piece (shape at given top-left position) can be placed on the board
function canPlacePiece(piece, topLeftRow, topLeftCol) {
  for (const [dx, dy] of piece.shape) {
    const r = topLeftRow + dy;
    const c = topLeftCol + dx;
    // Check bounds
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      return false;
    }
    // Check if cell is already occupied
    if (board[r][c] !== 0) {
      return false;
    }
  }
  return true;
}

// Place a piece onto the board (assuming canPlacePiece returned true)
function placePieceOnBoard(piece, topLeftRow, topLeftCol) {
  for (const [dx, dy] of piece.shape) {
    const r = topLeftRow + dy;
    const c = topLeftCol + dx;
    // Mark board cell with the piece's color index
    board[r][c] = piece.color;
  }
}

// Remove preview highlights from board
function clearPreview() {
  const cells = gameBoardElement.getElementsByClassName('cell');
  for (let cell of cells) {
    cell.classList.remove('preview');
    cell.classList.remove('invalid');
  }
}

// Show preview of current moving piece at given position
function showPreview(piece, topLeftRow, topLeftCol) {
  const cells = gameBoardElement.getElementsByClassName('cell');
  clearPreview();
  let valid = true;
  // First, check if placement would be valid (inside bounds and no overlap)
  for (const [dx, dy] of piece.shape) {
    const r = topLeftRow + dy;
    const c = topLeftCol + dx;
    if (r < 0 || r >= rows || c < 0 || c >= cols || board[r][c] !== 0) {
      valid = false;
      break;
    }
  }
  // Then mark the cells for preview
  for (const [dx, dy] of piece.shape) {
    const r = topLeftRow + dy;
    const c = topLeftCol + dx;
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    const cellIndex = r * cols + c;
    const cellElem = gameBoardElement.getElementsByClassName('cell')[cellIndex];
    cellElem.classList.add('preview');
    if (!valid) {
      cellElem.classList.add('invalid');
    }
  }
  return valid;
}

// Check and clear any full rows or columns. Returns number of lines cleared.
function clearFullLines() {
  let linesCleared = 0;
  // Check rows
  for (let r = 0; r < rows; r++) {
    let full = true;
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === 0) {
        full = false;
        break;
      }
    }
    if (full) {
      linesCleared++;
      // Mark row cells as clearing for animation
      for (let c = 0; c < cols; c++) {
        const cellElem = gameBoardElement.getElementsByClassName('cell')[r * cols + c];
        cellElem.classList.add('clearing');
      }
      // Clear the row in board data (set to 0)
      for (let c = 0; c < cols; c++) {
        board[r][c] = 0;
      }
    }
  }
  // Check columns
  for (let c = 0; c < cols; c++) {
    let full = true;
    for (let r = 0; r < rows; r++) {
      if (board[r][c] === 0) {
        full = false;
        break;
      }
    }
    if (full) {
      linesCleared++;
      // Mark column cells as clearing
      for (let r = 0; r < rows; r++) {
        const cellElem = gameBoardElement.getElementsByClassName('cell')[r * cols + c];
        cellElem.classList.add('clearing');
      }
      // Clear the column in board data
      for (let r = 0; r < rows; r++) {
        board[r][c] = 0;
      }
    }
  }
  if (linesCleared > 0) {
    // Play clear sound effect
    if (clearSound) clearSound.play();
  }
  return linesCleared;
}

// Update high score in localStorage and on screen if needed
function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('blockBlastHighScore', highScore);
  }
  // Update displays
  highScoreSpan.textContent = highScore;
  highScoreDisplay.textContent = "High Score: " + highScore;
}

// Check if game is over (no moves possible with current pieces)
function checkGameOver() {
  // For each remaining piece in tray that is not placed, try to find at least one valid position
  for (let i = 0; i < pieceTray.length; i++) {
    if (pieceTray[i].placed) continue;
    const piece = pieceTray[i];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (canPlacePiece(piece, r, c)) {
          return false; // found a move, not game over
        }
      }
    }
  }
  return true;
}

// Enter game over state
function triggerGameOver() {
  gameOver = true;
  // Stop any ongoing piece movement
  movingPiece = false;
  clearPreview();
  // Display Game Over overlay
  finalScoreSpan.textContent = score;
  // Update high score and show a message if new high score achieved
  updateHighScore();
  if (score === highScore && score !== 0) {
    gameOverHighScore.textContent = "🎉 New High Score! 🎉";
  } else {
    gameOverHighScore.textContent = "High Score: " + highScore;
  }
  gameOverOverlay.style.display = 'block';
  // Play game over sound
  if (gameoverSound) gameoverSound.play();
}

// Start a new game (reset state and UI)
function startGame() {
  // Reset scores
  score = 0;
  scoreSpan.textContent = score;
  // Initialize board and pieces
  initBoard();
  generatePieces();
  // Hide start menu, show game interface
  startMenu.style.display = 'none';
  gameContainer.style.display = 'block';
  gameOverOverlay.style.display = 'none';
  gameOver = false;
  // Start background music (if not already playing)
  if (bgMusic) {
    bgMusic.currentTime = 0;
    bgMusic.play();
  }
}

// Move selection highlight in the tray (left/right)
function moveSelection(direction) {
  if (movingPiece) return; // if already picked a piece, ignore
  // direction: -1 for left, +1 for right
  const prevIndex = currentPieceIndex;
  currentPieceIndex += direction;
  if (currentPieceIndex < 0) currentPieceIndex = 0;
  if (currentPieceIndex > pieceTray.length - 1) currentPieceIndex = pieceTray.length - 1;
  if (currentPieceIndex !== prevIndex) {
    renderPieceTray();
  }
}

// Variables for the currently moving piece position (if a piece is picked up)
let currentPieceRow = 0;
let currentPieceCol = 0;

// Begin moving a piece (pick up from tray)
function pickUpPiece(index) {
  if (pieceTray[index].placed) return; // can't pick up if already placed
  movingPiece = true;
  currentPieceIndex = index;
  // Initial position to try placing piece – start at top-left of board
  currentPieceRow = 0;
  currentPieceCol = 0;
  // Show initial preview on board (at 0,0)
  const piece = pieceTray[currentPieceIndex];
  showPreview(piece, currentPieceRow, currentPieceCol);
  renderPieceTray(); // update tray UI (remove highlight since now moving)
}

// Place the currently moving piece onto the board (if valid)
function confirmPlacePiece() {
  if (!movingPiece) return;
  const piece = pieceTray[currentPieceIndex];
  // Check if current position is a valid placement
  if (!canPlacePiece(piece, currentPieceRow, currentPieceCol)) {
    // Invalid placement attempt; do nothing or maybe flash (already indicated by red preview)
    return;
  }
  // Place the piece on the board
  placePieceOnBoard(piece, currentPieceRow, currentPieceCol);
  // Update score (e.g., 1 point per block placed)
  score += piece.shape.length;
  // Mark piece as placed
  pieceTray[currentPieceIndex].placed = true;
  movingPiece = false;
  // Animate newly placed blocks (add 'placed' class briefly)
  piece.shape.forEach(([dx, dy]) => {
    const r = currentPieceRow + dy;
    const c = currentPieceCol + dx;
    const cellElem = gameBoardElement.getElementsByClassName('cell')[r * cols + c];
    cellElem.classList.add('placed');
  });
  if (placeSound) placeSound.play(); // play block placement sound
  renderBoard(); // update board display with new blocks
  scoreSpan.textContent = score;
  // Clear any completed lines
  const lines = clearFullLines();
  if (lines > 0) {
    // Award extra points for cleared lines (e.g., 10 points each line)
    score += lines * 10;
    scoreSpan.textContent = score;
    // After a short delay for the flash animation, re-render board
    setTimeout(() => {
      renderBoard();
    }, 500);
  }
  // Update high score display (in case score exceeds it)
  updateHighScore();
  // Generate new pieces if all in current tray have been placed
  const allPlaced = pieceTray.every(p => p.placed);
  if (allPlaced) {
    generatePieces();
  }
  // Re-render tray to reflect placed/removed pieces
  renderPieceTray();
  // Check if game is over (no possible moves)
  if (checkGameOver()) {
    triggerGameOver();
  }
}

// Cancel moving a piece (put it back to tray selection without placing)
function cancelMovePiece() {
  if (!movingPiece) return;
  movingPiece = false;
  // Simply re-render tray (which will highlight selection again) and clear preview
  clearPreview();
  renderPieceTray();
}

// Handle keyboard controls
document.addEventListener('keydown', (e) => {
  if (gameOver) return; // if game over, ignore inputs (until restart)
  switch(e.key) {
    case 'ArrowLeft':
      if (movingPiece) {
        // Move piece left on board
        currentPieceCol -= 1;
        // Prevent going out of bounds
        currentPieceCol = Math.max(currentPieceCol, 0);
        showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
      } else {
        // Move tray selection left
        moveSelection(-1);
      }
      break;
    case 'ArrowRight':
      if (movingPiece) {
        currentPieceCol += 1;
        currentPieceCol = Math.min(currentPieceCol, cols - 1);
        showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
      } else {
        moveSelection(1);
      }
      break;
    case 'ArrowUp':
      if (movingPiece) {
        currentPieceRow -= 1;
        currentPieceRow = Math.max(currentPieceRow, 0);
        showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
      } else {
        // (Optional: Could use ArrowUp/Down to rotate pieces if rotation was allowed)
      }
      break;
    case 'ArrowDown':
      if (movingPiece) {
        currentPieceRow += 1;
        currentPieceRow = Math.min(currentPieceRow, rows - 1);
        showPreview(pieceTray[currentPieceIndex], currentPieceRow, currentPieceCol);
      } else {
        // (Not used for selection mode; down arrow could rotate as well or do nothing)
      }
      break;
    case ' ': // Spacebar - confirm selection or toggle selection
      e.preventDefault(); // prevent page scroll
      if (!movingPiece) {
        // Pick up the currently highlighted piece from the tray
        pickUpPiece(currentPieceIndex);
      } else {
        // If desired, space could be used to drop the piece back (cancel), but here we don't use it for that
      }
      break;
    case 'Enter':
      if (movingPiece) {
        // Place the piece on the board
        confirmPlacePiece();
      } else {
        // If not moving a piece (in selection mode), Enter could act same as space (pick up)
        pickUpPiece(currentPieceIndex);
      }
      break;
    case 'Escape':
      // Allow cancelling a piece placement with Esc
      cancelMovePiece();
      break;
  }
});

// Button event handlers
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
settingsButton.addEventListener('click', () => {
  // Open settings from start menu
  document.getElementById('settingsPanel').style.display = 'flex';
});
openSettingsButton.addEventListener('click', () => {
  // Open settings from in-game
  document.getElementById('settingsPanel').style.display = 'flex';
});
closeSettingsButton.addEventListener('click', () => {
  document.getElementById('settingsPanel').style.display = 'none';
});

// Volume control handlers
musicVolumeSlider.addEventListener('input', () => {
  const vol = parseFloat(musicVolumeSlider.value);
  if (bgMusic) bgMusic.volume = vol;
});
sfxVolumeSlider.addEventListener('input', () => {
  const vol = parseFloat(sfxVolumeSlider.value);
  if (placeSound) placeSound.volume = vol;
  if (clearSound) clearSound.volume = vol;
  if (gameoverSound) gameoverSound.volume = vol;
});

// Initial setup on page load
window.addEventListener('load', () => {
  // Prepare board cells
  initBoard();
  renderBoard();
  // Load high score from localStorage if exists
  const storedHighScore = localStorage.getItem('blockBlastHighScore');
  if (storedHighScore) {
    highScore = parseInt(storedHighScore, 10) || 0;
  } else {
    highScore = 0;
  }
  highScoreSpan.textContent = highScore;
  highScoreDisplay.textContent = "High Score: " + highScore;
  // Ensure background music volume default and play if desired
  if (bgMusic) {
    bgMusic.volume = parseFloat(musicVolumeSlider.value);
    // Note: Music will start on game start to comply with user gesture policies
  }
  // Set initial volume for sound effects
  const sfxVol = parseFloat(sfxVolumeSlider.value);
  if (placeSound) placeSound.volume = sfxVol;
  if (clearSound) clearSound.volume = sfxVol;
  if (gameoverSound) gameoverSound.volume = sfxVol;
  // The game will start when Start Game button is clicked
});
