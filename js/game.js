// Game board logic

// Render text with code block and inline code support
// Uses DOM APIs (textContent, createTextNode) to prevent XSS
function renderFormattedText(element, text) {
  element.innerHTML = '';
  element.classList.remove('has-code');

  if (!text) return;

  // Split on fenced code blocks: ```lang\ncode\n```
  const parts = text.split(/(```\w*\n[\s\S]*?```)/g);

  let hasCodeBlock = false;

  parts.forEach(part => {
    if (!part) return;

    const codeBlockMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (codeBlockMatch) {
      hasCodeBlock = true;
      const code = codeBlockMatch[2].replace(/\n$/, '');
      const pre = document.createElement('pre');
      const codeEl = document.createElement('code');
      codeEl.textContent = code;
      pre.appendChild(codeEl);
      element.appendChild(pre);
    } else {
      // Handle inline code with single backticks
      renderInlineText(element, part);
    }
  });

  if (hasCodeBlock) {
    element.classList.add('has-code');
  }
}

// Render text with inline `code` backticks
function renderInlineText(parent, text) {
  const parts = text.split(/(`[^`]+`)/g);
  parts.forEach(part => {
    if (!part) return;
    const inlineMatch = part.match(/^`([^`]+)`$/);
    if (inlineMatch) {
      const codeEl = document.createElement('code');
      codeEl.className = 'inline-code';
      codeEl.textContent = inlineMatch[1];
      parent.appendChild(codeEl);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  });
}

let currentGame = null;
let currentQuestion = null;
let selectedTeam = null;
let currentWager = 0;
let attemptedTeams = []; // Track teams that have already attempted this question

// DOM elements
const gameTitle = document.getElementById('gameTitle');
const teamsDisplay = document.getElementById('teamsDisplay');
const gameBoard = document.getElementById('gameBoard');
const backBtn = document.getElementById('backBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const menuBtn = document.getElementById('menuBtn');

// Modals
const questionModal = document.getElementById('questionModal');
const menuModal = document.getElementById('menuModal');
const editTeamModal = document.getElementById('editTeamModal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('id');

  if (!gameId) {
    alert('No game ID provided');
    window.location.href = 'index.html';
    return;
  }

  loadGame(gameId);
  setupEventListeners();
});

// Load game
function loadGame(gameId) {
  currentGame = Storage.getGame(gameId);

  if (!currentGame) {
    alert('Game not found');
    window.location.href = 'index.html';
    return;
  }

  // Apply theme if configured
  if (currentGame.config.theme) {
    ThemeManager.applyTheme(currentGame.config.theme);
  }

  renderGame();
}

// Render game
function renderGame() {
  gameTitle.textContent = currentGame.title;
  renderTeams();
  renderBoard();
  updateUndoRedoButtons();
  checkFinalJeopardyAvailability();
}

// Render teams
function renderTeams() {
  teamsDisplay.innerHTML = '';

  currentGame.state.teams.forEach(team => {
    const teamEl = document.createElement('div');
    teamEl.className = 'team-score';
    teamEl.style.borderLeftColor = team.color;
    teamEl.innerHTML = `
      <div class="team-name">${team.name}</div>
      <div class="team-points">$${team.score}</div>
    `;
    teamsDisplay.appendChild(teamEl);
  });
}

// Render board
function renderBoard() {
  gameBoard.innerHTML = '';

  const categories = currentGame.config.categories;
  if (!categories || categories.length === 0) return;

  const cols = categories.length;
  const boardGrid = document.createElement('div');
  boardGrid.className = `board-grid cols-${cols}`;

  // Render category headers
  categories.forEach(category => {
    const header = document.createElement('div');
    header.className = 'category-header';
    header.textContent = category.name;
    boardGrid.appendChild(header);
  });

  // Render question tiles
  const maxQuestions = Math.max(...categories.map(cat => cat.questions ? cat.questions.length : 0));

  for (let qIndex = 0; qIndex < maxQuestions; qIndex++) {
    categories.forEach((category, cIndex) => {
      if (category.questions && category.questions[qIndex]) {
        const question = category.questions[qIndex];
        const tile = document.createElement('div');
        tile.className = 'question-tile';

        const isAnswered = GameState.isQuestionAnswered(currentGame, cIndex, qIndex);

        tile.textContent = `$${question.value}`;

        if (isAnswered) {
          tile.classList.add('answered');
        }

        tile.addEventListener('click', () => openQuestion(cIndex, qIndex, isAnswered));

        boardGrid.appendChild(tile);
      } else {
        const empty = document.createElement('div');
        boardGrid.appendChild(empty);
      }
    });
  }

  gameBoard.appendChild(boardGrid);
}

// Open question modal
function openQuestion(categoryIndex, questionIndex, isAnswered = false) {
  currentQuestion = GameState.getQuestion(currentGame, categoryIndex, questionIndex);
  if (!currentQuestion) return;

  // Reset attempted teams list for new question
  attemptedTeams = [];
  selectedTeam = null;

  // If question is already answered, show reset option
  if (isAnswered) {
    const resetConfirm = confirm('This question has already been answered. Do you want to reset it and play it again?');
    if (!resetConfirm) return;

    // Reset the question by removing it from answered list
    const questionId = GameState.getQuestionId(categoryIndex, questionIndex);
    const index = currentGame.state.answeredQuestions.indexOf(questionId);
    if (index > -1) {
      // Add to history
      History.addAction(currentGame, 'question-reset', {
        categoryIndex: categoryIndex,
        questionIndex: questionIndex,
        questionId: questionId
      });

      currentGame.state.answeredQuestions.splice(index, 1);
      Storage.updateGame(currentGame.id, currentGame);
      renderGame();
      return;
    }
  }

  selectedTeam = null;
  currentWager = 0;

  document.getElementById('categoryTitle').textContent = currentQuestion.categoryName;
  document.getElementById('questionValue').textContent = `$${currentQuestion.value}`;
  renderFormattedText(document.getElementById('questionText'), currentQuestion.question);
  renderFormattedText(document.getElementById('answerText'), currentQuestion.answer);

  // Reset sections
  document.getElementById('dailyDoubleScreen').style.display = 'none';
  document.getElementById('questionScreen').style.display = 'none';
  document.getElementById('buzzerSection').style.display = 'none';
  document.getElementById('answerSection').style.display = 'none';
  document.getElementById('answerText').style.display = 'none';
  document.getElementById('judgmentButtons').style.display = 'none';

  // Check if Daily Double
  if (currentQuestion.dailyDouble) {
    showDailyDouble();
  } else {
    showQuestion();
  }

  openModal(questionModal);
}

// Daily Double flow
function showDailyDouble() {
  document.getElementById('dailyDoubleScreen').style.display = 'block';

  // For Daily Double, first team or prompt for team selection
  const team = currentGame.state.teams[0];
  selectedTeam = team;

  document.getElementById('dailyDoubleTeam').textContent = `${team.name}, make your wager!`;

  const minWager = GameState.getMinWager();
  const maxWager = GameState.getMaxWager(currentGame, team.id);

  document.getElementById('wagerInput').value = '';
  document.getElementById('wagerInput').min = minWager;
  document.getElementById('wagerInput').max = maxWager;
  document.getElementById('wagerHint').textContent = `Minimum: $${minWager}, Maximum: $${maxWager}`;

  const submitWagerBtn = document.getElementById('submitWagerBtn');
  submitWagerBtn.onclick = () => {
    const wager = parseInt(document.getElementById('wagerInput').value);

    if (isNaN(wager) || wager < minWager || wager > maxWager) {
      alert(`Please enter a valid wager between $${minWager} and $${maxWager}`);
      return;
    }

    currentWager = wager;
    document.getElementById('dailyDoubleScreen').style.display = 'none';
    showQuestion(true);
  };
}

// Show question
function showQuestion(isDailyDouble = false) {
  document.getElementById('questionScreen').style.display = 'block';

  // Display image if present
  const questionImageContainer = document.getElementById('questionImage');
  const questionImageElement = document.getElementById('questionImageElement');
  if (currentQuestion.image) {
    questionImageElement.src = currentQuestion.image;
    questionImageContainer.style.display = 'block';
  } else {
    questionImageContainer.style.display = 'none';
  }

  if (isDailyDouble) {
    document.getElementById('questionValue').textContent = `Daily Double - Wager: $${currentWager}`;
    document.getElementById('answerSection').style.display = 'block';
  } else {
    renderBuzzerButtons();
    document.getElementById('buzzerSection').style.display = 'block';
  }

  setupAnswerSection();
}

// Render buzzer buttons
function renderBuzzerButtons() {
  const container = document.getElementById('buzzerButtons');
  container.innerHTML = '';

  // Filter out teams that have already attempted
  const availableTeams = currentGame.state.teams.filter(team =>
    !attemptedTeams.includes(team.id)
  );

  if (availableTeams.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">All teams have attempted this question.</p>';
    return;
  }

  availableTeams.forEach(team => {
    const btn = document.createElement('button');
    btn.className = 'buzzer-btn';
    btn.textContent = team.name;
    btn.style.backgroundColor = team.color;
    btn.style.borderColor = team.color;
    btn.onclick = () => selectTeam(team);
    container.appendChild(btn);
  });
}

// Select team
function selectTeam(team) {
  selectedTeam = team;
  document.getElementById('buzzerSection').style.display = 'none';
  document.getElementById('answerSection').style.display = 'block';
}

// Setup answer section
function setupAnswerSection() {
  const revealBtn = document.getElementById('revealBtn');
  const answerText = document.getElementById('answerText');
  const judgmentButtons = document.getElementById('judgmentButtons');

  const showAnswers = currentGame.state.settings.showAnswers;

  // Always show judgment buttons
  judgmentButtons.style.display = 'flex';

  if (showAnswers) {
    // Auto-show answer
    answerText.style.display = 'block';
    revealBtn.style.display = 'none';
  } else {
    // Hide answer until revealed
    answerText.style.display = 'none';
    revealBtn.style.display = 'inline-block';

    revealBtn.onclick = () => {
      answerText.style.display = 'block';
      revealBtn.style.display = 'none';
    };
  }

  document.getElementById('correctBtn').onclick = () => handleAnswer(true);
  document.getElementById('incorrectBtn').onclick = () => handleAnswer(false);
}

// Handle answer
function handleAnswer(isCorrect) {
  if (!selectedTeam) {
    alert('No team selected');
    return;
  }

  const isDailyDouble = currentQuestion.dailyDouble;
  const points = isDailyDouble ? currentWager : currentQuestion.value;
  const pointChange = isCorrect ? points : -points;

  // Add to history before making changes
  const historyData = {
    teamId: selectedTeam.id,
    teamName: selectedTeam.name,
    categoryIndex: currentQuestion.categoryIndex,
    questionIndex: currentQuestion.questionIndex,
    pointChange: pointChange,
    correct: isCorrect
  };

  if (isDailyDouble) {
    History.addAction(currentGame, 'daily-double', historyData);
  } else {
    History.addAction(currentGame, isCorrect ? 'answer-correct' : 'answer-incorrect', historyData);
  }

  // Update score
  GameState.updateScore(currentGame, selectedTeam.id, pointChange);

  // If incorrect and not a daily double, allow another team to try
  if (!isCorrect && !isDailyDouble) {
    // Add this team to attempted list
    attemptedTeams.push(selectedTeam.id);
    selectedTeam = null;

    // Check if there are more teams available
    const availableTeams = currentGame.state.teams.filter(team =>
      !attemptedTeams.includes(team.id)
    );

    if (availableTeams.length > 0) {
      // Hide answer section, show buzzer section again
      document.getElementById('answerSection').style.display = 'none';
      document.getElementById('buzzerSection').style.display = 'block';
      renderBuzzerButtons();

      // Save state but don't mark as answered yet
      Storage.updateGame(currentGame.id, currentGame);
      return; // Don't close modal
    }
  }

  // Mark question as answered (correct answer or all teams attempted or daily double)
  GameState.markQuestionAnswered(currentGame, currentQuestion.categoryIndex, currentQuestion.questionIndex);

  // Save to storage
  Storage.updateGame(currentGame.id, currentGame);

  // Close modal and refresh
  closeModal(questionModal);
  renderGame();
}

// Undo/Redo
function undo() {
  History.undo(currentGame);
  Storage.updateGame(currentGame.id, currentGame);
  renderGame();
}

function redo() {
  History.redo(currentGame);
  Storage.updateGame(currentGame.id, currentGame);
  renderGame();
}

function updateUndoRedoButtons() {
  undoBtn.disabled = !History.canUndo(currentGame);
  redoBtn.disabled = !History.canRedo(currentGame);
}

// Menu modal
function openMenu() {
  renderTeamsManager();
  renderSettings();
  renderHistory();
  openModal(menuModal);
}

function renderTeamsManager() {
  const container = document.getElementById('teamsManager');
  container.innerHTML = '';

  currentGame.state.teams.forEach(team => {
    const item = document.createElement('div');
    item.className = 'team-item';
    item.style.borderLeftColor = team.color;
    item.innerHTML = `
      <div class="team-item-info">
        <strong>${team.name}</strong>
        <span>$${team.score}</span>
      </div>
      <div class="team-item-actions">
        <button class="btn btn-small btn-secondary" onclick="editTeam('${team.id}')">Edit</button>
        ${currentGame.state.teams.length > 1 ? `<button class="btn btn-small btn-danger" onclick="removeTeam('${team.id}')">Remove</button>` : ''}
      </div>
    `;
    container.appendChild(item);
  });
}

function renderSettings() {
  document.getElementById('timerToggle').checked = currentGame.state.settings.timerEnabled;
  document.getElementById('soundToggle').checked = currentGame.state.settings.soundEnabled;
  document.getElementById('showAnswersToggle').checked = currentGame.state.settings.showAnswers;
  document.getElementById('negativeScoresToggle').checked = currentGame.state.settings.allowNegativeScores;

  document.getElementById('timerToggle').onchange = (e) => {
    currentGame.state.settings.timerEnabled = e.target.checked;
    Storage.updateGame(currentGame.id, currentGame);
  };

  document.getElementById('soundToggle').onchange = (e) => {
    currentGame.state.settings.soundEnabled = e.target.checked;
    Storage.updateGame(currentGame.id, currentGame);
  };

  document.getElementById('showAnswersToggle').onchange = (e) => {
    currentGame.state.settings.showAnswers = e.target.checked;
    Storage.updateGame(currentGame.id, currentGame);
  };

  document.getElementById('negativeScoresToggle').onchange = (e) => {
    currentGame.state.settings.allowNegativeScores = e.target.checked;
    Storage.updateGame(currentGame.id, currentGame);
  };
}

function renderHistory() {
  const container = document.getElementById('historyList');
  const history = History.getHistorySummary(currentGame);

  if (history.length === 0) {
    container.innerHTML = '<div class="history-empty">No actions yet</div>';
    return;
  }

  container.innerHTML = '';
  history.reverse().forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item' + (entry.isCurrent ? ' current' : '');
    item.textContent = entry.description;
    container.appendChild(item);
  });
}

// Team management
window.addTeam = function() {
  if (currentGame.state.teams.length >= 6) {
    alert('Maximum 6 teams allowed');
    return;
  }

  History.addAction(currentGame, 'team-add', {
    teamName: `Team ${currentGame.state.teams.length + 1}`
  });

  GameState.addTeam(currentGame);
  Storage.updateGame(currentGame.id, currentGame);
  renderGame();
  renderTeamsManager();
};

window.removeTeam = function(teamId) {
  if (currentGame.state.teams.length <= 1) {
    alert('Must have at least 1 team');
    return;
  }

  const team = GameState.getTeam(currentGame, teamId);

  History.addAction(currentGame, 'team-remove', {
    teamId: teamId,
    teamName: team.name
  });

  GameState.removeTeam(currentGame, teamId);
  Storage.updateGame(currentGame.id, currentGame);
  renderGame();
  renderTeamsManager();
};

let editingTeamId = null;

window.editTeam = function(teamId) {
  editingTeamId = teamId;
  const team = GameState.getTeam(currentGame, teamId);

  document.getElementById('teamNameInput').value = team.name;
  document.getElementById('teamColorInput').value = team.color;
  document.getElementById('teamScoreInput').value = team.score;

  openModal(editTeamModal);
};

function saveTeamEdit() {
  if (!editingTeamId) return;

  const team = GameState.getTeam(currentGame, editingTeamId);
  const oldName = team.name;
  const oldScore = team.score;

  const newName = document.getElementById('teamNameInput').value;
  const newColor = document.getElementById('teamColorInput').value;
  const newScore = parseInt(document.getElementById('teamScoreInput').value) || 0;

  History.addAction(currentGame, 'team-update', {
    teamId: editingTeamId,
    teamName: oldName,
    updates: { name: newName, color: newColor, score: newScore }
  });

  GameState.updateTeam(currentGame, editingTeamId, {
    name: newName,
    color: newColor,
    score: newScore
  });

  Storage.updateGame(currentGame.id, currentGame);
  closeModal(editTeamModal);
  renderGame();
  renderTeamsManager();
  editingTeamId = null;
}

// Modal controls
function openModal(modal) {
  modal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
}

// Setup event listeners
function setupEventListeners() {
  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  menuBtn.addEventListener('click', openMenu);

  document.getElementById('addTeamBtn').addEventListener('click', () => window.addTeam());
  document.getElementById('closeMenuBtn').addEventListener('click', () => closeModal(menuModal));
  document.getElementById('cancelEditTeamBtn').addEventListener('click', () => closeModal(editTeamModal));
  document.getElementById('saveTeamBtn').addEventListener('click', saveTeamEdit);

  // Close modals on backdrop click
  questionModal.addEventListener('click', (e) => {
    if (e.target === questionModal) closeModal(questionModal);
  });
  menuModal.addEventListener('click', (e) => {
    if (e.target === menuModal) closeModal(menuModal);
  });
  editTeamModal.addEventListener('click', (e) => {
    if (e.target === editTeamModal) closeModal(editTeamModal);
  });

  // Close buttons
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(questionModal);
      closeModal(menuModal);
      closeModal(editTeamModal);
      closeModal(finalJeopardyModal);
    });
  });

  // Final Jeopardy button
  const finalJeopardyBtn = document.getElementById('finalJeopardyBtn');
  if (finalJeopardyBtn) {
    finalJeopardyBtn.addEventListener('click', openFinalJeopardy);
  }
}

// Final Jeopardy Implementation
const finalJeopardyModal = document.getElementById('finalJeopardyModal');

function checkFinalJeopardyAvailability() {
  const fjBtn = document.getElementById('finalJeopardyBtn');
  if (!fjBtn) return;

  // Show button if Final Jeopardy exists and not completed
  if (GameState.hasFinalJeopardy(currentGame) &&
      !currentGame.state.finalJeopardy?.completed) {
    fjBtn.style.display = 'inline-block';
  } else {
    fjBtn.style.display = 'none';
  }
}

function openFinalJeopardy() {
  if (!GameState.hasFinalJeopardy(currentGame)) return;

  // Check if board is complete
  const progress = GameState.getProgress(currentGame);
  if (progress.answered < progress.total) {
    const remaining = progress.total - progress.answered;
    const message = `There are ${remaining} question${remaining !== 1 ? 's' : ''} remaining on the board. Are you sure you want to go to Final Jeopardy now?`;
    if (!confirm(message)) {
      return;
    }
  }

  const fj = currentGame.config.finalJeopardy;
  const fjState = currentGame.state.finalJeopardy || { wagers: {}, answers: {}, completed: false };

  // Set category in all places
  document.querySelectorAll('.fj-category-name').forEach(el => {
    el.textContent = fj.category;
  });

  // Determine which phase to show
  const allWagersSet = currentGame.state.teams.every(team =>
    fjState.wagers.hasOwnProperty(team.id)
  );

  const allAnswersJudged = currentGame.state.teams.every(team =>
    fjState.answers.hasOwnProperty(team.id)
  );

  if (allAnswersJudged) {
    // Skip to complete
    completeFinalJeopardy();
    return;
  } else if (allWagersSet) {
    // Show answer phase
    showFJAnswerPhase();
  } else {
    // Show wager phase
    showFJWagerPhase();
  }

  openModal(finalJeopardyModal);
}

function showFJWagerPhase() {
  document.getElementById('fjWagerPhase').style.display = 'block';
  document.getElementById('fjQuestionPhase').style.display = 'none';
  document.getElementById('fjAnswerPhase').style.display = 'none';

  const wagerList = document.getElementById('fjWagerList');
  const fjState = currentGame.state.finalJeopardy || { wagers: {}, answers: {}, completed: false };

  wagerList.innerHTML = '';

  currentGame.state.teams.forEach(team => {
    const maxWager = GameState.getFinalJeopardyMaxWager(currentGame, team.id);
    const hasWager = fjState.wagers.hasOwnProperty(team.id);
    const wagerValue = fjState.wagers[team.id] || 0;

    const item = document.createElement('div');
    item.className = 'fj-wager-item' + (hasWager ? ' complete' : '');
    item.innerHTML = `
      <div class="fj-wager-team">
        <div class="fj-team-color" style="background-color: ${team.color}"></div>
        <div class="fj-team-info">
          <h4>${team.name}</h4>
          <div class="fj-team-score">Current Score: $${team.score}</div>
        </div>
      </div>
      <div class="fj-wager-input-group">
        <input type="number" class="fj-wager-input"
               data-team-id="${team.id}"
               min="0" max="${maxWager}"
               value="${wagerValue}"
               placeholder="$0 - $${maxWager}">
      </div>
    `;
    wagerList.appendChild(item);
  });

  // Check if all wagers are set
  updateFJRevealButton();

  // Add input listeners
  wagerList.querySelectorAll('.fj-wager-input').forEach(input => {
    input.addEventListener('input', updateFJRevealButton);
  });

  // Reveal question button
  const revealBtn = document.getElementById('fjRevealQuestionBtn');
  revealBtn.onclick = () => {
    // Validate and save all wagers
    let valid = true;
    wagerList.querySelectorAll('.fj-wager-input').forEach(input => {
      const teamId = input.dataset.teamId;
      const wager = parseInt(input.value) || 0;
      const maxWager = GameState.getFinalJeopardyMaxWager(currentGame, teamId);

      if (wager < 0) {
        alert('Wagers cannot be negative.');
        valid = false;
        return;
      }

      if (wager > maxWager) {
        const team = GameState.getTeam(currentGame, teamId);
        alert(`${team.name}'s wager ($${wager}) exceeds their maximum allowed wager of $${maxWager}.`);
        valid = false;
        return;
      }

      GameState.setFinalJeopardyWager(currentGame, teamId, wager);
    });

    if (!valid) return;

    Storage.updateGame(currentGame.id, currentGame);
    showFJQuestionPhase();
  };
}

function updateFJRevealButton() {
  const inputs = document.querySelectorAll('.fj-wager-input');
  const allFilled = Array.from(inputs).every(input => {
    const value = parseInt(input.value);
    return !isNaN(value) && value >= 0;
  });

  document.getElementById('fjRevealQuestionBtn').disabled = !allFilled;
}

function showFJQuestionPhase() {
  document.getElementById('fjWagerPhase').style.display = 'none';
  document.getElementById('fjQuestionPhase').style.display = 'block';
  document.getElementById('fjAnswerPhase').style.display = 'none';

  const fj = currentGame.config.finalJeopardy;
  const fjState = currentGame.state.finalJeopardy;

  renderFormattedText(document.getElementById('fjQuestionText'), fj.question);

  // Show wagers summary
  const summary = document.getElementById('fjWagersSummary');
  summary.innerHTML = currentGame.state.teams.map(team => `
    <div class="fj-wager-summary-item">
      <span><strong>${team.name}</strong></span>
      <span>$${fjState.wagers[team.id] || 0}</span>
    </div>
  `).join('');

  document.getElementById('fjRevealAnswerBtn').onclick = () => {
    showFJAnswerPhase();
  };
}

function showFJAnswerPhase() {
  document.getElementById('fjWagerPhase').style.display = 'none';
  document.getElementById('fjQuestionPhase').style.display = 'none';
  document.getElementById('fjAnswerPhase').style.display = 'block';

  const fj = currentGame.config.finalJeopardy;
  const fjState = currentGame.state.finalJeopardy;

  renderFormattedText(document.getElementById('fjQuestionText2'), fj.question);
  renderFormattedText(document.getElementById('fjAnswerText'), fj.answer);

  // Show scoring
  const scoringList = document.getElementById('fjScoringList');
  scoringList.innerHTML = '';

  currentGame.state.teams.forEach(team => {
    const hasAnswer = fjState.answers.hasOwnProperty(team.id);
    const wager = fjState.wagers[team.id] || 0;

    const item = document.createElement('div');
    item.className = 'fj-scoring-item' + (hasAnswer ? ' answered' : '');
    item.innerHTML = `
      <div class="fj-scoring-team">
        <div class="fj-team-color" style="background-color: ${team.color}"></div>
        <div class="fj-team-info">
          <h4>${team.name}</h4>
          <div class="fj-team-score">Wager: $${wager}</div>
        </div>
      </div>
      <div class="fj-scoring-buttons">
        <button class="btn btn-success btn-small" data-team-id="${team.id}" data-correct="true" ${hasAnswer ? 'disabled' : ''}>
          Correct
        </button>
        <button class="btn btn-danger btn-small" data-team-id="${team.id}" data-correct="false" ${hasAnswer ? 'disabled' : ''}>
          Incorrect
        </button>
      </div>
    `;
    scoringList.appendChild(item);
  });

  // Add button listeners
  scoringList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const teamId = btn.dataset.teamId;
      const isCorrect = btn.dataset.correct === 'true';

      GameState.setFinalJeopardyAnswer(currentGame, teamId, isCorrect);
      Storage.updateGame(currentGame.id, currentGame);

      // Refresh display
      showFJAnswerPhase();
      checkCompleteButton();
    });
  });

  checkCompleteButton();

  document.getElementById('fjCompleteBtn').onclick = () => {
    completeFinalJeopardy();
  };
}

function checkCompleteButton() {
  const fjState = currentGame.state.finalJeopardy;
  const allAnswered = currentGame.state.teams.every(team =>
    fjState.answers.hasOwnProperty(team.id)
  );

  document.getElementById('fjCompleteBtn').disabled = !allAnswered;
}

function completeFinalJeopardy() {
  GameState.completeFinalJeopardy(currentGame);
  Storage.updateGame(currentGame.id, currentGame);

  closeModal(finalJeopardyModal);
  renderGame();

  alert('Final Jeopardy Complete! Game Over!');
}
