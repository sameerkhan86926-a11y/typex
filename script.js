"use strict";

/* ==========================================
   TYPEX — TYPING ARCADE ENGINE (ULTRA EDITION)
   File: script.js
   Full Procedural Audio Synth + Canvas Particles + Shake
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
      instruction: "Type the letter displayed inside any active bubble.",
      inputLabel: "ENTER TARGET LETTER",
      placeholder: "Type a bubble letter...",
      overlayTitle: "Ready to pop?",
      overlayDescription: "Type letters before bubbles breach top airspace.",
      lives: 3
    },
    wordrain: {
      title: "Word Rain",
      label: "MODE 02 / WORD RAIN",
      instruction: "Type the falling words and press Enter.",
      inputLabel: "TYPE FALLING WORD",
      placeholder: "Type complete word...",
      overlayTitle: "Catch the words.",
      overlayDescription: "Type complete words before they hit the lower perimeter.",
      lives: 3
    },
    survival: {
      title: "Last Stand",
      label: "MODE 03 / LAST STAND",
      instruction: "Destroy enemy invaders across 3 defense lanes.",
      inputLabel: "ENTER ENEMY CODE",
      placeholder: "Type enemy code...",
      overlayTitle: "Defend your base.",
      overlayDescription: "Enemies approach across lanes. Type their codes before base breach.",
      lives: 3
    },
    boss: {
      title: "Boss Fight",
      label: "MODE 04 / BOSS FIGHT",
      instruction: "Type the attack code word to bombard the core boss.",
      inputLabel: "ENTER ATTACK WORD",
      placeholder: "Type attack word...",
      overlayTitle: "Challenge the boss.",
      overlayDescription: "Consecutive correct words deal combo damage. Neutralize the threat.",
      lives: 3
    },
    bomb: {
      title: "Bomb Defuse",
      label: "MODE 05 / BOMB DEFUSE",
      instruction: "Enter the sequence before detonation timer hits 0.0s.",
      inputLabel: "ENTER DEFUSAL CODE",
      placeholder: "Type defusal code...",
      overlayTitle: "Time is ticking.",
      overlayDescription: "High pressure timed defusals. Every level tightens the timer.",
      lives: 3
    },
    memory: {
      title: "Memory Master",
      label: "MODE 06 / MEMORY MASTER",
      instruction: "Memorize the sequence, then reproduce it after it disappears.",
      inputLabel: "RECALL SEQUENCE",
      placeholder: "Type memorized code...",
      overlayTitle: "Trust your memory.",
      overlayDescription: "Pattern vanishes in seconds. Reproduce without fault.",
      lives: 3
    }
  };

  const WORDS = [
    "matrix", "quantum", "cyber", "vector", "reactor", "phantom", "protocol",
    "velocity", "terminal", "starlight", "titanium", "spectrum", "frequency",
    "algorithm", "hyperion", "overdrive", "firewall", "sentinel", "lightning",
    "infinity", "vortex", "blueprint", "eclipse", "synapse", "zero", "orbital"
  ];

  const MEMORY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const LANES = [0.22, 0.5, 0.78];

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
    shakeTime: 0,

    level: 1,
    targetId: 0,

    bossHealth: 100,
    bossMaxHealth: 100,
    bossAttackWord: "",
    bossShieldAngle: 0,

    bombCode: "",
    bombDeadline: 0,
    bombsDefused: 0,
    lastTickSecond: -1,

    memorySequence: "",
    memoryPhase: "show",
    memoryDeadline: 0,
    memoryRound: 0,

    audioContext: null
  };

  let animationId = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pixelRatio = 1;

  /* ==========================================
     AUDIO SYNTHESIZER (ZERO EXTERNAL ASSETS)
     ========================================== */

  function getAudio() {
    if (!state.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) state.audioContext = new AudioCtx();
    }
    if (state.audioContext && state.audioContext.state === "suspended") {
      state.audioContext.resume();
    }
    return state.audioContext;
  }

  function playSound(type) {
    const actx = getAudio();
    if (!actx) return;

    const t = actx.currentTime;

    if (type === "type") {
      // Mechanical switch click
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600 + Math.random() * 200, t);
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.035);
    } else if (type === "hit") {
      // Crisp neon zap
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "triangle";
      const pitch = 580 + Math.min(state.combo * 20, 600);
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, t + 0.08);

      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.095);
    } else if (type === "miss") {
      // Buzzer
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.linearRampToValueAtTime(80, t + 0.16);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    } else if (type === "boom") {
      // Deep 808 Sub Explosion
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.38);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    } else if (type === "tick") {
      // Bomb tension tick
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.025);
    } else if (type === "success") {
      // Major Chord Arpeggio
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + i * 0.05);
        gain.gain.setValueAtTime(0.07, t + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.14);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(t + i * 0.05);
        osc.stop(t + i * 0.05 + 0.15);
      });
    }
  }

  /* ==========================================
     CANVAS AUTO-RESIZE & SCREEN SHAKE
     ========================================== */

  function triggerShake() {
    arena.classList.remove("shake");
    void arena.offsetWidth; // re-trigger reflow
    arena.classList.add("shake");
    state.shakeTime = 0.25;
  }

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
    new ResizeObserver(resizeCanvas).observe(arena);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }

  /* ==========================================
     UTILITIES
     ========================================== */

  const random = (min, max) => Math.random() * (max - min) + min;
  const randomInt = (min, max) => Math.floor(random(min, max + 1));
  const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomWord = () => choose(WORDS);

  function randomCode(length = 5) {
    let res = "";
    for (let i = 0; i < length; i++) {
      res += MEMORY_CHARS[Math.floor(Math.random() * MEMORY_CHARS.length)];
    }
    return res;
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function showMessage(text) {
    $("#typing-instruction").textContent = text;
  }

  function getAccuracy() {
    const total = state.hits + state.misses;
    return total === 0 ? 100 : Math.round((state.hits / total) * 100);
  }

  function getWPM() {
    const minutes = state.elapsed / 60;
    return minutes <= 0 ? 0 : Math.round((state.correctCharacters / 5) / minutes);
  }

  function getLevel() {
    return Math.max(1, 1 + Math.floor(state.score / 600));
  }

  function addScore(points) {
    state.score += points;
    $("#score-change").textContent = `+${points}`;
    updateStats();
  }

  function registerHit(points = 100) {
    state.hits++;
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    const comboBonus = Math.min(state.combo - 1, 15) * 10;
    addScore(points + comboBonus);
    playSound("hit");
    updateStats();
  }

  function registerMiss(msg = "Missed! Focus restored.") {
    state.misses++;
    state.combo = 0;
    playSound("miss");
    showMessage(msg);
    updateStats();
  }

  function loseLife(msg) {
    state.lives = Math.max(0, state.lives - 1);
    state.combo = 0;
    triggerShake();
    updateStats();

    if (state.lives <= 0) {
      endGame("SIMULATION TERMINATED", msg || "System life integrity collapsed.");
      return true;
    }
    showMessage(msg || "Damage sustained! System life lost.");
    playSound("miss");
    return false;
  }

  function addFloatingText(x, y, text, color = "#4ff5b7") {
    state.floatingTexts.push({ x, y, text, color, life: 1 });
  }

  function addParticles(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(40, 180);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(0.3, 0.75),
        maxLife: 0.75,
        size: random(2, 4.5),
        color
      });
    }
  }

  /* ==========================================
     HUD & TELEMETRY
     ========================================== */

  function updateStats() {
    $("#score-value").textContent = String(state.score).padStart(6, "0");
    $("#accuracy-value").textContent = getAccuracy();
    $("#accuracy-bar").style.width = `${getAccuracy()}%`;
    $("#wpm-value").textContent = getWPM();
    $("#combo-value").textContent = `x${state.combo}`;
    $("#combo-bar").style.width = `${Math.min(100, state.combo * 10)}%`;
    $("#best-combo").textContent = `BEST ${state.bestCombo}`;
    $("#lives-value").textContent = `${state.lives} / 3`;
    $("#hits-value").textContent = state.hits;
    $("#misses-value").textContent = state.misses;
    $("#mission-mode").textContent = MODES[state.mode].title.toUpperCase();
    $("#arena-level").textContent = `LEVEL ${String(state.level).padStart(2, "0")}`;
  }

  function setGameStatus(text, active = false) {
    const el = $("#game-status");
    el.innerHTML = "";
    const dot = document.createElement("span");
    dot.className = "status-dot";
    if (!active) {
      dot.style.background = "#6b7280";
      dot.style.boxShadow = "none";
    }
    el.append(dot, document.createTextNode(text));
  }

  /* ==========================================
     MODE SELECTION & RESET
     ========================================== */

  function selectMode(mode) {
    if (!MODES[mode]) return;
    if (state.running) stopGame(false);

    state.mode = mode;
    modeCards.forEach((card) => card.classList.toggle("selected", card.dataset.mode === mode));

    const config = MODES[mode];
    $("#active-mode-title").textContent = config.title;
    $("#arena-mode-label").textContent = config.label;
    $("#overlay-title").textContent = config.overlayTitle;
    $("#overlay-description").textContent = config.overlayDescription;
    $("#typing-label-text").textContent = config.inputLabel;
    typingInput.placeholder = config.placeholder;

    showMessage(config.instruction);
    startOverlay.classList.remove("hidden");
    resultOverlay.classList.add("hidden");

    typingInput.value = "";
    typingInput.disabled = true;
    submitButton.disabled = true;

    setGameStatus("STANDBY", false);
    resetGameState();
    drawScene(performance.now());
  }

  modeCards.forEach((c) => c.addEventListener("click", () => selectMode(c.dataset.mode)));

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
    state.bombsDefused = 0;
    state.lastTickSecond = -1;
    typingInput.value = "";
    updateStats();
    $("#arena-time").textContent = "00:00";
  }

  function startGame() {
    getAudio();
    if (state.running && state.paused) {
      resumeGame();
      return;
    }
    resetGameState();

    state.running = true;
    state.startedAt = performance.now();
    state.lastFrame = performance.now();
    state.lastSpawn = performance.now();

    startOverlay.classList.add("hidden");
    resultOverlay.classList.add("hidden");
    typingInput.disabled = false;
    submitButton.disabled = false;
    setGameStatus("ENGAGED", true);

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
    if (showReady) setGameStatus("READY", false);
  }

  function pauseGame() {
    if (!state.running || state.paused) return;
    state.paused = true;
    setGameStatus("SUSPENDED", false);
    showMessage("Tactical pause engaged. Press ESC to return.");
    drawScene(performance.now());
  }

  function resumeGame() {
    if (!state.running || !state.paused) return;
    state.paused = false;
    state.lastFrame = performance.now();
    setGameStatus("ENGAGED", true);
    typingInput.focus({ preventScroll: true });
    animationId = requestAnimationFrame(gameLoop);
  }

  function endGame(title = "SIMULATION TERMINATED", desc = "") {
    if (state.ended) return;
    state.running = false;
    state.ended = true;
    cancelAnimationFrame(animationId);

    typingInput.disabled = true;
    submitButton.disabled = true;
    setGameStatus("SYSTEM OFFLINE", false);

    $("#result-title").textContent = title;
    $("#result-description").textContent = desc || "Evaluation finalized.";
    $("#result-score").textContent = state.score.toLocaleString();
    $("#result-accuracy").textContent = `${getAccuracy()}%`;
    $("#result-wpm").textContent = getWPM();
    $("#result-kicker").textContent = state.lives > 0 ? "MISSION ACCOMPLISHED" : "SYSTEM BREACHED";
    $("#result-symbol").textContent = state.lives > 0 ? "✓" : "!";

    resultOverlay.classList.remove("hidden");
    startOverlay.classList.add("hidden");
    updateStats();
  }

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);

  /* ==========================================
     TARGET SPAWNING
     ========================================== */

  function prepareMode() {
    const now = performance.now();
    if (state.mode === "bubble") {
      for (let i = 0; i < 5; i++) spawnBubble(true);
    } else if (state.mode === "wordrain") {
      spawnWord(true);
      spawnWord(true);
    } else if (state.mode === "survival") {
      spawnEnemy(true);
      spawnEnemy(true);
    } else if (state.mode === "boss") {
      state.bossHealth = 100;
      state.bossMaxHealth = 100;
      state.bossAttackWord = randomWord();
    } else if (state.mode === "bomb") {
      state.bombsDefused = 0;
      spawnBomb(true, now);
    } else if (state.mode === "memory") {
      state.memoryRound = 0;
      beginMemoryRound(now);
    }
  }

  function spawnBubble(initial = false) {
    const r = random(18, 25);
    state.targets.push({
      id: ++state.targetId,
      type: "bubble",
      letter: String.fromCharCode(randomInt(65, 90)),
      x: random(r + 20, canvasWidth - r - 20),
      y: initial ? random(70, canvasHeight * 0.6) : -r - 10,
      radius: r,
      speed: random(35, 60) + state.level * 4,
      phase: random(0, Math.PI * 2),
      color: choose(["#a879ff", "#4ce7ff", "#4ff5b7"]),
      dead: false
    });
  }

  function spawnWord(initial = false) {
    const word = randomWord();
    state.targets.push({
      id: ++state.targetId,
      type: "word",
      word,
      x: random(80, Math.max(85, canvasWidth - 80)),
      y: initial ? random(80, canvasHeight * 0.45) : -35,
      speed: random(28, 48) + state.level * 3.5,
      width: Math.max(70, word.length * 11 + 24),
      height: 32,
      dead: false
    });
  }

  function spawnEnemy(initial = false) {
    const lane = randomInt(0, 2);
    state.targets.push({
      id: ++state.targetId,
      type: "enemy",
      code: randomCode(4),
      lane,
      x: canvasWidth * LANES[lane],
      y: initial ? random(80, canvasHeight * 0.45) : 65,
      speed: random(22, 34) + state.level * 2.8,
      size: 26,
      dead: false
    });
  }

  function spawnBomb(initial = false, now = performance.now()) {
    state.targets = state.targets.filter((t) => t.type !== "bomb");
    const codeLen = Math.min(8, 4 + state.bombsDefused);
    const duration = Math.max(4.5, 10 - state.bombsDefused * 0.6);
    state.bombCode = randomCode(codeLen);
    state.bombDeadline = now + duration * 1000;

    state.targets.push({
      id: ++state.targetId,
      type: "bomb",
      code: state.bombCode,
      x: canvasWidth / 2,
      y: canvasHeight * 0.48,
      radius: 50,
      deadline: state.bombDeadline,
      duration,
      dead: false
    });
  }

  function beginMemoryRound(now = performance.now()) {
    state.memoryRound++;
    const len = Math.min(10, 3 + state.memoryRound);
    state.memorySequence = randomCode(len);
    state.memoryPhase = "show";
    state.memoryDeadline = now + Math.max(1400, 3400 - state.memoryRound * 180);

    typingInput.value = "";
    typingInput.disabled = true;
    submitButton.disabled = true;
    showMessage("LOCK DATA TO MEMORY. SEQUENCE CLEARS SHORTLY.");
    updateStats();
  }

  function switchMemoryToInput(now) {
    state.memoryPhase = "input";
    state.memoryDeadline = now + 12000;
    typingInput.value = "";
    typingInput.disabled = false;
    submitButton.disabled = false;
    showMessage("RECALL SEQUENCE: ENTER REPRODUCED SEQUENCE.");
    typingInput.focus({ preventScroll: true });
  }

  /* ==========================================
     INPUT PROCESSING & KEYBOARD
     ========================================== */

  typingInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key.length === 1) {
      playSound("type");
    }
  });

  typingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.running || state.paused || state.ended) return;
    const val = typingInput.value.trim().toUpperCase();
    if (!val) return;
    processSubmission(val);
  });

  function processSubmission(value) {
    state.typedCharacters += value.length;

    if (state.mode === "wordrain") {
      const match = state.targets.find((t) => t.type === "word" && !t.dead && t.word.toUpperCase() === value);
      if (match) {
        destroyTarget(match, 120 + match.word.length * 10, "PULVERIZED!");
      } else {
        registerMiss("Word mismatch.");
      }
      typingInput.value = "";
    } else if (state.mode === "survival") {
      const match = state.targets.find((t) => t.type === "enemy" && !t.dead && t.code === value);
      if (match) {
        destroyTarget(match, 150, "INTERCEPTED!");
      } else {
        registerMiss("Vector not targeted.");
      }
      typingInput.value = "";
    } else if (state.mode === "boss") {
      if (value === state.bossAttackWord.toUpperCase()) {
        const damage = 20 + Math.min(state.combo, 10) * 3;
        state.bossHealth = Math.max(0, state.bossHealth - damage);
        state.correctCharacters += value.length;
        registerHit(150 + damage * 4);

        addFloatingText(canvasWidth / 2, canvasHeight * 0.3, `-${damage} HP`, "#ff5277");
        addParticles(canvasWidth / 2, canvasHeight * 0.36, "#ff5277", 25);
        triggerShake();

        if (state.bossHealth <= 0) {
          addScore(1000);
          endGame("BOSS NEUTRALIZED!", "Supreme typing proficiency demonstrated.");
          playSound("success");
          return;
        }
        state.bossAttackWord = randomWord();
        showMessage("CRITICAL HIT! ENTER NEXT CIPHER.");
      } else {
        registerMiss("Attack deflected!");
      }
      typingInput.value = "";
    } else if (state.mode === "bomb") {
      const bomb = state.targets.find((t) => t.type === "bomb" && !t.dead);
      if (bomb && value === bomb.code) {
        bomb.dead = true;
        state.bombsDefused++;
        state.correctCharacters += value.length;
        registerHit(250 + state.bombsDefused * 40);
        addParticles(bomb.x, bomb.y, "#4ff5b7", 35);
        addFloatingText(bomb.x, bomb.y - 45, "DISARMED!", "#4ff5b7");
        playSound("success");
        state.level = getLevel();

        if (state.bombsDefused >= 6) {
          endGame("DEFUSAL MASTER!", "All ordnance disarmed safely.");
          return;
        }
        spawnBomb(false, performance.now());
      } else {
        registerMiss("Security mismatch! Timer accelerates.");
      }
      typingInput.value = "";
    } else if (state.mode === "memory") {
      if (state.memoryPhase !== "input") return;
      if (value === state.memorySequence) {
        state.correctCharacters += value.length;
        registerHit(200 + state.memorySequence.length * 25);
        addFloatingText(canvasWidth / 2, canvasHeight / 2, "RECALL 100%", "#4ce7ff");
        playSound("success");

        if (state.memoryRound >= 8) {
          endGame("CYBER MEMORY PEAK", "8/8 Memory sequences mastered.");
          return;
        }
        state.level = getLevel();
        beginMemoryRound(performance.now());
      } else {
        if (loseLife("Sequence incorrect! Neural shock.")) return;
        beginMemoryRound(performance.now());
      }
      typingInput.value = "";
    }
  }

  // Quick single-letter pop for Bubble mode
  typingInput.addEventListener("input", () => {
    if (!state.running || state.paused || state.ended || state.mode !== "bubble") return;
    const val = typingInput.value.toUpperCase();
    if (!val) return;
    const char = val[val.length - 1];

    if (/^[A-Z]$/.test(char)) {
      state.typedCharacters++;
      const match = state.targets.find((t) => t.type === "bubble" && !t.dead && t.letter === char);
      if (match) {
        destroyTarget(match, 90, "POPPED!");
      } else {
        registerMiss("Signal unmatched.");
      }
    }
    typingInput.value = "";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      state.paused ? resumeGame() : pauseGame();
    } else if (e.key === "Enter" && (!state.running || state.ended) && !e.repeat) {
      e.preventDefault();
      startGame();
    } else if (e.key === "Tab" && state.running && !state.paused) {
      e.preventDefault();
      typingInput.focus({ preventScroll: true });
    }
  });

  function destroyTarget(target, points, label) {
    if (!target || target.dead) return;
    target.dead = true;
    const col = target.type === "enemy" ? "#ff5277" : target.type === "word" ? "#4ce7ff" : "#a879ff";

    addParticles(target.x, target.y, col, 18);
    addFloatingText(target.x, target.y - 20, label, col);
    state.correctCharacters += (target.word || target.code || target.letter).length;
    registerHit(points);
    state.level = getLevel();
  }

  /* ==========================================
     LOOP & UPDATES
     ========================================== */

  function gameLoop(now) {
    if (!state.running || state.paused || state.ended) return;
    const delta = Math.min((now - state.lastFrame) / 1000, 0.05);
    state.lastFrame = now;
    state.elapsed = Math.max(0, (now - state.startedAt) / 1000);

    updateEntities(delta, now);
    drawScene(now);

    animationId = requestAnimationFrame(gameLoop);
  }

  function updateEntities(delta, now) {
    // Mode spawns & bounds
    if (state.mode === "bubble") {
      if (now - state.lastSpawn > Math.max(450, 1100 - state.level * 60)) {
        spawnBubble();
        state.lastSpawn = now;
      }
      for (const b of state.targets) {
        b.y += b.speed * delta;
        b.x += Math.sin(now / 600 + b.phase) * 12 * delta;
        if (b.y - b.radius > canvasHeight) {
          b.dead = true;
          if (loseLife("Airspace breached!")) return;
        }
      }
    } else if (state.mode === "wordrain") {
      if (now - state.lastSpawn > Math.max(550, 1600 - state.level * 90)) {
        spawnWord();
        state.lastSpawn = now;
      }
      for (const w of state.targets) {
        w.y += w.speed * delta;
        if (w.y > canvasHeight - 45) {
          w.dead = true;
          if (loseLife("Word breached boundary!")) return;
        }
      }
    } else if (state.mode === "survival") {
      if (now - state.lastSpawn > Math.max(600, 1500 - state.level * 95)) {
        spawnEnemy();
        state.lastSpawn = now;
      }
      for (const en of state.targets) {
        en.y += en.speed * delta;
        if (en.y >= canvasHeight - 65) {
          en.dead = true;
          if (loseLife("Base perimeter violated!")) return;
        }
      }
    } else if (state.mode === "boss") {
      state.bossShieldAngle += delta * 1.5;
    } else if (state.mode === "bomb") {
      const bomb = state.targets.find((t) => t.type === "bomb" && !t.dead);
      if (bomb) {
        const left = Math.max(0, (bomb.deadline - now) / 1000);
        const sec = Math.ceil(left);
        if (sec !== state.lastTickSecond && sec <= 5) {
          state.lastTickSecond = sec;
          playSound("tick");
        }
        if (left <= 0) {
          bomb.dead = true;
          addParticles(bomb.x, bomb.y, "#ff5277", 40);
          playSound("boom");
          if (loseLife("DETONATION OCCURRED!")) return;
          spawnBomb(false, now);
        }
      }
    } else if (state.mode === "memory") {
      if (state.memoryPhase === "show" && now >= state.memoryDeadline) switchMemoryToInput(now);
      if (state.memoryPhase === "input" && now >= state.memoryDeadline) {
        if (loseLife("Memory sequence expired!")) return;
        beginMemoryRound(now);
      }
    }

    state.targets = state.targets.filter((t) => !t.dead);

    // Particles
    for (const p of state.particles) {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= delta;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    // Floating text
    for (const f of state.floatingTexts) {
      f.y -= 30 * delta;
      f.life -= delta * 1.2;
    }
    state.floatingTexts = state.floatingTexts.filter((f) => f.life > 0);

    $("#arena-time").textContent = formatTime(state.elapsed);
  }

  /* ==========================================
     RENDERING & PROCEDURAL SHADERS
     ========================================== */

  function drawScene(now) {
    if (!ctx || !canvasWidth || !canvasHeight) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    drawGrid(now);

    const activeTyped = typingInput.value.trim().toUpperCase();

    if (state.mode === "bubble") drawBubbles(now);
    if (state.mode === "wordrain") drawWords(now, activeTyped);
    if (state.mode === "survival") drawSurvival(now, activeTyped);
    if (state.mode === "boss") drawBoss(now, activeTyped);
    if (state.mode === "bomb") drawBomb(now, activeTyped);
    if (state.mode === "memory") drawMemory(now);

    drawParticles();
    drawFloatingTexts();

    if (state.paused) drawPauseScreen();
  }

  function drawGrid(now) {
    ctx.save();
    ctx.strokeStyle = "rgba(76, 231, 255, 0.04)";
    ctx.lineWidth = 1;
    const sz = 38;

    for (let x = 0; x < canvasWidth; x += sz) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += sz) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    // Dynamic horizontal scan beam
    const scanY = (now / 18) % canvasHeight;
    const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
    grad.addColorStop(0, "rgba(76, 231, 255, 0)");
    grad.addColorStop(0.5, "rgba(76, 231, 255, 0.05)");
    grad.addColorStop(1, "rgba(76, 231, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 30, canvasWidth, 60);
    ctx.restore();
  }

  function drawBubbles(now) {
    for (const b of state.targets) {
      if (b.type !== "bubble" || b.dead) continue;
      const pulse = Math.sin(now / 220 + b.phase) * 2.5;
      const r = b.radius + pulse;

      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(22, 28, 52, 0.65)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = b.color;
      ctx.stroke();

      // Core Highlight
      ctx.beginPath();
      ctx.arc(b.x - r * 0.3, b.y - r * 0.3, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fill();

      // Letter
      ctx.shadowBlur = 0;
      ctx.font = "800 17px Orbitron";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.letter, b.x, b.y + 1);
      ctx.restore();
    }
  }

  function drawWords(now, typed) {
    for (const w of state.targets) {
      if (w.type !== "word" || w.dead) continue;
      const isTargeted = typed && w.word.toUpperCase().startsWith(typed);

      ctx.save();
      ctx.shadowBlur = isTargeted ? 25 : 12;
      ctx.shadowColor = isTargeted ? "#4ff5b7" : "#4ce7ff";

      ctx.fillStyle = isTargeted ? "rgba(79, 245, 183, 0.18)" : "rgba(13, 18, 34, 0.85)";
      ctx.strokeStyle = isTargeted ? "#4ff5b7" : "rgba(76, 231, 255, 0.6)";
      ctx.lineWidth = isTargeted ? 2 : 1;

      ctx.beginPath();
      ctx.roundRect(w.x - w.width / 2, w.y - w.height / 2, w.width, w.height, 6);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.font = "700 12px Orbitron";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (isTargeted) {
        const matchLen = typed.length;
        const matchedStr = w.word.slice(0, matchLen).toUpperCase();
        const remainStr = w.word.slice(matchLen).toUpperCase();
        const totalW = ctx.measureText(w.word.toUpperCase()).width;
        let startX = w.x - totalW / 2;

        ctx.textAlign = "left";
        ctx.fillStyle = "#4ff5b7";
        ctx.fillText(matchedStr, startX, w.y);
        startX += ctx.measureText(matchedStr).width;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(remainStr, startX, w.y);
      } else {
        ctx.fillStyle = "#e0f7ff";
        ctx.fillText(w.word.toUpperCase(), w.x, w.y);
      }
      ctx.restore();
    }
  }

  function drawSurvival(now, typed) {
    ctx.save();
    // Lanes
    LANES.forEach((l, i) => {
      const lx = canvasWidth * l;
      ctx.strokeStyle = "rgba(76, 231, 255, 0.15)";
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(lx, 40);
      ctx.lineTo(lx, canvasHeight - 50);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "700 8.5px Orbitron";
      ctx.fillStyle = "#617192";
      ctx.textAlign = "center";
      ctx.fillText(`LANE 0${i + 1}`, lx, 36);
    });

    // Base defense line
    const by = canvasHeight - 52;
    ctx.strokeStyle = "#4ff5b7";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#4ff5b7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, by);
    ctx.lineTo(canvasWidth - 20, by);
    ctx.stroke();
    ctx.restore();

    for (const en of state.targets) {
      if (en.type !== "enemy" || en.dead) continue;
      const isTargeted = typed && en.code.startsWith(typed);

      ctx.save();
      ctx.translate(en.x, en.y);
      ctx.shadowBlur = isTargeted ? 24 : 14;
      ctx.shadowColor = isTargeted ? "#4ff5b7" : "#ff5277";

      ctx.fillStyle = isTargeted ? "rgba(79, 245, 183, 0.2)" : "rgba(255, 82, 119, 0.15)";
      ctx.strokeStyle = isTargeted ? "#4ff5b7" : "#ff5277";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, -en.size);
      ctx.lineTo(en.size, 0);
      ctx.lineTo(0, en.size);
      ctx.lineTo(-en.size, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.font = "800 10.5px Orbitron";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isTargeted ? "#4ff5b7" : "#ffffff";
      ctx.fillText(en.code, 0, 0);
      ctx.restore();
    }
  }

  function drawBoss(now, typed) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight * 0.38;
    const r = Math.min(68, canvasWidth * 0.13);

    ctx.save();
    // Shield rings
    ctx.strokeStyle = "rgba(255, 82, 119, 0.3)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 18, state.bossShieldAngle, state.bossShieldAngle + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Core
    ctx.shadowBlur = 35;
    ctx.shadowColor = "#ff5277";
    ctx.beginPath();
    ctx.arc(cx, cy, r + Math.sin(now / 200) * 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 82, 119, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "#ff5277";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Eye Matrix
    ctx.fillStyle = "#ff5277";
    ctx.fillRect(cx - 20, cy - 8, 10, 16);
    ctx.fillRect(cx + 10, cy - 8, 10, 16);
    ctx.restore();

    // Health Bar
    const bw = Math.min(320, canvasWidth * 0.7);
    const bx = cx - bw / 2;
    const by = cy + r + 26;

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 8, 4);
    ctx.fill();

    const hw = bw * (state.bossHealth / state.bossMaxHealth);
    if (hw > 0) {
      ctx.fillStyle = "#ff5277";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ff5277";
      ctx.beginPath();
      ctx.roundRect(bx, by, hw, 8, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.font = "700 9px Orbitron";
    ctx.fillStyle = "#ffa2b5";
    ctx.textAlign = "center";
    ctx.fillText(`CORE STABILITY ${state.bossHealth}%`, cx, by + 22);

    // Attack Target Cipher
    const targetY = by + 68;
    ctx.font = "800 24px Orbitron";
    ctx.fillStyle = typed && state.bossAttackWord.toUpperCase().startsWith(typed) ? "#4ff5b7" : "#ffffff";
    ctx.fillText(state.bossAttackWord.toUpperCase(), cx, targetY);
  }

  function drawBomb(now, typed) {
    const bomb = state.targets.find((t) => t.type === "bomb" && !t.dead);
    if (!bomb) return;

    const left = Math.max(0, (bomb.deadline - now) / 1000);
    const critical = left <= 3.5;
    const col = critical ? "#ff5277" : "#ffd056";

    ctx.save();
    ctx.shadowBlur = critical ? 35 : 20;
    ctx.shadowColor = col;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, bomb.radius + (critical ? Math.sin(now / 80) * 4 : 0), 0, Math.PI * 2);
    ctx.fillStyle = critical ? "rgba(255, 82, 119, 0.15)" : "rgba(255, 208, 86, 0.1)";
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.font = "800 24px Orbitron";
    ctx.fillStyle = col;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${left.toFixed(1)}s`, bomb.x, bomb.y - 8);

    ctx.font = "700 8.5px Orbitron";
    ctx.fillStyle = "#8895b3";
    ctx.fillText("DETONATION TIMER", bomb.x, bomb.y + 14);

    const cy = bomb.y + bomb.radius + 36;
    ctx.font = "800 20px Orbitron";
    ctx.fillStyle = typed && bomb.code.startsWith(typed) ? "#4ff5b7" : "#ffd056";
    ctx.fillText(bomb.code, bomb.x, cy);
    ctx.restore();
  }

  function drawMemory(now) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight * 0.45;

    ctx.font = "700 11px Orbitron";
    ctx.fillStyle = "#4ce7ff";
    ctx.textAlign = "center";
    ctx.fillText(`NEURAL ROUND 0${state.memoryRound} / 08`, cx, cy - 65);

    if (state.memoryPhase === "show") {
      ctx.font = "800 26px Orbitron";
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#4ce7ff";
      ctx.fillText(state.memorySequence, cx, cy + 5);
      ctx.shadowBlur = 0;

      const rem = Math.max(0, state.memoryDeadline - now);
      const prog = rem / Math.max(1, 3400 - state.memoryRound * 180);
      const bw = Math.min(260, canvasWidth * 0.7);

      ctx.fillStyle = "rgba(76, 231, 255, 0.15)";
      ctx.fillRect(cx - bw / 2, cy + 36, bw, 4);
      ctx.fillStyle = "#4ce7ff";
      ctx.fillRect(cx - bw / 2, cy + 36, bw * prog, 4);
    } else {
      ctx.font = "800 18px Orbitron";
      ctx.fillStyle = "#a879ff";
      ctx.fillText("DATA RETRACTED", cx, cy - 8);
      ctx.font = "500 12px Inter";
      ctx.fillStyle = "#8895b3";
      ctx.fillText("Type stored sequence from memory", cx, cy + 18);
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFloatingTexts() {
    for (const f of state.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = "800 13px Orbitron";
      ctx.fillStyle = f.color;
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function drawPauseScreen() {
    ctx.save();
    ctx.fillStyle = "rgba(7, 10, 19, 0.85)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = "800 24px Orbitron";
    ctx.fillStyle = "#c6a6ff";
    ctx.textAlign = "center";
    ctx.fillText("SIMULATION SUSPENDED", canvasWidth / 2, canvasHeight / 2 - 10);
    ctx.font = "700 9px Orbitron";
    ctx.fillStyle = "#8895b3";
    ctx.fillText("PRESS ESC TO RE-ENGAGE", canvasWidth / 2, canvasHeight / 2 + 20);
    ctx.restore();
  }

  /* ==========================================
     BOOTSTRAP
     ========================================== */

  selectMode("bubble");
  resizeCanvas();
  updateStats();
})();
