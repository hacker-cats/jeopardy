// Overview page logic

let currentConfig = null;
let gameToDelete = null;

// DOM elements
const newGameBtn = document.getElementById('newGameBtn');
const gamesContainer = document.getElementById('gamesContainer');
const emptyState = document.getElementById('emptyState');
const newGameModal = document.getElementById('newGameModal');
const deleteModal = document.getElementById('deleteModal');
const createOptionsDiv = document.querySelector('.create-options');
const uploadSection = document.getElementById('uploadSection');
const templateSection = document.getElementById('templateSection');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const errorMessage = document.getElementById('errorMessage');
const createBtn = document.getElementById('createBtn');
const cancelBtn = document.getElementById('cancelBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadGames();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  newGameBtn.addEventListener('click', () => {
    showCreateOptions();
    openModal(newGameModal);
  });

  cancelBtn.addEventListener('click', () => closeModal(newGameModal));
  createBtn.addEventListener('click', createGame);
  cancelDeleteBtn.addEventListener('click', () => closeModal(deleteModal));
  confirmDeleteBtn.addEventListener('click', confirmDelete);

  // Create options
  document.getElementById('uploadOption').addEventListener('click', showUploadSection);
  document.getElementById('templateOption').addEventListener('click', showTemplateSection);
  document.getElementById('builderOption').addEventListener('click', openGameBuilder);
  document.getElementById('backToOptions').addEventListener('click', showCreateOptions);
  document.getElementById('backToOptionsFromTemplate').addEventListener('click', showCreateOptions);

  // Template selection
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      const template = card.getAttribute('data-template');
      loadTemplate(template);
    });
  });

  // File upload
  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  });

  // Close modal on backdrop click
  newGameModal.addEventListener('click', (e) => {
    if (e.target === newGameModal) closeModal(newGameModal);
  });
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeModal(deleteModal);
  });

  // Close buttons
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(newGameModal);
      closeModal(deleteModal);
    });
  });
}

// Show/hide sections
function showCreateOptions() {
  createOptionsDiv.style.display = 'grid';
  uploadSection.style.display = 'none';
  templateSection.style.display = 'none';
  createBtn.style.display = 'none';
  resetUploadForm();
}

function showUploadSection() {
  createOptionsDiv.style.display = 'none';
  uploadSection.style.display = 'block';
  templateSection.style.display = 'none';
}

function showTemplateSection() {
  createOptionsDiv.style.display = 'none';
  uploadSection.style.display = 'none';
  templateSection.style.display = 'block';
}

function openGameBuilder() {
  window.location.href = 'builder.html';
}

// Load template
async function loadTemplate(template) {
  try {
    const response = await fetch(`examples/template-${template}.yaml`);
    if (!response.ok) throw new Error('Template not found');

    const content = await response.text();
    const result = Parser.parse(content, `template-${template}.yaml`);

    if (result) {
      currentConfig = result;
      const game = GameState.createGame(currentConfig);
      const saved = Storage.saveGame(game);

      if (saved) {
        closeModal(newGameModal);
        loadGames();
      } else {
        alert('Failed to save game. Storage may be full.');
      }
    }
  } catch (error) {
    alert('Error loading template: ' + error.message);
  }
}

// Modal controls
function openModal(modal) {
  modal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
  if (modal === newGameModal) {
    resetUploadForm();
    showCreateOptions();
  }
}

function resetUploadForm() {
  fileInput.value = '';
  currentConfig = null;
  fileInfo.style.display = 'none';
  errorMessage.style.display = 'none';
  createBtn.disabled = true;
}

// File handling
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
}

async function handleFile(file) {
  errorMessage.style.display = 'none';
  fileInfo.style.display = 'none';
  createBtn.disabled = true;

  const result = await Parser.parseFile(file);

  if (result.success) {
    currentConfig = result.config;
    showFileInfo(file, result.config);
    createBtn.disabled = false;
    createBtn.style.display = 'inline-block';
  } else {
    showError(result.error);
  }
}

function showFileInfo(file, config) {
  const categoriesCount = config.categories ? config.categories.length : 0;
  const questionsCount = config.categories ?
    config.categories.reduce((sum, cat) => sum + (cat.questions ? cat.questions.length : 0), 0) : 0;

  fileInfo.innerHTML = `
    <p><span class="file-name">${file.name}</span></p>
    <p>Title: ${config.title}</p>
    <p>Categories: ${categoriesCount}</p>
    <p>Questions: ${questionsCount}</p>
  `;
  fileInfo.style.display = 'block';
}

function showError(error) {
  errorMessage.textContent = error;
  errorMessage.style.display = 'block';
}

// Create game
function createGame() {
  if (!currentConfig) return;

  const game = GameState.createGame(currentConfig);
  const saved = Storage.saveGame(game);

  if (saved) {
    closeModal(newGameModal);
    loadGames();
  } else {
    showError('Failed to save game. Storage may be full.');
  }
}

// Load and display games
function loadGames() {
  const games = Storage.getAllGames();

  if (games.length === 0) {
    gamesContainer.style.display = 'none';
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    gamesContainer.style.display = 'grid';
    renderGames(games);
  }
}

function renderGames(games) {
  gamesContainer.innerHTML = '';

  games.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));

  games.forEach(game => {
    const card = createGameCard(game);
    gamesContainer.appendChild(card);
  });
}

function createGameCard(game) {
  const card = document.createElement('div');
  card.className = 'game-card';

  const progress = GameState.getProgress(game);
  const date = new Date(game.lastPlayed).toLocaleDateString();

  card.innerHTML = `
    <div class="game-card-header">
      <div>
        <div class="game-card-title">${game.title}</div>
      </div>
      <span class="game-status ${game.status}">${game.status}</span>
    </div>
    <div class="game-progress">
      ${progress.answered} / ${progress.total} questions answered
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress.percentage}%"></div>
      </div>
    </div>
    <div class="game-teams">
      ${game.state.teams.map(team => `
        <div class="team-badge">
          <div class="team-color" style="background-color: ${team.color}"></div>
          <span>${team.name}: $${team.score}</span>
        </div>
      `).join('')}
    </div>
    <div class="game-card-footer">
      <span class="game-date">Last played: ${date}</span>
      <div class="game-actions">
        <button class="icon-btn edit" data-action="edit" title="Edit game">✏️</button>
        <button class="icon-btn delete" data-action="delete" data-game-id="${game.id}" title="Delete game">🗑️</button>
      </div>
    </div>
  `;

  // Click card to play
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.game-actions')) {
      playGame(game.id);
    }
  });

  // Edit button
  const editBtn = card.querySelector('[data-action="edit"]');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `builder.html?gameId=${game.id}`;
  });

  // Delete button
  const deleteBtn = card.querySelector('[data-action="delete"]');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showDeleteConfirmation(game);
  });

  return card;
}

// Play game
function playGame(gameId) {
  window.location.href = `game.html?id=${gameId}`;
}

// Delete game
function showDeleteConfirmation(game) {
  gameToDelete = game;
  const titleDisplay = deleteModal.querySelector('.game-title-display');
  titleDisplay.textContent = game.title;
  openModal(deleteModal);
}

function confirmDelete() {
  if (gameToDelete) {
    Storage.deleteGame(gameToDelete.id);
    closeModal(deleteModal);
    loadGames();
    gameToDelete = null;
  }
}
