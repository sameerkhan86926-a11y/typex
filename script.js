"use strict";

/* ==========================================
   TYPEX — TYPING ARCADE
   File: script.js
   Six distinct PC typing game modes
   ========================================== */

(() => {
  const $ = (selector) => document.querySelector(selector);

  const canvas = $("#game-canvas");
  const ctx = canvas.getContext("2d");

  const arena = $("#arena");
  const startOverlay = $("#start-overlay");
  const resultOverlay = $("#result-overlay");

  const startButton = $("#start-button");
  const restartButton = $("#restart-button");

  const typingForm = $("#typing-form");
  const typingInput = $("#typing-input");
  const submitButton = $("#submit-button");

  const modeCards = [...document.querySelectorAll(".mode-card")];

  const MODES = {
    bubble: {
      title: "Bubble Pop",
      label: "MODE 01 / BUBBLE POP",
      instruction: "Type the letter displayed inside a bubble.",
      inputLabel: "ENTER TARGET LETTER",
      placeholder: "Type a bubble letter...",
      overlayTitle: "Ready to pop?",
      overlayDescription:
        "Type the letter shown inside a bubble before it escapes.",
      lives: 3
    },

    wordrain: {
      title: "Word Rain",
      label: "MODE 02 / WORD RAIN",
      instruction: "Type a complete falling word and press Enter.",
      inputLabel: "TYPE THE FALLING WORD",
      placeholder: "Type the complete word...",
      overlayTitle: "Catch the words.",
      overlayDescription:
        "Type complete words before they reach the bottom.",
      lives: 3
    },

    survival: {
      title: "Last Stand",
      label: "MODE 03 / LAST STAND",
      instruction: "Type an enemy's code to destroy it.",
      inputLabel: "ENTER ENEMY CODE",
      placeholder: "Type an enemy code...",
      overlayTitle: "Defend your base.",
      overlayDescription:
        "Enemies approach through three lanes. Destroy their codes before they breach your defense.",
      lives: 3
    },

    boss: {
      title: "Boss Fight",
      label: "MODE 04 / BOSS FIGHT",
      instruction: "Type the attack word to damage the boss.",
      inputLabel: "ENTER ATTACK WORD",
      placeholder: "Type the attack word...",
      overlayTitle: "Challenge the boss.",
      overlayDescription:
        "Hit the boss with attack words. Every correct word reduces its health.",
      lives: 3
    },

    bomb: {
      title: "Bomb Defuse",
      label: "MODE 05 / BOMB DEFUSE",
      instruction: "Enter the exact bomb code before the countdown ends.",
      inputLabel: "ENTER DEFUSAL CODE",
      placeholder: "Type the exact code...",
      overlayTitle: "Time is ticking.",
      overlayDescription:
        "Type the exact code before the bomb timer reaches zero. Every defusal earns points.",
      lives: 3
    },

    memory: {
      title: "Memory Master",
      label: "MODE 06 / MEMORY MASTER",
      instruction: "Memorize the sequence, then type it after it disappears.",
      inputLabel: "RECALL THE SEQUENCE",
      placeholder: "Type the sequence...",
      overlayTitle: "Trust your memory.",
      overlayDescription:
        "A sequence appears briefly. Memorize it, then reproduce it exactly.",
      lives: 3
    }
  };

  const WORDS = [
    "neon", "matrix", "cyber", "pixel", "shadow",
    "quantum", "vector", "signal", "rocket", "system",
    "phantom", "reactor", "plasma", "thunder", "crystal",
    "velocity", "terminal", "warrior", "digital", "infinity",
    "lightning", "protocol", "overdrive", "firewall", "vortex",
    "sentinel", "hyperion", "starlight", "nightfall", "titanium",
    "spectrum", "frequency", "algorithm", "blueprint", "eclipse"
  ];

  const MEMORY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const LANES = [0.25, 0.5, 0.75];

  const state = {
    mode: "bubble",
    running: false,
    paused: false,
    ended: false,

    score: 0,
    hits: 0,
    misses: 0,
    typedCharacters: 0,
    correctCharacters: 0,

    combo: 0,
    bestCombo: 0,
    lives: 3,

    targets: [],
    particles: [],
    floatingTexts: [],

    startedAt: 0,
    elapsed: 0,
    lastFrame: 0,
    lastSpawn: 0,

    level: 1,
    targetId: 0,

    bossHealth: 100,
    bossMaxHealth: 100,
    bossAttackWord: "",

    bombCode: "",
    bombDeadline: 0,
    bombsDefused: 0,

    memorySequence: "",
    memoryPhase: "show",
    memoryDeadline: 0,
    memoryRound: 0,

    survivalDistance: 0,
    nextEnemyId: 0,

    lastScore: 0,
    audioContext: null
  };

  let animationId = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pixelRatio = 1;
  let resizeObserver = null;

  /* ==========================================
     CANVAS SETUP
     ========================================== */

  function resizeCanvas() {
    const rect = arena.getBoundingClientRect();

    canvasWidth = Math.max(1, rect.width);
    canvasHeight = Math.max(1, rect.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(canvasWidth * pixelRatio);
    canvas.height = Math.round(canvasHeight * pixelRatio);

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    drawScene(performance.now());
  }

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(arena);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }

  /* ==========================================
     AUDIO
     ========================================== */

  function playSound(type) {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (!state.audioContext) {
        state.audioContext = new AudioContextClass();
      }

      const audio = state.audioContext;

      if (audio.state === "suspended") {
        audio.resume();
      }

      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      const sounds = {
        hit: [660, 0.075, "sine"],
        miss: [170, 0.13, "triangle"],
        pop: [520, 0.08, "sine"],
        boom: [90, 0.28, "sawtooth"],
        level: [880, 0.12, "sine"],
        success: [740, 0.16, "triangle"]
      };

      const sound = sounds[type] || sounds.hit;

      oscillator.type = sound[2];
      oscillator.frequency.setValueAtTime(
        sound[0],
        audio.currentTime
      );

      if (type === "boom") {
        oscillator.frequency.exponentialRampToValueAtTime(
          35,
          audio.currentTime + sound[1]
        );
      }

      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.08,
        audio.currentTime + 0.012
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audio.currentTime + sound[1]
      );

      oscillator.connect(gain);
      gain.connect(audio.destination);

      oscillator.start();
      oscillator.stop(audio.currentTime + sound[1] + 0.02);
    } catch (_) {
      // Audio is optional; the game must still work without it.
    }
  }

  /* ==========================================
     GENERAL UTILITIES
     ========================================== */

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
  }

  function choose(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function randomWord() {
    return choose(WORDS);
  }

  function randomCode(length = 5) {
    let result = "";

    for (let i = 0; i < length; i++) {
      result += MEMORY_CHARS[
        Math.floor(Math.random() * MEMORY_CHARS.length)
      ];
    }

    return result;
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));

    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(remaining).padStart(2, "0")
    );
  }

  function normalize(value) {
    return value.trim().toUpperCase();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function showMessage(text) {
    $("#typing-instruction").textContent = text;
  }

  function getAccuracy() {
    const total = state.hits + state.misses;

    if (total === 0) return 100;

    return Math.round((state.hits / total) * 100);
  }

  function getWPM() {
    const minutes = state.elapsed / 60;

    if (minutes <= 0) return 0;

    return Math.round((state.correctCharacters / 5) / minutes);
  }

  function getLevel() {
    return Math.max(1, 1 + Math.floor(state.score / 500));
  }

  function addScore(points) {
    state.score += points;
    state.lastScore = points;
    $("#score-change").textContent = "+" + points;
    updateStats();
  }

  function registerHit(points = 100) {
    state.hits++;
    state.combo++;

    state.bestCombo = Math.max(
      state.bestCombo,
      state.combo
    );

    const comboBonus = Math.min(state.combo - 1, 10) * 5;

    addScore(points + comboBonus);

    playSound("hit");

    updateStats();
  }

  function registerMiss(message = "Missed! Stay focused.") {
    state.misses++;
    state.combo = 0;

    playSound("miss");

    showMessage(message);
    updateStats();
  }

  function loseLife(message) {
    state.lives = Math.max(0, state.lives - 1);
    state.combo = 0;

    updateStats();

    if (state.lives <= 0) {
      endGame("GAME OVER", message || "All lives lost.");
      return true;
    }

    showMessage(message || "Careful! One life lost.");
    playSound("miss");

    return false;
  }

  function addFloatingText(x, y, text, color = "#62f5bd") {
    state.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 1
    });
  }

  function addParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(35, 150);

      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(0.25, 0.7),
        maxLife: 0.7,
        size: random(1.5, 4),
        color
      });
    }
  }

  /* ==========================================
     HUD
     ========================================== */

  function updateStats() {
    $("#score-value").textContent =
      String(state.score).padStart(6, "0");

    $("#accuracy-value").textContent = getAccuracy();

    $("#accuracy-bar").style.width =
      getAccuracy() + "%";

    $("#wpm-value").textContent = getWPM();

    $("#combo-value").textContent = "x" + state.combo;

    $("#combo-bar").style.width =
      Math.min(100, state.combo * 10) + "%";

    $("#best-combo").textContent =
      "BEST " + state.bestCombo;

    $("#lives-value").textContent =
      state.lives + " / 3";

    $("#hits-value").textContent = state.hits;
    $("#misses-value").textContent = state.misses;

    $("#mission-mode").textContent =
      MODES[state.mode].title.toUpperCase();

    $("#arena-level").textContent =
      "LEVEL " + String(state.level).padStart(2, "0");
  }

  function setGameStatus(text, active = false) {
    const element = $("#game-status");

    element.innerHTML = "";

    const dot = document.createElement("span");
    dot.className = "status-dot";

    if (!active) {
      dot.style.background = "#8994ac";
      dot.style.boxShadow = "none";
    }

    element.append(dot, document.createTextNode(text));
  }

  function updateClock() {
    $("#arena-time").textContent =
      formatTime(state.elapsed);
  }

  /* ==========================================
     MODE SELECTION
     ========================================== */

  function selectMode(mode) {
    if (!MODES[mode]) return;

    if (state.running) {
      stopGame(false);
    }

    state.mode = mode;

    modeCards.forEach((card) => {
      card.classList.toggle(
        "selected",
        card.dataset.mode === mode
      );
    });

    const config = MODES[mode];

    $("#active-mode-title").textContent = config.title;
    $("#arena-mode-label").textContent = config.label;
    $("#overlay-title").textContent = config.overlayTitle;
    $("#overlay-description").textContent =
      config.overlayDescription;

    $("#typing-label-text").textContent = config.inputLabel;

    typingInput.placeholder = config.placeholder;

    showMessage(config.instruction);

    startOverlay.classList.remove("hidden");
    resultOverlay.classList.add("hidden");

    typingInput.value = "";
    typingInput.disabled = true;
    submitButton.disabled = true;

    setGameStatus("READY", false);

    resetGameState();
    updateStats();

    drawScene(performance.now());
  }

  modeCards.forEach((card) => {
    card.addEventListener("click", () => {
      selectMode(card.dataset.mode);
    });
  });

  /* ==========================================
     RESET / START / STOP
     ========================================== */

  function resetGameState() {
    state.running = false;
    state.paused = false;
    state.ended = false;

    state.score = 0;
    state.hits = 0;
    state.misses = 0;
    state.typedCharacters = 0;
    state.correctCharacters = 0;

    state.combo = 0;
    state.bestCombo = 0;
    state.lives = 3;

    state.targets = [];
    state.particles = [];
    state.floatingTexts = [];

    state.startedAt = 0;
    state.elapsed = 0;
    state.lastFrame = 0;
    state.lastSpawn = 0;

    state.level = 1;
    state.targetId = 0;

    state.bossHealth = 100;
    state.bossMaxHealth = 100;
    state.bossAttackWord = "";

    state.bombCode = "";
    state.bombDeadline = 0;
    state.bombsDefused = 0;

    state.memorySequence = "";
    state.memoryPhase = "show";
    state.memoryDeadline = 0;
    state.memoryRound = 0;

    state.survivalDistance = 0;
    state.nextEnemyId = 0;

    state.lastScore = 0;

    typingInput.value = "";

    updateStats();
    updateClock();
  }

  function startGame() {
    if (state.running && state.paused) {
      resumeGame();
      return;
    }

    if (state.running) return;

    if (state.ended) {
      resetGameState();
    }

    resetGameState();

    state.running = true;
    state.paused = false;
    state.ended = false;

    state.startedAt = performance.now();
    state.lastFrame = performance.now();
    state.lastSpawn = performance.now();

    startOverlay.classList.add("hidden");
    resultOverlay.classList.add("hidden");

    typingInput.disabled = false;
    submitButton.disabled = false;

    typingInput.value = "";

    setGameStatus("LIVE", true);

    prepareMode();

    updateStats();

    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);

    typingInput.focus({ preventScroll: true });
  }

  function stopGame(showReady = true) {
    state.running = false;
    state.paused = false;

    cancelAnimationFrame(animationId);

    typingInput.disabled = true;
    submitButton.disabled = true;

    if (showReady) {
      setGameStatus("READY", false);
    }
  }

  function pauseGame() {
    if (!state.running || state.paused) return;

    state.paused = true;

    setGameStatus("PAUSED", false);
    showMessage("Game paused. Press Escape to resume.");

    drawScene(performance.now());
  }

  function resumeGame() {
    if (!state.running || !state.paused) return;

    state.paused = false;
    state.lastFrame = performance.now();

    setGameStatus("LIVE", true);

    typingInput.focus({ preventScroll: true });

    animationId = requestAnimationFrame(gameLoop);
  }

  function endGame(title = "GAME OVER", description = "") {
    if (state.ended) return;

    state.running = false;
    state.paused = false;
    state.ended = true;

    cancelAnimationFrame(animationId);

    typingInput.disabled = true;
    submitButton.disabled = true;

    setGameStatus("MISSION ENDED", false);

    $("#result-title").textContent = title;
    $("#result-description").textContent =
      description || "Simulation complete.";

    $("#result-score").textContent =
      state.score.toLocaleString();

    $("#result-accuracy").textContent =
      getAccuracy() + "%";

    $("#result-wpm").textContent = getWPM();

    $("#result-kicker").textContent =
      state.lives > 0 ? "SIMULATION COMPLETE" : "MISSION FAILED";

    $("#result-symbol").textContent =
      state.lives > 0 ? "✓" : "!";

    resultOverlay.classList.remove("hidden");
    startOverlay.classList.add("hidden");

    updateStats();
    drawScene(performance.now());
  }

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);

  /* ==========================================
     PREPARE INDIVIDUAL GAME MODES
     ========================================== */

  function prepareMode() {
    const now = performance.now();

    if (state.mode === "bubble") {
      for (let i = 0; i < 5; i++) {
        spawnBubble(true);
      }

      showMessage("Type a bubble's letter to pop it.");
    }

    if (state.mode === "wordrain") {
      spawnWord(true);
      spawnWord(true);

      showMessage("Type the complete falling word.");
    }

    if (state.mode === "survival") {
      state.survivalDistance = 0;

      spawnEnemy(true);
      spawnEnemy(true);

      showMessage("Destroy enemies before they breach the base.");
    }

    if (state.mode === "boss") {
      state.bossHealth = 100;
      state.bossMaxHealth = 100;

      state.bossAttackWord = randomWord();

      state.targets = [];

      showMessage("Type the attack word to damage the boss.");
    }

    if (state.mode === "bomb") {
      state.bombsDefused = 0;
      spawnBomb(true, now);

      showMessage("Type the exact code before time runs out.");
    }

    if (state.mode === "memory") {
      state.memoryRound = 0;
      beginMemoryRound(now);
    }
  }

  /* ==========================================
     TARGET SPAWNING
     ========================================== */

  function spawnBubble(initial = false) {
    const radius = random(17, 24);
    const x = random(radius + 12, Math.max(radius + 13, canvasWidth - radius - 12));

    state.targets.push({
      id: ++state.targetId,
      type: "bubble",
      letter: String.fromCharCode(randomInt(65, 90)),
      x,
      y: initial ? random(75, canvasHeight * 0.65) : -radius - 10,
      radius,
      speed: random(30, 55) + state.level * 3,
      phase: random(0, Math.PI * 2),
      color: choose(["#a879ff", "#59e5ff", "#62f5bd"]),
      dead: false
    });
  }

  function spawnWord(initial = false) {
    const word = randomWord();

    state.targets.push({
      id: ++state.targetId,
      type: "word",
      word,
      x: random(75, Math.max(76, canvasWidth - 75)),
      y: initial ? random(85, canvasHeight * 0.45) : -35,
      speed: random(24, 42) + state.level * 3,
      width: Math.max(65, word.length * 10 + 24),
      height: 30,
      dead: false
    });
  }

  function spawnEnemy(initial = false) {
    const lane = randomInt(0, 2);
    const x = canvasWidth * LANES[lane];

    state.targets.push({
      id: ++state.targetId,
      type: "enemy",
      code: randomCode(4),
      lane,
      x,
      y: initial ? random(90, canvasHeight * 0.42) : 70,
      speed: random(18, 28) + state.level * 2,
      size: 27,
      dead: false
    });
  }

  function spawnBomb(initial = false, now = performance.now()) {
    state.targets = state.targets.filter(
      (target) => target.type !== "bomb"
    );

    const codeLength = Math.min(
      9,
      4 + state.bombsDefused + Math.floor(state.level / 2)
    );

    const duration = Math.max(5, 11 - state.bombsDefused * 0.4);

    state.bombCode = randomCode(codeLength);
    state.bombDeadline = now + duration * 1000;

    state.targets.push({
      id: ++state.targetId,
      type: "bomb",
      code: state.bombCode,
      x: canvasWidth / 2,
      y: canvasHeight * 0.49,
      radius: 48,
      deadline: state.bombDeadline,
      duration,
      dead: false
    });
  }

  /* ==========================================
     MEMORY MODE
     ========================================== */

  function beginMemoryRound(now = performance.now()) {
    state.memoryRound++;

    const length = Math.min(12, 3 + state.memoryRound);

    state.memorySequence = randomCode(length);
    state.memoryPhase = "show";

    state.memoryDeadline = now + Math.max(
      1300,
      3200 - state.memoryRound * 150
    );

    state.targets = [];

    typingInput.value = "";
    typingInput.disabled = true;
    submitButton.disabled = true;

    showMessage(
      "Memorize the sequence. It will disappear shortly."
    );

    updateStats();
  }

  function switchMemoryToInput(now) {
    state.memoryPhase = "input";
    state.memoryDeadline = now + 15000;

    typingInput.value = "";
    typingInput.disabled = false;
    submitButton.disabled = false;

    showMessage(
      "Sequence hidden! Type the complete sequence and press Enter."
    );

    typingInput.focus({ preventScroll: true });
  }

  /* ==========================================
     INPUT HANDLING
     ========================================== */

  typingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!state.running || state.paused || state.ended) {
      return;
    }

    const value = typingInput.value.trim();

    if (!value) return;

    submitTypedValue(value);
  });

  function submitTypedValue(rawValue) {
    const value = normalize(rawValue);

    if (!value) return;

    state.typedCharacters += rawValue.length;

    if (state.mode === "bubble") {
      const target = state.targets.find(
        (item) =>
          item.type === "bubble" &&
          !item.dead &&
          item.letter === value
      );

      if (target && value.length === 1) {
        destroyTarget(target, 80, "POP!");
      } else {
        registerMiss("No matching bubble. Try again.");
      }

      typingInput.value = "";
      return;
    }

    if (state.mode === "wordrain") {
      const target = state.targets.find(
        (item) =>
          item.type === "word" &&
          !item.dead &&
          item.word.toUpperCase() === value
      );

      if (target) {
        destroyTarget(target, 100 + target.word.length * 8, "WORD!");
      } else {
        registerMiss("That word is not falling right now.");
      }

      typingInput.value = "";
      return;
    }

    if (state.mode === "survival") {
      const target = state.targets.find(
        (item) =>
          item.type === "enemy" &&
          !item.dead &&
          item.code === value
      );

      if (target) {
        destroyTarget(target, 140, "DESTROYED!");
      } else {
        registerMiss("Enemy code not found.");
      }

      typingInput.value = "";
      return;
    }

    if (state.mode === "boss") {
      if (value === state.bossAttackWord.toUpperCase()) {
        const damage = 18 + Math.min(state.combo, 10) * 2;

        state.bossHealth = Math.max(
          0,
          state.bossHealth - damage
        );

        state.correctCharacters += rawValue.length;

        registerHit(100 + damage * 3);

        addFloatingText(
          canvasWidth / 2,
          canvasHeight * 0.3,
          "-" + damage + " HP",
          "#ff637e"
        );

        addParticles(
          canvasWidth / 2,
          canvasHeight * 0.36,
          "#ff637e",
          22
        );

        if (state.bossHealth <= 0) {
          addScore(500);
          endGame("BOSS DEFEATED!", "You defeated the boss. Incredible typing!");
          playSound("success");
          typingInput.value = "";
          return;
        }

        state.bossAttackWord = randomWord();

        showMessage("Direct hit! Type the next attack word.");
      } else {
        registerMiss("Wrong attack word. Try again.");
      }

      typingInput.value = "";
      return;
    }

    if (state.mode === "bomb") {
      const target = state.targets.find(
        (item) => item.type === "bomb" && !item.dead
      );

      if (target && value === target.code) {
        target.dead = true;

        state.bombsDefused++;

        state.correctCharacters += rawValue.length;

        registerHit(200 + state.bombsDefused * 25);

        addParticles(
          target.x,
          target.y,
          "#62f5bd",
          30
        );

        addFloatingText(
          target.x,
          target.y - 45,
          "DEFUSED!",
          "#62f5bd"
        );

        playSound("success");

        state.level = getLevel();

        if (state.bombsDefused >= 5) {
          endGame(
            "BOMB EXPERT!",
            "You successfully defused five bombs. Mission accomplished."
          );
          typingInput.value = "";
          return;
        }

        spawnBomb(false, performance.now());

        showMessage("Bomb defused! Next code generated.");

      } else {
        registerMiss("Incorrect code. The countdown continues.");
      }

      typingInput.value = "";
      return;
    }

    if (state.mode === "memory") {
      if (state.memoryPhase !== "input") {
        showMessage("Wait until the sequence disappears.");
        typingInput.value = "";
        return;
      }

      if (value === state.memorySequence) {
        state.correctCharacters += rawValue.length;

        registerHit(150 + state.memorySequence.length * 20);

        addFloatingText(
          canvasWidth / 2,
          canvasHeight / 2,
          "MEMORY PERFECT!",
          "#59e5ff"
        );

        playSound("level");

        if (state.memoryRound >= 8) {
          endGame(
            "MEMORY MASTER!",
            "You completed all eight memory rounds."
          );
          typingInput.value = "";
          return;
        }

        state.level = getLevel();

        beginMemoryRound(performance.now());

      } else {
        registerMiss("Sequence incorrect. Try the next sequence.");

        if (loseLife("Wrong sequence! One life lost.")) {
          typingInput.value = "";
          return;
        }

        beginMemoryRound(performance.now());
      }

      typingInput.value = "";
    }
  }

  /* ==========================================
     BUBBLE QUICK-KEY INPUT
     ========================================== */

  typingInput.addEventListener("input", () => {
    if (
      !state.running ||
      state.paused ||
      state.ended ||
      state.mode !== "bubble"
    ) {
      return;
    }

    const value = typingInput.value.toUpperCase();

    if (!value) return;

    const letter = value[value.length - 1];

    if (!/^[A-Z]$/.test(letter)) {
      typingInput.value = "";
      return;
    }

    state.typedCharacters++;

    const target = state.targets.find(
      (item) =>
        item.type === "bubble" &&
        !item.dead &&
        item.letter === letter
    );

    if (target) {
      destroyTarget(target, 80, "POP!");
    } else {
      registerMiss("No bubble with that letter.");
    }

    typingInput.value = "";
  });

  /* ==========================================
     KEYBOARD SHORTCUTS
     ========================================== */

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.running && !state.paused) {
        event.preventDefault();
        pauseGame();
      } else if (state.running && state.paused) {
        event.preventDefault();
        resumeGame();
      }

      return;
    }

    if (
      event.key === "Enter" &&
      !state.running &&
      !state.ended &&
      !event.repeat
    ) {
      event.preventDefault();
      startGame();
      return;
    }

    if (
      event.key === "Enter" &&
      state.ended &&
      !event.repeat
    ) {
      event.preventDefault();
      startGame();
      return;
    }

    if (
      event.key === "Tab" &&
      state.running &&
      !state.paused &&
      !state.ended
    ) {
      event.preventDefault();

      typingInput.focus({ preventScroll: true });
    }
  });

  /* ==========================================
     DESTROY TARGETS
     ========================================== */

  function destroyTarget(target, points, label) {
    if (!target || target.dead) return;

    target.dead = true;

    const color =
      target.type === "enemy" ? "#ff637e" :
      target.type === "word" ? "#59e5ff" :
      "#a879ff";

    addParticles(target.x, target.y, color, 15);

    addFloatingText(
      target.x,
      target.y - 20,
      label,
      color
    );

    state.correctCharacters +=
      target.type === "bubble"
        ? 1
        : target.type === "word"
          ? target.word.length
          : target.type === "enemy"
            ? target.code.length
            : 0;

    registerHit(points);

    state.level = getLevel();

    if (state.mode === "survival") {
      state.survivalDistance += 1;
    }

    showMessage(
      "Target destroyed! Keep the combo going."
    );
  }

  /* ==========================================
     GAME LOOP
     ========================================== */

  function gameLoop(now) {
    if (!state.running || state.paused || state.ended) {
      return;
    }

    const delta = Math.min(
      (now - state.lastFrame) / 1000,
      0.05
    );

    state.lastFrame = now;

    state.elapsed = Math.max(
      0,
      (now - state.startedAt) / 1000
    );

    updateGame(delta, now);
    updateParticles(delta);
    updateFloatingTexts(delta);

    updateClock();
    updateStats();

    drawScene(now);

    if (state.running && !state.paused && !state.ended) {
      animationId = requestAnimationFrame(gameLoop);
    }
  }

  /* ==========================================
     GAME UPDATES
     ========================================== */

  function updateGame(delta, now) {
    if (state.mode === "bubble") {
      updateBubbleMode(delta, now);
    }

    if (state.mode === "wordrain") {
      updateWordRainMode(delta, now);
    }

    if (state.mode === "survival") {
      updateSurvivalMode(delta, now);
    }

    if (state.mode === "boss") {
      updateBossMode(delta, now);
    }

    if (state.mode === "bomb") {
      updateBombMode(delta, now);
    }

    if (state.mode === "memory") {
      updateMemoryMode(now);
    }

    if (state.ended) return;

    state.targets = state.targets.filter(
      (target) => !target.dead
    );
  }

  /* ==========================================
     MODE 1 — BUBBLE POP
     ========================================== */

  function updateBubbleMode(delta, now) {
    const spawnDelay = Math.max(
      500,
      1200 - state.level * 65
    );

    if (now - state.lastSpawn > spawnDelay) {
      spawnBubble();
      state.lastSpawn = now;
    }

    for (const target of state.targets) {
      if (target.type !== "bubble" || target.dead) continue;

      target.y += target.speed * delta;
      target.x += Math.sin(now / 700 + target.phase) * 9 * delta;

      if (target.y - target.radius > canvasHeight) {
        target.dead = true;

        if (loseLife("A bubble escaped! One life lost.")) {
          return;
        }

        registerMiss("A bubble escaped.");
      }
    }
  }

  /* ==========================================
     MODE 2 — WORD RAIN
     ========================================== */

  function updateWordRainMode(delta, now) {
    const spawnDelay = Math.max(
      600,
      1800 - state.level * 95
    );

    if (now - state.lastSpawn > spawnDelay) {
      spawnWord();
      state.lastSpawn = now;
    }

    for (const target of state.targets) {
      if (target.type !== "word" || target.dead) continue;

      target.y += target.speed * delta;

      if (target.y > canvasHeight - 40) {
        target.dead = true;

        if (loseLife("A word escaped! One life lost.")) {
          return;
        }

        registerMiss("A word escaped.");
      }
    }
  }

  /* ==========================================
     MODE 3 — LAST STAND
     ========================================== */

  function updateSurvivalMode(delta, now) {
    const spawnDelay = Math.max(
      650,
      1700 - state.level * 100
    );

    if (now - state.lastSpawn > spawnDelay) {
      spawnEnemy();
      state.lastSpawn = now;
    }

    for (const target of state.targets) {
      if (target.type !== "enemy" || target.dead) continue;

      target.y += target.speed * delta;

      if (target.y >= canvasHeight - 65) {
        target.dead = true;

        if (loseLife("An enemy breached your base!")) {
          return;
        }

        registerMiss("Enemy reached your base.");
      }
    }
  }

  /* ==========================================
     MODE 4 — BOSS FIGHT
     ========================================== */

  function updateBossMode(delta, now) {
    // Boss health is reduced by correctly typed attack words.
    // The encounter ends when boss health reaches zero.
    // The player also loses a life after a wrong attack streak.
    if (!state.lastBossMistake) {
      state.lastBossMistake = now;
    }

    if (state.combo === 0 && now - state.lastBossMistake > 9000) {
      state.lastBossMistake = now;
    }
  }

  /* ==========================================
     MODE 5 — BOMB DEFUSE
     ========================================== */

  function updateBombMode(delta, now) {
    const bomb = state.targets.find(
      (target) => target.type === "bomb" && !target.dead
    );

    if (!bomb) return;

    const timeLeft = Math.max(
      0,
      (bomb.deadline - now) / 1000
    );

    bomb.timeLeft = timeLeft;

    if (timeLeft <= 0) {
      bomb.dead = true;

      addParticles(
        bomb.x,
        bomb.y,
        "#ff637e",
        32
      );

      playSound("boom");

      if (loseLife("BOOM! The bomb exploded. One life lost.")) {
        return;
      }

      spawnBomb(false, now);
    }
  }

  /* ==========================================
     MODE 6 — MEMORY MASTER
     ========================================== */

  function updateMemoryMode(now) {
    if (
      state.memoryPhase === "show" &&
      now >= state.memoryDeadline
    ) {
      switchMemoryToInput(now);
    }

    if (
      state.memoryPhase === "input" &&
      now >= state.memoryDeadline
    ) {
      state.misses++;
      state.combo = 0;

      if (loseLife("Time ran out! One life lost.")) {
        return;
      }

      beginMemoryRound(now);
    }
  }

  /* ==========================================
     PARTICLE UPDATES
     ========================================== */

  function updateParticles(delta) {
    for (const particle of state.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;

      particle.vx *= 0.97;
      particle.vy *= 0.97;

      particle.life -= delta;
    }

    state.particles = state.particles.filter(
      (particle) => particle.life > 0
    );
  }

  function updateFloatingTexts(delta) {
    for (const item of state.floatingTexts) {
      item.y -= 25 * delta;
      item.life -= delta * 1.3;
    }

    state.floatingTexts = state.floatingTexts.filter(
      (item) => item.life > 0
    );
  }

  /* ==========================================
     CANVAS DRAWING HELPERS
     ========================================== */

  function drawText(
    text,
    x,
    y,
    size = 12,
    color = "#f2f5ff",
    align = "center",
    font = "Inter"
  ) {
    ctx.save();

    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.font = `700 ${size}px "${font}"`;
    ctx.fillStyle = color;

    ctx.fillText(text, x, y);

    ctx.restore();
  }

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(
      radius,
      width / 2,
      height / 2
    );

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawScene(now) {
    if (!ctx || !canvasWidth || !canvasHeight) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    drawGrid(now);

    if (state.mode === "bubble") drawBubbles(now);
    if (state.mode === "wordrain") drawWords(now);
    if (state.mode === "survival") drawSurvival(now);
    if (state.mode === "boss") drawBoss(now);
    if (state.mode === "bomb") drawBomb(now);
    if (state.mode === "memory") drawMemory(now);

    drawParticles();
    drawFloatingTexts();

    if (state.paused) {
      drawPauseScreen();
    }
  }

  function drawGrid(now) {
    ctx.save();

    ctx.strokeStyle = "rgba(119, 136, 170, 0.035)";
    ctx.lineWidth = 1;

    const gridSize = 35;

    for (let x = 0; x < canvasWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    for (let y = 0; y < canvasHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    const scanY = (now / 30) % canvasHeight;

    const gradient = ctx.createLinearGradient(
      0,
      scanY - 20,
      0,
      scanY + 20
    );

    gradient.addColorStop(0, "rgba(89,229,255,0)");
    gradient.addColorStop(0.5, "rgba(89,229,255,0.035)");
    gradient.addColorStop(1, "rgba(89,229,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, scanY - 20, canvasWidth, 40);

    ctx.restore();
  }

  /* ==========================================
     DRAW MODE 1 — BUBBLES
     ========================================== */

  function drawBubbles(now) {
    for (const bubble of state.targets) {
      if (bubble.type !== "bubble" || bubble.dead) continue;

      const pulse =
        Math.sin(now / 240 + bubble.phase) * 2;

      const radius = bubble.radius + pulse;

      ctx.save();

      ctx.shadowBlur = 22;
      ctx.shadowColor = bubble.color;

      ctx.beginPath();
      ctx.arc(
        bubble.x,
        bubble.y,
        radius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = "rgba(168, 121, 255, 0.10)";
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = bubble.color;
      ctx.stroke();

      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(
        bubble.x - radius * 0.25,
        bubble.y - radius * 0.3,
        radius * 0.16,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fill();

      drawText(
        bubble.letter,
        bubble.x,
        bubble.y + 1,
        16,
        bubble.color,
        "center",
        "Orbitron"
      );

      ctx.restore();
    }

    drawModeLabel("TYPE THE LETTER", "#a879ff");
  }

  /* ==========================================
     DRAW MODE 2 — WORD RAIN
     ========================================== */

  function drawWords(now) {
    for (const target of state.targets) {
      if (target.type !== "word" || target.dead) continue;

      const width = target.width;
      const height = target.height;

      ctx.save();

      ctx.shadowBlur = 15;
      ctx.shadowColor = "#59e5ff";

      roundedRect(
        target.x - width / 2,
        target.y - height / 2,
        width,
        height,
        6
      );

      ctx.fillStyle = "rgba(89, 229, 255, 0.09)";
      ctx.fill();

      ctx.strokeStyle = "rgba(89, 229, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.shadowBlur = 0;

      drawText(
        target.word.toUpperCase(),
        target.x,
        target.y,
        11,
        "#a5f4ff",
        "center",
        "Orbitron"
      );

      ctx.restore();
    }

    drawModeLabel("WORD RAIN / TYPE TO DESTROY", "#59e5ff");
  }

  /* ==========================================
     DRAW MODE 3 — LAST STAND
     ========================================== */

  function drawSurvival(now) {
    ctx.save();

    for (let i = 0; i < 3; i++) {
      const laneX = canvasWidth * LANES[i];

      ctx.strokeStyle = "rgba(98, 245, 189, 0.12)";
      ctx.setLineDash([4, 9]);
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(laneX, 45);
      ctx.lineTo(laneX, canvasHeight - 38);
      ctx.stroke();

      ctx.setLineDash([]);

      drawText(
        "LANE " + (i + 1),
        laneX,
        43,
        8,
        "#566b78",
        "center",
        "Orbitron"
      );
    }

    const baseY = canvasHeight - 52;

    ctx.strokeStyle = "rgba(98, 245, 189, 0.45)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(15, baseY);
    ctx.lineTo(canvasWidth - 15, baseY);
    ctx.stroke();

    ctx.fillStyle = "rgba(98, 245, 189, 0.05)";
    ctx.fillRect(15, baseY, canvasWidth - 30, 20);

    drawText(
      "YOUR BASE",
      canvasWidth / 2,
      baseY + 10,
      8,
      "#62f5bd",
      "center",
      "Orbitron"
    );

    ctx.restore();

    for (const enemy of state.targets) {
      if (enemy.type !== "enemy" || enemy.dead) continue;

      const size = enemy.size;

      ctx.save();

      ctx.translate(enemy.x, enemy.y);

      ctx.shadowBlur = 16;
      ctx.shadowColor = "#ff637e";

      ctx.fillStyle = "rgba(255, 99, 126, 0.12)";
      ctx.strokeStyle = "#ff637e";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();

      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      drawText(
        enemy.code,
        0,
        0,
        9,
        "#ffd6de",
        "center",
        "Orbitron"
      );

      ctx.restore();
    }

    drawModeLabel("DESTROY ENEMIES BEFORE BREACH", "#ff637e");
  }

  /* ==========================================
     DRAW MODE 4 — BOSS FIGHT
     ========================================== */

  function drawBoss(now) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight * 0.37;

    const bossRadius = Math.min(
      65,
      canvasWidth * 0.12
    );

    const pulse = Math.sin(now / 250) * 4;

    ctx.save();

    ctx.shadowBlur = 30;
    ctx.shadowColor = "#ff637e";

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      bossRadius + pulse,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "rgba(255, 99, 126, 0.08)";
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ff637e";
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      bossRadius * 0.68,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle = "rgba(255, 99, 126, 0.35)";
    ctx.stroke();

    ctx.fillStyle = "#ff637e";

    ctx.fillRect(
      centerX - 19,
      centerY - 9,
      9,
      18
    );

    ctx.fillRect(
      centerX + 10,
      centerY - 9,
      9,
      18
    );

    ctx.restore();

    const barWidth = Math.min(
      canvasWidth * 0.65,
      310
    );

    const barX = centerX - barWidth / 2;
    const barY = centerY + bossRadius + 20;

    ctx.save();

    roundedRect(barX, barY, barWidth, 7, 4);
    ctx.fillStyle = "rgba(255, 99, 126, 0.15)";
    ctx.fill();

    const healthWidth =
      barWidth * (state.bossHealth / state.bossMaxHealth);

    if (healthWidth > 0) {
      roundedRect(barX, barY, healthWidth, 7, 4);

      ctx.fillStyle = "#ff637e";
      ctx.fill();
    }

    ctx.restore();

    drawText(
      "BOSS HEALTH  " + state.bossHealth + "%",
      centerX,
      barY + 20,
      9,
      "#ff8b9e",
      "center",
      "Orbitron"
    );

    const wordY = Math.min(
      canvasHeight - 80,
      barY + 90
    );

    drawText(
      "ATTACK WORD",
      centerX,
      wordY - 25,
      9,
      "#8994ac",
      "center",
      "Orbitron"
    );

    drawText(
      state.bossAttackWord.toUpperCase(),
      centerX,
      wordY + 5,
      22,
      "#f2f5ff",
      "center",
      "Orbitron"
    );

    drawModeLabel("BOSS ENCOUNTER / ATTACK", "#ff637e");
  }

  /* ==========================================
     DRAW MODE 5 — BOMB DEFUSE
     ========================================== */

  function drawBomb(now) {
    const bomb = state.targets.find(
      (target) => target.type === "bomb" && !target.dead
    );

    if (!bomb) return;

    const timeLeft = Math.max(
      0,
      (bomb.deadline - now) / 1000
    );

    const urgent = timeLeft <= 4;

    const color = urgent ? "#ff637e" : "#ffd36a";

    const pulse = Math.sin(now / 130) * 3;

    ctx.save();

    ctx.shadowBlur = 26;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.arc(
      bomb.x,
      bomb.y,
      bomb.radius + pulse,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = urgent
      ? "rgba(255, 99, 126, 0.12)"
      : "rgba(255, 211, 106, 0.10)";

    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(
      bomb.x,
      bomb.y,
      bomb.radius * 0.7,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle = "rgba(255, 211, 106, 0.4)";
    ctx.stroke();

    ctx.restore();

    drawText(
      timeLeft.toFixed(1) + "s",
      bomb.x,
      bomb.y - 10,
      20,
      color,
      "center",
      "Orbitron"
    );

    drawText(
      "BOMB TIMER",
      bomb.x,
      bomb.y + 13,
      8,
      "#c5bca6",
      "center",
      "Orbitron"
    );

    const codeY = bomb.y + bomb.radius + 38;

    drawText(
      "DEFUSAL CODE",
      bomb.x,
      codeY,
      9,
      "#8994ac",
      "center",
      "Orbitron"
    );

    drawText(
      bomb.code,
      bomb.x,
      codeY + 27,
      Math.min(19, 220 / bomb.code.length),
      "#ffd36a",
      "center",
      "Orbitron"
    );

    const barWidth = Math.min(220, canvasWidth * 0.65);
    const barX = bomb.x - barWidth / 2;
    const barY = codeY + 48;

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(barX, barY, barWidth, 4);

    ctx.fillStyle = color;

    ctx.fillRect(
      barX,
      barY,
      barWidth * (timeLeft / bomb.duration),
      4
    );

    drawModeLabel("BOMB DEFUSAL / TIME CRITICAL", color);
  }

  /* ==========================================
     DRAW MODE 6 — MEMORY MASTER
     ========================================== */

  function drawMemory(now) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight * 0.45;

    drawText(
      "MEMORY ROUND " + state.memoryRound + " / 8",
      centerX,
      centerY - 70,
      10,
      "#59e5ff",
      "center",
      "Orbitron"
    );

    if (state.memoryPhase === "show") {
      drawText(
        "MEMORIZE THIS SEQUENCE",
        centerX,
        centerY - 30,
        9,
        "#8994ac",
        "center",
        "Orbitron"
      );

      const sequence = state.memorySequence;
      const fontSize = Math.min(
        24,
        (canvasWidth - 45) / Math.max(1, sequence.length) * 1.1
      );

      drawText(
        sequence,
        centerX,
        centerY + 12,
        fontSize,
        "#59e5ff",
        "center",
        "Orbitron"
      );

      const remaining = Math.max(
        0,
        state.memoryDeadline - now
      );

      const progress = clamp(
        remaining / Math.max(1, 3200 - state.memoryRound * 150),
        0,
        1
      );

      const barWidth = Math.min(
        250,
        canvasWidth * 0.7
      );

      ctx.fillStyle = "rgba(89,229,255,0.12)";
      ctx.fillRect(
        centerX - barWidth / 2,
        centerY + 48,
        barWidth,
        4
      );

      ctx.fillStyle = "#59e5ff";
      ctx.fillRect(
        centerX - barWidth / 2,
        centerY + 48,
        barWidth * progress,
        4
      );

    } else {
      drawText(
        "SEQUENCE HIDDEN",
        centerX,
        centerY - 15,
        16,
        "#a879ff",
        "center",
        "Orbitron"
      );

      drawText(
        "Type the sequence into the input below",
        centerX,
        centerY + 20,
        10,
        "#8994ac"
      );

      const remaining = Math.max(
        0,
        (state.memoryDeadline - now) / 1000
      );

      drawText(
        remaining.toFixed(1) + "s REMAINING",
        centerX,
        centerY + 55,
        9,
        remaining <= 4 ? "#ff637e" : "#59e5ff",
        "center",
        "Orbitron"
      );
    }

    drawModeLabel("MEMORY CHALLENGE", "#59e5ff");
  }

  /* ==========================================
     SHARED VISUAL EFFECTS
     ========================================== */

  function drawModeLabel(text, color) {
    ctx.save();

    ctx.globalAlpha = 0.65;

    drawText(
      text,
      canvasWidth / 2,
      canvasHeight - 38,
      8,
      color,
      "center",
      "Orbitron"
    );

    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.save();

      ctx.globalAlpha = clamp(
        particle.life / particle.maxLife,
        0,
        1
      );

      ctx.fillStyle = particle.color;

      ctx.beginPath();
      ctx.arc(
        particle.x,
        particle.y,
        particle.size,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    }
  }

  function drawFloatingTexts() {
    for (const item of state.floatingTexts) {
      ctx.save();

      ctx.globalAlpha = clamp(item.life, 0, 1);

      drawText(
        item.text,
        item.x,
        item.y,
        11,
        item.color,
        "center",
        "Orbitron"
      );

      ctx.restore();
    }
  }

  function drawPauseScreen() {
    ctx.save();

    ctx.fillStyle = "rgba(8, 11, 20, 0.78)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    drawText(
      "GAME PAUSED",
      canvasWidth / 2,
      canvasHeight / 2 - 12,
      21,
      "#c09aff",
      "center",
      "Orbitron"
    );

    drawText(
      "PRESS ESC TO RESUME",
      canvasWidth / 2,
      canvasHeight / 2 + 22,
      9,
      "#8994ac",
      "center",
      "Orbitron"
    );

    ctx.restore();
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */

  function initialize() {
    selectMode("bubble");

    resizeCanvas();

    setGameStatus("READY", false);

    showMessage(
      "Select a mode and press Start Game."
    );

    updateStats();
    updateClock();

    console.log("TYPEX initialized successfully.");
  }

  initialize();
})();
