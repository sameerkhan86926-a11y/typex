"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const canvas = $("#gameCanvas");
  const ctx = canvas.getContext("2d");

  const input = $("#typingInput");
  const form = $("#typingForm");
  const submitButton = $("#submitButton");
  const startButton = $("#startButton");
  const overlay = $("#arenaOverlay");
  const resultPanel = $("#resultPanel");
  const arena = $("#arena");

  const STORE_KEY = "typex_arcade_profile_v1";

  const MODES = {
    bubble: {
      title: "Bubble Pop",
      description: "Type the letter inside each falling bubble.",
      hint: "Type a matching letter",
      spawn: 0.95,
      lives: 5,
      words: false
    },
    words: {
      title: "Word Rain",
      description: "Type the complete word shown on a falling target.",
      hint: "Type a complete word, then press FIRE",
      spawn: 1.65,
      lives: 5,
      words: true
    },
    survival: {
      title: "Survival",
      description: "Survive the falling targets. Every miss costs a life.",
      hint: "Type a matching letter",
      spawn: 0.78,
      lives: 3,
      words: false
    },
    boss: {
      title: "Boss Fight",
      description: "Type the falling attack words to damage the boss.",
      hint: "Type the complete attack word",
      spawn: 2.3,
      lives: 5,
      words: true
    },
    bomb: {
      title: "Bomb Typing",
      description: "Defuse bombs before they reach the bottom.",
      hint: "Type the bomb code and press FIRE",
      spawn: 1.3,
      lives: 3,
      words: true
    },
    memory: {
      title: "Memory Mode",
      description: "Remember the target's letter before it disappears.",
      hint: "Remember and type the target letter",
      spawn: 1.25,
      lives: 4,
      words: false
    }
  };

  const WORDS = [
    "code", "speed", "pixel", "neon", "cyber", "power",
    "ghost", "laser", "storm", "quick", "shift", "flash",
    "matrix", "rocket", "shadow", "hunter", "dragon",
    "typing", "arcade", "legend", "system", "quantum",
    "velocity", "survival", "warrior", "glitch"
  ];

  const THEMES = {
    cyber: { accent: "#a58bff", glow: "rgba(165,139,255,.5)" },
    rgb: { accent: "#ff54d9", glow: "rgba(255,84,217,.5)" },
    hacker: { accent: "#4cff88", glow: "rgba(76,255,136,.5)" },
    pro: { accent: "#aebdce", glow: "rgba(174,189,206,.45)" },
    ice: { accent: "#58d9ff", glow: "rgba(88,217,255,.5)" }
  };

  const ACHIEVEMENTS = [
    {
      id: "first",
      title: "First Strike",
      description: "Pop your first target",
      check: (p) => p.totalDestroyed >= 1
    },
    {
      id: "combo",
      title: "Combo Master",
      description: "Reach a 10x combo",
      check: (p) => p.bestCombo >= 10
    },
    {
      id: "survivor",
      title: "Survivor",
      description: "Finish your first game",
      check: (p) => p.gamesPlayed >= 1
    },
    {
      id: "century",
      title: "Century Club",
      description: "Earn 1000 points in one game",
      check: (p) => p.bestScore >= 1000
    },
    {
      id: "boss",
      title: "Boss Breaker",
      description: "Defeat a boss",
      check: (p) => p.bossWins >= 1
    }
  ];

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          totalXP: Number(p.totalXP) || 0,
          bestScore: Number(p.bestScore) || 0,
          gamesPlayed: Number(p.gamesPlayed) || 0,
          totalDestroyed: Number(p.totalDestroyed) || 0,
          bestCombo: Number(p.bestCombo) || 0,
          bossWins: Number(p.bossWins) || 0,
          unlocked: Array.isArray(p.unlocked) ? p.unlocked : [],
          history: Array.isArray(p.history) ? p.history.slice(0, 8) : [],
          theme: THEMES[p.theme] ? p.theme : "cyber",
          sound: p.sound !== false
        };
      }
    } catch (error) {
      console.warn("Could not read TYPEX profile.", error);
    }

    return {
      totalXP: 0,
      bestScore: 0,
      gamesPlayed: 0,
      totalDestroyed: 0,
      bestCombo: 0,
      bossWins: 0,
      unlocked: [],
      history: [],
      theme: "cyber",
      sound: true
    };
  }

  const profile = loadProfile();

  let selectedMode = "bubble";
  let running = false;
  let animationId = 0;
  let lastFrame = 0;
  let spawnClock = 0;
  let elapsed = 0;
  let remaining = 60;
  let score = 0;
  let combo = 0;
  let bestComboThisGame = 0;
  let destroyed = 0;
  let mistakes = 0;
  let attempts = 0;
  let lives = 5;
  let level = 1;
  let bossHealth = 100;
  let totalTargets = 0;
  let wordBuffer = "";
  let activePower = null;
  let powerTime = 0;
  let shieldCharges = 0;
  let doubleXP = false;
  let soundContext = null;
  let gameObjects = [];
  let particles = [];
  let memoryTarget = null;
  let memoryClock = 0;
  let lastSpawn = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let dpr = 1;
  let hitFlash = 0;
  let currentXP = 0;
  let pointerTarget = null;

  function saveProfile() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(profile));
    } catch (error) {
      console.warn("Could not save TYPEX profile.", error);
    }
  }

  function safeText(value) {
    return String(value ?? "");
  }

  function getLevel(xp = profile.totalXP) {
    return Math.floor(Math.max(0, xp) / 100) + 1;
  }

  function getLevelName(levelNumber) {
    if (levelNumber >= 25) return "TYPEX Legend";
    if (levelNumber >= 15) return "Arcade Master";
    if (levelNumber >= 10) return "Elite Typist";
    if (levelNumber >= 5) return "Combat Typist";
    if (levelNumber >= 3) return "Quick Fingers";
    return "Rookie Typist";
  }

  function updateProfileUI() {
    $("#totalXP").textContent = profile.totalXP.toLocaleString();
    $("#playerLevel").textContent = getLevel();
    $("#bestScore").textContent = profile.bestScore.toLocaleString();
    $("#gamesPlayed").textContent = profile.gamesPlayed.toLocaleString();

    const currentLevel = getLevel();
    const currentLevelXP = profile.totalXP % 100;

    $("#levelBadge").textContent = String(currentLevel).padStart(2, "0");
    $("#levelName").textContent = getLevelName(currentLevel);
    $("#xpProgressText").textContent = `${currentLevelXP} / 100 XP`;
    $("#xpProgressFill").style.width = `${currentLevelXP}%`;

    $("#bestComboValue").textContent = profile.bestCombo;
    renderAchievements();
    renderHistory();
  }

  function renderAchievements() {
    const host = $("#achievementList");
    host.replaceChildren();

    ACHIEVEMENTS.forEach((achievement, index) => {
      const unlocked = profile.unlocked.includes(achievement.id);
      const row = document.createElement("div");
      row.className = `achievement-item${unlocked ? " unlocked" : ""}`;

      const icon = document.createElement("span");
      icon.className = "achievement-icon";
      icon.textContent = String(index + 1).padStart(2, "0");

      const copy = document.createElement("span");
      const title = document.createElement("strong");
      const description = document.createElement("small");
      title.textContent = achievement.title;
      description.textContent = achievement.description;
      copy.append(title, description);

      const status = document.createElement("span");
      status.className = "achievement-lock";
      status.textContent = unlocked ? "UNLOCKED" : "LOCKED";

      row.append(icon, copy, status);
      host.append(row);
    });
  }

  function renderHistory() {
    const host = $("#historyList");
    host.replaceChildren();

    if (!profile.history.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Your battle history will appear here.";
      host.append(empty);
      return;
    }

    profile.history.slice(0, 5).forEach((entry) => {
      const row = document.createElement("div");
      row.className = "history-item";

      const details = document.createElement("span");
      const name = document.createElement("strong");
      const date = document.createElement("small");

      name.textContent = entry.mode;
      date.textContent = `${entry.destroyed} targets · ${entry.accuracy}% accuracy`;
      details.append(name, date);

      const points = document.createElement("span");
      points.className = "history-score";
      points.textContent = Number(entry.score).toLocaleString();

      row.append(details, points);
      host.append(row);
    });
  }

  function checkAchievements() {
    ACHIEVEMENTS.forEach((achievement) => {
      if (
        !profile.unlocked.includes(achievement.id) &&
        achievement.check(profile)
      ) {
        profile.unlocked.push(achievement.id);
        showToast(`ACHIEVEMENT UNLOCKED: ${achievement.title}`);
        playSound("power");
      }
    });

    saveProfile();
    renderAchievements();
  }

  function showToast(message) {
    let toast = $("#typexToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "typexToast";
      toast.style.cssText = [
        "position:fixed",
        "z-index:100",
        "left:50%",
        "bottom:22px",
        "transform:translateX(-50%)",
        "max-width:90vw",
        "padding:12px 16px",
        "border:1px solid var(--accent)",
        "border-radius:10px",
        "background:var(--panel)",
        "color:var(--text)",
        "font:800 11px system-ui",
        "text-align:center",
        "box-shadow:0 8px 30px rgba(0,0,0,.35)"
      ].join(";");

      document.body.append(toast);
    }

    toast.textContent = message;
    toast.style.display = "block";

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.style.display = "none";
    }, 2200);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = rect.width;
    canvasHeight = rect.height;

    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame();
  }

  function currentTheme() {
    return THEMES[profile.theme] || THEMES.cyber;
  }

  function playSound(type) {
    if (!profile.sound) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (!soundContext) soundContext = new AudioContextClass();

      if (soundContext.state === "suspended") {
        soundContext.resume().catch(() => {});
      }

      const oscillator = soundContext.createOscillator();
      const gain = soundContext.createGain();
      const now = soundContext.currentTime;

      const tones = {
        pop: [560, 0.07],
        miss: [145, 0.15],
        power: [820, 0.13],
        start: [420, 0.1],
        boss: [240, 0.2]
      };

      const [frequency, duration] = tones[type] || tones.pop;

      oscillator.type = type === "miss" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now);

      if (type === "pop" || type === "power") {
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 1.6,
          now + duration
        );
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.connect(gain);
      gain.connect(soundContext.destination);

      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch (error) {
      // Audio is optional; the game continues without it.
    }
  }

  function applyTheme(theme) {
    profile.theme = THEMES[theme] ? theme : "cyber";
    document.body.dataset.theme = profile.theme;
    $("#themeSelect").value = profile.theme;
    saveProfile();
    drawFrame();
  }

  function selectMode(mode) {
    if (!MODES[mode]) return;

    if (running) {
      showToast("Finish or restart the current game to switch modes.");
      return;
    }

    selectedMode = mode;

    $$(".mode-card").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });

    $("#modeTitle").textContent = MODES[mode].title;
    $("#overlayTitle").textContent = "Enter the arena.";
    $("#overlayDescription").textContent = MODES[mode].description;
    $("#typingHint").textContent = MODES[mode].hint;

    $("#bossPanel").classList.toggle("hidden", mode !== "boss");

    if (mode === "boss") {
      $("#bossHealthFill").style.width = "100%";
      $("#bossHealthText").textContent = "100%";
    }

    overlay.classList.remove("hidden");
    resultPanel.classList.add("hidden");
    $("#gameStatus").textContent = "SYSTEM READY";

    resetGameState();
    drawFrame();
  }

  function resetGameState() {
    cancelAnimationFrame(animationId);

    running = false;
    animationId = 0;
    lastFrame = 0;
    spawnClock = 0;
    elapsed = 0;
    remaining = Number($("#durationSelect").value) || 60;
    score = 0;
    combo = 0;
    bestComboThisGame = 0;
    destroyed = 0;
    mistakes = 0;
    attempts = 0;
    lives = MODES[selectedMode].lives;
    level = 1;
    bossHealth = 100;
    totalTargets = 0;
    wordBuffer = "";
    activePower = null;
    powerTime = 0;
    shieldCharges = 0;
    doubleXP = false;
    gameObjects = [];
    particles = [];
    memoryTarget = null;
    memoryClock = 0;
    lastSpawn = 0;
    hitFlash = 0;
    currentXP = 0;
    pointerTarget = null;

    input.value = "";
    input.disabled = true;
    submitButton.disabled = true;
    input.placeholder = "Start the game to activate input...";

    $$(".powerup-button").forEach((button) => {
      button.disabled = true;
    });

    updateGameUI();
  }

  function startGame() {
    if (running) return;

    resetGameState();

    running = true;
    remaining = Number($("#durationSelect").value) || 60;
    lives = MODES[selectedMode].lives;
    lastFrame = performance.now();

    overlay.classList.add("hidden");
    resultPanel.classList.add("hidden");

    input.disabled = false;
    submitButton.disabled = false;
    input.placeholder = MODES[selectedMode].words
      ? "Type a complete word..."
      : "Type the matching letter...";

    $("#gameStatus").textContent = "MISSION ACTIVE";
    $("#inputStatus").textContent = "ONLINE";

    $$(".powerup-button").forEach((button) => {
      button.disabled = false;
    });

    playSound("start");
    updateGameUI();
    spawnTarget();
    animationId = requestAnimationFrame(gameLoop);

    setTimeout(() => {
      if (running) {
        input.focus({ preventScroll: true });
      }
    }, 60);
  }

  function gameLoop(timestamp) {
    if (!running) return;

    const dt = Math.min((timestamp - lastFrame) / 1000, 0.05);
    lastFrame = timestamp;

    elapsed += dt;
    remaining = Math.max(0, remaining - dt);

    const nextLevel = 1 + Math.floor(score / 250);
    if (nextLevel > level) {
      level = nextLevel;
      showToast(`LEVEL ${level} — DIFFICULTY INCREASED`);
      playSound("power");
    }

    if (activePower && activePower !== "shield") {
      powerTime -= dt;

      if (powerTime <= 0) {
        if (activePower === "double") doubleXP = false;
        activePower = null;
      }
    }

    if (hitFlash > 0) hitFlash -= dt;

    if (selectedMode === "memory" && memoryTarget) {
      memoryClock -= dt;

      if (memoryClock <= 0 && !memoryTarget.hidden) {
        memoryTarget.hidden = true;
        memoryTarget.hiddenTime = 1.2;
      } else if (memoryTarget.hidden) {
        memoryTarget.hiddenTime -= dt;

        if (memoryTarget.hiddenTime <= 0) {
          removeTarget(memoryTarget, false);
          memoryTarget = null;
          loseLife();
        }
      }
    }

    spawnClock += dt;
    const mode = MODES[selectedMode];
    const spawnInterval = Math.max(
      0.35,
      mode.spawn / (1 + (level - 1) * 0.09)
    );

    if (spawnClock >= spawnInterval) {
      spawnClock = 0;

      if (selectedMode !== "memory" || !memoryTarget) {
        spawnTarget();
      }
    }

    updateObjects(dt);
    updateParticles(dt);
    updateGameUI();
    drawFrame();

    if (remaining <= 0) {
      endGame("TIME EXPIRED");
      return;
    }

    if (lives <= 0) {
      endGame("GAME OVER");
      return;
    }

    animationId = requestAnimationFrame(gameLoop);
  }

  function randomLetter() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return letters[Math.floor(Math.random() * letters.length)];
  }

  function randomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  function spawnTarget() {
    if (!canvasWidth || !canvasHeight) resizeCanvas();

    const isWordMode = MODES[selectedMode].words;
    let label;

    if (selectedMode === "memory") {
      label = randomLetter();
    } else if (selectedMode === "bomb") {
      label = Math.random() < 0.55 ? randomWord() : randomLetter();
    } else if (isWordMode) {
      label = randomWord();
    } else {
      label = randomLetter();
    }

    const isBossAttack = selectedMode === "boss";
    const isBomb = selectedMode === "bomb" &&
      Math.random() < 0.6;

    if (isBomb && label.length === 1) {
      label = randomWord();
    }

    const width = Math.max(50, canvasWidth);
    const targetRadius = label.length > 4 ? 34 : 25;

    const object = {
      id: ++totalTargets,
      label,
      x: 35 + Math.random() * Math.max(1, width - 70),
      y: -targetRadius - 12,
      radius: targetRadius,
      speed: (isWordMode ? 48 : 58) + Math.random() * 26 + level * 3,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      isBomb,
      isBossAttack,
      hidden: false,
      hiddenTime: 0,
      color: isBomb ? "#ff617f" : currentTheme().accent
    };

    gameObjects.push(object);

    if (selectedMode === "memory") {
      memoryTarget = object;
      memoryClock = 0.8 + Math.random() * 0.5;
    }
  }

  function updateObjects(dt) {
    const speedMultiplier =
      activePower === "slow" ? 0.4 :
      activePower === "freeze" ? 0 : 1;

    for (let i = gameObjects.length - 1; i >= 0; i--) {
      const object = gameObjects[i];

      object.age += dt;
      object.y += object.speed * speedMultiplier * dt;
      object.x += Math.sin(object.age * 1.7 + object.phase) * 8 * dt;

      if (object.y - object.radius > canvasHeight) {
        removeTarget(object, false);
        loseLife();
      }
    }
  }

  function removeTarget(object, successful) {
    const index = gameObjects.indexOf(object);

    if (index !== -1) {
      gameObjects.splice(index, 1);
    }

    if (memoryTarget === object) {
      memoryTarget = null;
    }

    if (successful) {
      createBurst(object.x, object.y, object.color);
    }
  }

  function createBurst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 125;

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];

      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 40 * dt;
      particle.life -= dt;

      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function loseLife() {
    if (!running) return;

    if (shieldCharges > 0) {
      shieldCharges--;
      showToast("SHIELD BLOCKED A MISS");
      return;
    }

    lives = Math.max(0, lives - 1);
    combo = 0;
    mistakes++;
    hitFlash = 0.25;

    playSound("miss");
    updateGameUI();
  }

  function findTargetByLetter(letter) {
    const upper = letter.toUpperCase();

    const candidates = gameObjects
      .filter((object) => !object.hidden && object.label === upper)
      .sort((a, b) => b.y - a.y);

    return candidates[0] || null;
  }

  function registerHit(object) {
    if (!running || !object) return;

    removeTarget(object, true);
    attempts++;
    destroyed++;
    combo++;

    bestComboThisGame = Math.max(bestComboThisGame, combo);
    profile.bestCombo = Math.max(profile.bestCombo, combo);

    const points = (object.isBomb ? 25 : 10) +
      Math.min(combo, 30) * 2;

    score += points;

    if (selectedMode === "boss") {
      bossHealth = Math.max(0, bossHealth - 10);
      $("#bossHealthFill").style.width = `${bossHealth}%`;
      $("#bossHealthText").textContent = `${bossHealth}%`;

      arena.classList.remove("boss-hit");
      void arena.offsetWidth;
      arena.classList.add("boss-hit");

      playSound("boss");

      if (bossHealth <= 0) {
        profile.bossWins++;
        showToast("BOSS DEFEATED!");
        createBurst(canvasWidth / 2, 155, "#ff617f");
        bossHealth = 100;
        $("#bossHealthFill").style.width = "100%";
        $("#bossHealthText").textContent = "100%";
        score += 200;
      }
    } else {
      playSound("pop");
    }

    if (doubleXP) score += 5;

    currentXP += doubleXP ? 2 : 1;

    if (selectedMode === "bomb" && object.isBomb) {
      score += 15;
    }

    if (selectedMode === "memory") {
      memoryTarget = null;
    }

    checkAchievements();
    updateGameUI();
  }

  function processBubbleInput(value) {
    if (!running || !value) return;

    const characters = [...value.toUpperCase()];

    for (const character of characters) {
      if (!/[A-Z]/.test(character)) continue;

      attempts++;
      const target = findTargetByLetter(character);

      if (target) {
        registerHit(target);
      } else {
        mistakes++;
        combo = 0;
        playSound("miss");
      }
    }

    updateGameUI();
  }

  function processWordInput() {
    if (!running) return;

    const value = input.value.trim().toLowerCase();
    if (!value) return;

    const target = gameObjects.find((object) =>
      !object.hidden && object.label.toLowerCase() === value
    );

    if (target) {
      registerHit(target);
      input.value = "";
      wordBuffer = "";
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    if (!running) return;

    if (MODES[selectedMode].words) {
      const value = input.value.trim().toLowerCase();

      if (!value) return;

      const target = gameObjects.find((object) =>
        !object.hidden && object.label.toLowerCase() === value
      );

      if (target) {
        registerHit(target);
        input.value = "";
        wordBuffer = "";
      } else {
        attempts++;
        mistakes++;
        combo = 0;
        playSound("miss");
        input.value = "";
        updateGameUI();
      }

      input.focus({ preventScroll: true });
      return;
    }

    processBubbleInput(input.value);
    input.value = "";
    input.focus({ preventScroll: true });
  }

  function usePower(name) {
    if (!running) return;

    switch (name) {
      case "slow":
        activePower = "slow";
        powerTime = 5;
        showToast("SLOW-MO ACTIVATED");
        break;

      case "bomb": {
        const targets = [...gameObjects];

        targets.forEach((object) => {
          removeTarget(object, true);
          destroyed++;
          score += 8;
        });

        combo = 0;
        showToast(`${targets.length} TARGETS CLEARED`);
        playSound("power");
        break;
      }

      case "shield":
        shieldCharges = Math.min(3, shieldCharges + 1);
        activePower = "shield";
        showToast("SHIELD CHARGED");
        playSound("power");
        break;

      case "freeze":
        activePower = "freeze";
        powerTime = 3;
        showToast("TARGETS FROZEN");
        playSound("power");
        break;

      default:
        return;
    }

    updateGameUI();
  }

  function updateGameUI() {
    $("#scoreValue").textContent = score.toLocaleString();
    $("#comboValue").textContent = `x${combo}`;

    const accuracy = attempts
      ? Math.round(((attempts - mistakes) / attempts) * 100)
      : 100;

    $("#accuracyValue").textContent = `${Math.max(0, accuracy)}%`;
    $("#timeValue").textContent = `${Math.ceil(remaining)}s`;

    $("#livesValue").textContent = lives > 0
      ? `${"♥ ".repeat(lives).trim()}`
      : "0";

    $("#destroyedValue").textContent = destroyed;
    $("#difficultyValue").textContent = String(level).padStart(2, "0");
    $("#bestComboValue").textContent = profile.bestCombo;

    $("#inputStatus").textContent = running ? "ONLINE" : "WAITING";

    const powerButtons = $$(".powerup-button");
    powerButtons.forEach((button) => {
      button.disabled = !running;
    });

    const status = $("#gameStatus");

    if (running) {
      status.textContent = activePower
        ? `${activePower.toUpperCase()} ACTIVE`
        : "MISSION ACTIVE";
    }
  }

  function drawFrame() {
    if (!ctx || !canvasWidth || !canvasHeight) return;

    const theme = currentTheme();

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 65, 100, ${Math.min(0.15, hitFlash * 0.5)})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    gameObjects.forEach((object) => drawTarget(object, theme));
    particles.forEach(drawParticle);

    if (activePower === "shield" && shieldCharges > 0) {
      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvasWidth / 2, canvasHeight - 35, 21, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (activePower === "freeze") {
      ctx.fillStyle = "rgba(88,217,255,.06)";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
  }

  function drawTarget(object, theme) {
    const radius = object.radius;
    const x = object.x;
    const y = object.y;

    if (object.hidden) return;

    ctx.save();

    const color = object.color || theme.accent;

    ctx.shadowColor = color;
    ctx.shadowBlur = 18;

    const gradient = ctx.createRadialGradient(
      x - radius * 0.35,
      y - radius * 0.45,
      2,
      x,
      y,
      radius * 1.2
    );

    gradient.addColorStop(0, "rgba(255,255,255,.16)");
    gradient.addColorStop(1, "rgba(10,12,26,.95)");

    ctx.fillStyle = gradient;
    ctx.strokeStyle = color;
    ctx.lineWidth = object.isBomb ? 2.5 : 1.7;

    ctx.beginPath();

    if (object.label.length > 4) {
      roundedRect(
        ctx,
        x - radius - 12,
        y - radius * 0.62,
        radius * 2 + 24,
        radius * 1.24,
        12
      );
    } else {
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }

    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    if (object.isBomb) {
      ctx.fillStyle = "rgba(255,97,127,.14)";
      ctx.fill();
    }

    ctx.fillStyle = object.isBomb ? "#ff8fa3" : "#ffffff";
    ctx.font = `900 ${object.label.length > 5 ? 11 : object.label.length > 3 ? 12 : 17}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(object.label, x, y);

    if (pointerTarget === object) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function drawParticle(particle) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 8;
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

  function endGame(reason) {
    if (!running) return;

    running = false;
    cancelAnimationFrame(animationId);
    animationId = 0;

    input.disabled = true;
    submitButton.disabled = true;

    $$(".powerup-button").forEach((button) => {
      button.disabled = true;
    });

    $("#gameStatus").textContent = reason;
    $("#inputStatus").textContent = "OFFLINE";

    const accuracy = attempts
      ? Math.max(0, Math.round(((attempts - mistakes) / attempts) * 100))
      : 100;

    const earnedXP = Math.max(5, Math.floor(score / 10)) + currentXP;

    profile.totalXP += earnedXP;
    profile.gamesPlayed++;
    profile.totalDestroyed += destroyed;
    profile.bestScore = Math.max(profile.bestScore, score);

    profile.history.unshift({
      mode: MODES[selectedMode].title,
      score,
      destroyed,
      accuracy,
      date: new Date().toISOString()
    });

    profile.history = profile.history.slice(0, 8);

    saveProfile();
    checkAchievements();
    updateProfileUI();

    $("#resultTitle").textContent =
      reason === "BOSS DEFEATED" ? "Mission accomplished" :
      reason === "GAME OVER" ? "Mission failed" :
      "Mission complete";

    $("#finalScore").textContent = score.toLocaleString();
    $("#finalTargets").textContent = destroyed;
    $("#finalAccuracy").textContent = `${accuracy}%`;
    $("#finalXP").textContent = earnedXP;

    overlay.classList.remove("hidden");
    $("#overlayTitle").textContent =
      reason === "GAME OVER" ? "Mission failed." : "Mission complete.";

    $("#overlayDescription").textContent =
      `Final score: ${score.toLocaleString()} · Targets: ${destroyed}. Ready for another round?`;

    startButton.textContent = "PLAY AGAIN →";
    resultPanel.classList.remove("hidden");

    $$(".powerup-button").forEach((button) => {
      button.disabled = true;
    });

    drawFrame();
    showToast(`GAME OVER · ${score.toLocaleString()} POINTS`);
  }

  function handleCanvasTap(event) {
    if (!running) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const target = [...gameObjects].reverse().find((object) => {
      const dx = x - object.x;
      const dy = y - object.y;

      return Math.sqrt(dx * dx + dy * dy) <= object.radius + 12;
    });

    if (target) {
      pointerTarget = target;

      if (MODES[selectedMode].words) {
        input.value = target.label;
        input.focus({ preventScroll: true });
        processWordInput();
      } else {
        registerHit(target);
      }
    } else {
      input.focus({ preventScroll: true });
    }
  }

  function bindEvents() {
    startButton.addEventListener("click", () => {
      startButton.textContent = "RESTART GAME →";
      startGame();
    });

    $("#playAgainButton").addEventListener("click", () => {
      startGame();
      window.scrollTo({ top: arena.offsetTop - 20, behavior: "smooth" });
    });

    $$("#modeList [data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        selectMode(button.dataset.mode);
      });
    });

    $("#themeSelect").addEventListener("change", (event) => {
      applyTheme(event.target.value);
    });

    $("#soundToggle").addEventListener("click", () => {
      profile.sound = !profile.sound;
      $("#soundToggle").textContent = `SOUND: ${profile.sound ? "ON" : "OFF"}`;
      saveProfile();

      if (profile.sound) playSound("power");
    });

    $("#durationSelect").addEventListener("change", () => {
      if (!running) {
        remaining = Number($("#durationSelect").value) || 60;
        updateGameUI();
        drawFrame();
      }
    });

    form.addEventListener("submit", handleFormSubmit);

    input.addEventListener("input", () => {
      if (!running) return;

      if (MODES[selectedMode].words) {
        wordBuffer = input.value;
        processWordInput();
      } else {
        const value = input.value;
        if (value) {
          processBubbleInput(value);
          input.value = "";
        }
      }
    });

    $$(".powerup-button").forEach((button) => {
      button.addEventListener("click", () => {
        usePower(button.dataset.power);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const tag = document.activeElement?.tagName;
      const typingInInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (event.key === "Escape" && running) {
        endGame("GAME OVER");
        return;
      }

      if (typingInInput && document.activeElement !== input) return;

      if (/^[1-4]$/.test(event.key) && running) {
        const names = { "1": "slow", "2": "bomb", "3": "shield", "4": "freeze" };
        usePower(names[event.key]);
        return;
      }

      if (!running && event.key === "Enter" && !typingInInput) {
        startGame();
        return;
      }

      if (MODES[selectedMode].words && document.activeElement !== input && /^[a-zA-Z]$/.test(event.key)) {
        input.focus({ preventScroll: true });
      }
    });

    canvas.addEventListener("pointerdown", handleCanvasTap);

    $("#clearHistoryButton").addEventListener("click", () => {
      if (!profile.history.length) {
        showToast("HISTORY IS ALREADY EMPTY");
        return;
      }

      profile.history = [];
      saveProfile();
      renderHistory();
      showToast("GAME HISTORY CLEARED");
    });

    window.addEventListener("resize", resizeCanvas);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running) {
        endGame("GAME OVER");
      }
    });
  }

  function init() {
    applyTheme(profile.theme);
    $("#soundToggle").textContent = `SOUND: ${profile.sound ? "ON" : "OFF"}`;

    bindEvents();
    updateProfileUI();
    selectMode("bubble");
    resizeCanvas();
    updateGameUI();
  }

  init();
})();
