"use strict";

/* =====================================================================
   TYPEX — MULTI-ENGINE ARCADE ENGINE
   File: script.js
   Full Procedural Sound Synth + 6 Dedicated Canvas Sub-Engines
   ===================================================================== */

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

  let canvasWidth = 0;
  let canvasHeight = 0;
  let pixelRatio = 1;
  let animationId = 0;

  /* =====================================================================
     PROCEDURAL AUDIO SYNTHESIZER
     ===================================================================== */
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (type === "type") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520 + Math.random() * 260, now);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } else if (type === "hit") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      const pitch = 450 + Math.min(hub.combo * 25, 600);
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
    } else if (type === "slash") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    } else if (type === "boom") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.38);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === "miss") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === "tick") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(900, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
    }
  }

  /* =====================================================================
     HUB STATE & TELEMETRY
     ===================================================================== */
  const hub = {
    currentMode: "bubble",
    running: false,
    paused: false,
    ended: false,
    score: 0,
    hits: 0,
    misses: 0,
    combo: 0,
    bestCombo: 0,
    lives: 3,
    level: 1,
    elapsed: 0,
    startedAt: 0,
    lastFrame: 0,
    activeEngine: null
  };

  const WORDS_BANK = [
    "CYBER", "NEON", "MATRIX", "VECTOR", "SHADOW", "SIGNAL",
    "REACTOR", "PLASMA", "INFINITY", "LIGHTNING", "HYPERION",
    "PROTOCOL", "FIREWALL", "VELOCITY", "TITANIUM", "ALGORITHM"
  ];
  const CHARS_BANK = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function getAccuracy() {
    const total = hub.hits + hub.misses;
    return total === 0 ? 100 : Math.round((hub.hits / total) * 100);
  }

  function getWPM() {
    const mins = hub.elapsed / 60;
    return mins <= 0 ? 0 : Math.round((hub.hits * 4) / 5 / mins);
  }

  function updateTelemetry() {
    $("#score-value").textContent = String(hub.score).padStart(6, "0");
    $("#accuracy-value").textContent = getAccuracy();
    $("#accuracy-bar").style.width = `${getAccuracy()}%`;
    $("#wpm-value").textContent = getWPM();
    $("#combo-value").textContent = `x${hub.combo}`;
    $("#combo-bar").style.width = `${Math.min(100, hub.combo * 10)}%`;
    $("#best-combo").textContent = `BEST ${hub.bestCombo}`;
    $("#lives-value").textContent = `${hub.lives} / 3`;
    $("#hits-value").textContent = hub.hits;
    $("#misses-value").textContent = hub.misses;
    $("#arena-level").textContent = `LEVEL ${String(hub.level).padStart(2, "0")}`;
  }

  function triggerShake() {
    arena.classList.remove("shake");
    void arena.offsetWidth;
    arena.classList.add("shake");
  }

  function addScore(pts) {
    hub.score += pts;
    $("#score-change").textContent = `+${pts}`;
    hub.level = Math.max(1, 1 + Math.floor(hub.score / 600));
    updateTelemetry();
  }

  function registerHit(pts = 100) {
    hub.hits++;
    hub.combo++;
    hub.bestCombo = Math.max(hub.bestCombo, hub.combo);
    addScore(pts + Math.min(hub.combo, 15) * 10);
    playSound("hit");
  }

  function registerMiss(msg = "MISSED!") {
    hub.misses++;
    hub.combo = 0;
    playSound("miss");
    $("#typing-instruction").textContent = msg;
    updateTelemetry();
  }

  function loseLife(msg) {
    hub.lives = Math.max(0, hub.lives - 1);
    hub.combo = 0;
    triggerShake();
    updateTelemetry();
    playSound("miss");

    if (hub.lives <= 0) {
      endGame("SIMULATION TERMINATED", msg || "System life integrity collapsed.");
      return true;
    }
    $("#typing-instruction").textContent = msg || "Damage sustained!";
    return false;
  }

  function endGame(title, desc) {
    hub.running = false;
    hub.ended = true;
    cancelAnimationFrame(animationId);
    typingInput.disabled = true;
    submitButton.disabled = true;

    $("#result-title").textContent = title;
    $("#result-description").textContent = desc;
    $("#result-score").textContent = hub.score.toLocaleString();
    $("#result-accuracy").textContent = `${getAccuracy()}%`;
    $("#result-wpm").textContent = getWPM();
    $("#result-kicker").textContent = hub.lives > 0 ? "MISSION ACCOMPLISHED" : "SYSTEM FAILED";
    $("#result-symbol").textContent = hub.lives > 0 ? "✓" : "!";

    resultOverlay.classList.remove("hidden");
    startOverlay.classList.add("hidden");
  }

  /* =====================================================================
     1. BUBBLE POP ENGINE (PHYSICS + SPEED CONTROLLER)
     ===================================================================== */
  const BubbleEngine = {
    bubbles: [],
    particles: [],
    lastSpawn: 0,
    speedMultiplier: 1.0,

    init() {
      this.bubbles = [];
      this.particles = [];
      this.lastSpawn = performance.now();

      const speedControlEl = $("#bubble-speed-controls");
      if (speedControlEl) speedControlEl.style.display = "inline-flex";

      this.bindSpeedButtons();

      for (let i = 0; i < 5; i++) this.spawn(true);
      $("#typing-label-text").textContent = "TYPE THE LETTER INSIDE BUBBLE";
      typingInput.placeholder = "Press letter on keyboard...";
      $("#typing-instruction").textContent = "Quick-fire typing: Single keypress instantly pops.";
    },

    bindSpeedButtons() {
      const btns = document.querySelectorAll(".speed-btn");
      btns.forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          btns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.speedMultiplier = parseFloat(btn.dataset.speed) || 1.0;

          this.bubbles.forEach((b) => {
            b.vy = -(32 + Math.random() * 35 + hub.level * 4) * this.speedMultiplier;
          });
        };
      });
    },

    spawn(initial = false) {
      const r = 22;
      const baseSpeed = 32 + Math.random() * 35 + hub.level * 4;

      this.bubbles.push({
        letter: String.fromCharCode(65 + Math.floor(Math.random() * 26)),
        x: Math.random() * (canvasWidth - 60) + 30,
        y: initial ? Math.random() * (canvasHeight * 0.6) + 40 : canvasHeight + 20,
        r,
        vy: -baseSpeed * this.speedMultiplier,
        wobble: Math.random() * 10,
        color: ["#a879ff", "#4ce7ff", "#4ff5b7"][Math.floor(Math.random() * 3)]
      });
    },

    handleInput(val) {
      const char = val.slice(-1).toUpperCase();
      if (!/^[A-Z]$/.test(char)) return;

      const idx = this.bubbles.findIndex((b) => b.letter === char);
      if (idx !== -1) {
        const b = this.bubbles[idx];
        for (let i = 0; i < 16; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = Math.random() * 120 + 30;
          this.particles.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.5,
            color: b.color
          });
        }
        this.bubbles.splice(idx, 1);
        registerHit(Math.round(80 * this.speedMultiplier));
      } else {
        registerMiss("No matching bubble!");
      }
      typingInput.value = "";
    },

    update(delta, now) {
      const spawnDelay = Math.max(300, (1200 - hub.level * 60) / this.speedMultiplier);

      if (now - this.lastSpawn > spawnDelay) {
        this.spawn();
        this.lastSpawn = now;
      }

      for (let i = this.bubbles.length - 1; i >= 0; i--) {
        const b = this.bubbles[i];
        b.y += b.vy * delta;
        b.x += Math.sin(now / 500 + b.wobble) * 22 * delta;

        if (b.y + b.r < 0) {
          this.bubbles.splice(i, 1);
          if (loseLife("Bubble escaped upper boundary!")) return;
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.life -= delta;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
    },

    render(now) {
      this.bubbles.forEach((b) => {
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = b.color;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(16, 24, 45, 0.7)";

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "800 17px Orbitron";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 0;
        ctx.fillText(b.letter, b.x, b.y + 1);
        ctx.restore();
      });

      this.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
    }
  };

  /* =====================================================================
     2. WORD RAIN ENGINE (MATRIX CASCADE)
     ===================================================================== */
  const WordRainEngine = {
    words: [],
    lastSpawn: 0,

    init() {
      this.words = [];
      this.lastSpawn = performance.now();
      this.spawn();
      this.spawn();
      $("#typing-label-text").textContent = "TYPE FALLING WORD AND PRESS ENTER";
      typingInput.placeholder = "Type complete word...";
      $("#typing-instruction").textContent = "Target falling matrix words before hitting the floor.";
    },

    spawn() {
      const text = WORDS_BANK[Math.floor(Math.random() * WORDS_BANK.length)];
      this.words.push({
        text,
        x: Math.random() * (canvasWidth - 140) + 70,
        y: -30,
        vy: 32 + Math.random() * 25 + hub.level * 4
      });
    },

    handleSubmit(val) {
      const idx = this.words.findIndex((w) => w.text === val);
      if (idx !== -1) {
        registerHit(120 + val.length * 10);
        this.words.splice(idx, 1);
      } else {
        registerMiss("Word not detected!");
      }
      typingInput.value = "";
    },

    update(delta, now) {
      if (now - this.lastSpawn > Math.max(700, 1800 - hub.level * 90)) {
        this.spawn();
        this.lastSpawn = now;
      }

      for (let i = this.words.length - 1; i >= 0; i--) {
        const w = this.words[i];
        w.y += w.vy * delta;

        if (w.y > canvasHeight - 40) {
          this.words.splice(i, 1);
          if (loseLife("Word hit ground perimeter!")) return;
        }
      }
    },

    render() {
      const active = typingInput.value.trim().toUpperCase();

      this.words.forEach((w) => {
        ctx.save();
        const matched = active && w.text.startsWith(active);
        ctx.font = "700 13px Orbitron";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(w.text).width + 24;
        ctx.fillStyle = matched ? "rgba(79, 245, 183, 0.15)" : "rgba(10, 16, 32, 0.85)";
        ctx.strokeStyle = matched ? "#4ff5b7" : "rgba(76, 231, 255, 0.5)";
        ctx.lineWidth = matched ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(w.x - textWidth / 2, w.y - 14, textWidth, 28, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = matched ? "#4ff5b7" : "#dcf4ff";
        ctx.fillText(w.text, w.x, w.y);
        ctx.restore();
      });
    }
  };

  /* =====================================================================
     3. LAST STAND ENGINE (3-LANE DEFENSE)
     ===================================================================== */
  const SurvivalEngine = {
    enemies: [],
    lastSpawn: 0,
    lanes: [0.22, 0.5, 0.78],

    init() {
      this.enemies = [];
      this.lastSpawn = performance.now();
      this.spawn();
      this.spawn();
      $("#typing-label-text").textContent = "DEFEND LANES: TYPE ENEMY CIPHER";
      typingInput.placeholder = "Enter enemy code...";
      $("#typing-instruction").textContent = "Enemies advancing down 3 attack lanes. Stop the breach.";
    },

    spawn() {
      const laneIdx = Math.floor(Math.random() * 3);
      let code = "";
      for (let i = 0; i < 4; i++) code += CHARS_BANK[Math.floor(Math.random() * CHARS_BANK.length)];

      this.enemies.push({
        code,
        lane: laneIdx,
        x: canvasWidth * this.lanes[laneIdx],
        y: 60,
        vy: 25 + hub.level * 3.5
      });
    },

    handleSubmit(val) {
      const idx = this.enemies.findIndex((e) => e.code === val);
      if (idx !== -1) {
        registerHit(140);
        this.enemies.splice(idx, 1);
      } else {
        registerMiss("Enemy cipher mismatch!");
      }
      typingInput.value = "";
    },

    update(delta, now) {
      if (now - this.lastSpawn > Math.max(650, 1600 - hub.level * 90)) {
        this.spawn();
        this.lastSpawn = now;
      }

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const en = this.enemies[i];
        en.y += en.vy * delta;

        if (en.y >= canvasHeight - 65) {
          this.enemies.splice(i, 1);
          if (loseLife("Enemy breached defensive base!")) return;
        }
      }
    },

    render() {
      const active = typingInput.value.trim().toUpperCase();

      this.lanes.forEach((pos, i) => {
        const lx = canvasWidth * pos;
        ctx.strokeStyle = "rgba(76, 231, 255, 0.12)";
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(lx, 40);
        ctx.lineTo(lx, canvasHeight - 55);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "700 8.5px Orbitron";
        ctx.fillStyle = "#617192";
        ctx.textAlign = "center";
        ctx.fillText(`LANE 0${i + 1}`, lx, 35);
      });

      const by = canvasHeight - 52;
      ctx.strokeStyle = "#4ff5b7";
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#4ff5b7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(25, by);
      ctx.lineTo(canvasWidth - 25, by);
      ctx.stroke();
      ctx.shadowBlur = 0;

      this.enemies.forEach((en) => {
        const matched = active && en.code.startsWith(active);
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.fillStyle = matched ? "rgba(79, 245, 183, 0.2)" : "rgba(255, 82, 119, 0.2)";
        ctx.strokeStyle = matched ? "#4ff5b7" : "#ff5277";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(20, 0);
        ctx.lineTo(0, 20);
        ctx.lineTo(-20, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.font = "800 11px Orbitron";
        ctx.fillStyle = matched ? "#4ff5b7" : "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(en.code, 0, 0);
        ctx.restore();
      });
    }
  };

  /* =====================================================================
     4. BOSS FIGHT ENGINE (2D FIGHTER BRAWLER)
     ===================================================================== */
  const BossEngine = {
    bossHp: 100,
    bossMaxHp: 100,
    heroX: 0,
    heroTargetX: 0,
    bossX: 0,
    attackWord: "",
    laserSlash: null,
    bossAttackTimer: 0,

    init() {
      this.bossHp = 100;
      this.heroX = canvasWidth * 0.2;
      this.heroTargetX = this.heroX;
      this.bossX = canvasWidth * 0.8;
      this.laserSlash = null;
      this.bossAttackTimer = performance.now();
      this.nextWord();
      $("#typing-label-text").textContent = "TYPE COMBO ATTACK WORD TO STRIKE BOSS";
      typingInput.placeholder = "Type attack combo...";
      $("#typing-instruction").textContent = "Dual Fighter Arena: Strike before the boss unleashes its laser.";
    },

    nextWord() {
      this.attackWord = WORDS_BANK[Math.floor(Math.random() * WORDS_BANK.length)];
      this.bossAttackTimer = performance.now();
    },

    handleSubmit(val) {
      if (val === this.attackWord) {
        const dmg = 20 + Math.min(hub.combo, 10) * 3;
        this.bossHp = Math.max(0, this.bossHp - dmg);
        registerHit(160 + dmg * 4);
        playSound("slash");
        triggerShake();

        this.heroX = this.bossX - 60;
        this.laserSlash = { x: this.bossX, y: canvasHeight * 0.5, life: 0.25 };

        if (this.bossHp <= 0) {
          addScore(1000);
          endGame("BOSS DECIMATED!", "Full victory achieved in combat.");
          return;
        }
        this.nextWord();
      } else {
        registerMiss("Boss blocked your strike!");
      }
      typingInput.value = "";
    },

    update(delta, now) {
      this.heroX += (this.heroTargetX - this.heroX) * delta * 8;

      if (this.laserSlash) {
        this.laserSlash.life -= delta;
        if (this.laserSlash.life <= 0) this.laserSlash = null;
      }

      if (now - this.bossAttackTimer > 8000) {
        this.bossAttackTimer = now;
        if (loseLife("Boss countered with Plasma Blast!")) return;
      }
    },

    render(now) {
      const active = typingInput.value.trim().toUpperCase();
      const cy = canvasHeight * 0.5;

      ctx.strokeStyle = "rgba(76, 231, 255, 0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(canvasWidth * 0.1, cy + 60);
      ctx.lineTo(canvasWidth * 0.9, cy + 60);
      ctx.stroke();

      ctx.save();
      ctx.fillStyle = "#4ce7ff";
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#4ce7ff";
      ctx.fillRect(this.heroX - 16, cy - 25, 32, 50);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(this.heroX - 4, cy - 15, 20, 8);
      ctx.restore();

      ctx.save();
      const bPulse = Math.sin(now / 150) * 4;
      ctx.fillStyle = "#ff5277";
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#ff5277";
      ctx.fillRect(this.bossX - 35, cy - 45 - bPulse / 2, 70, 90 + bPulse);
      ctx.fillStyle = "#220008";
      ctx.fillRect(this.bossX - 20, cy - 20, 40, 15);
      ctx.restore();

      if (this.laserSlash) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(this.bossX - 50, cy - 60);
        ctx.lineTo(this.bossX + 50, cy + 60);
        ctx.stroke();
      }

      const bw = 240;
      const bx = canvasWidth / 2 - bw / 2;
      const by = 55;
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = "#ff5277";
      ctx.fillRect(bx, by, bw * (this.bossHp / this.bossMaxHp), 8);
      ctx.font = "800 10px Orbitron";
      ctx.fillStyle = "#ff5277";
      ctx.textAlign = "center";
      ctx.fillText(`MECHA BOSS STABILITY ${this.bossHp}%`, canvasWidth / 2, by - 10);

      ctx.font = "900 24px Orbitron";
      ctx.fillStyle = active && this.attackWord.startsWith(active) ? "#4ff5b7" : "#ffffff";
      ctx.fillText(this.attackWord, canvasWidth / 2, cy - 40);
    }
  };

  /* =====================================================================
     5. BOMB DEFUSE ENGINE (TACTICAL KEYPAD)
     ===================================================================== */
  const BombEngine = {
    code: "",
    deadline: 0,
    duration: 8,
    bombsDefused: 0,
    lastTick: -1,

    init() {
      this.bombsDefused = 0;
      this.newBomb();
      $("#typing-label-text").textContent = "ENTER DEFUSAL KEYCODE";
      typingInput.placeholder = "Enter matching sequence...";
      $("#typing-instruction").textContent = "Detonation timer running. Type exact keycode before 0.0s.";
    },

    newBomb() {
      const len = Math.min(8, 4 + this.bombsDefused);
      this.duration = Math.max(4.5, 9.5 - this.bombsDefused * 0.7);
      this.code = "";
      for (let i = 0; i < len; i++) this.code += CHARS_BANK[Math.floor(Math.random() * CHARS_BANK.length)];
      this.deadline = performance.now() + this.duration * 1000;
      this.lastTick = -1;
    },

    handleSubmit(val) {
      if (val === this.code) {
        this.bombsDefused++;
        registerHit(220 + this.bombsDefused * 30);
        if (this.bombsDefused >= 6) {
          endGame("ALL ORDNANCE DEFUSED!", "Mission successfully completed.");
          return;
        }
        this.newBomb();
      } else {
        registerMiss("Invalid defusal sequence!");
      }
      typingInput.value = "";
    },

    update(delta, now) {
      const rem = Math.max(0, (this.deadline - now) / 1000);
      const sec = Math.ceil(rem);
      if (sec !== this.lastTick && sec <= 5) {
        this.lastTick = sec;
        playSound("tick");
      }

      if (rem <= 0) {
        playSound("boom");
        if (loseLife("BOOM! Bomb exploded!")) return;
        this.newBomb();
      }
    },

    render(now) {
      const rem = Math.max(0, (this.deadline - now) / 1000);
      const crit = rem <= 3;
      const col = crit ? "#ff5277" : "#ffd056";
      const cx = canvasWidth / 2;
      const cy = canvasHeight * 0.48;

      ctx.save();
      ctx.shadowBlur = crit ? 30 : 15;
      ctx.shadowColor = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 130, cy - 80, 260, 160);

      ctx.font = "900 32px Orbitron";
      ctx.fillStyle = col;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rem.toFixed(1)}s`, cx, cy - 25);

      ctx.font = "800 20px Orbitron";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(this.code, cx, cy + 30);
      ctx.restore();
    }
  };

  /* =====================================================================
     6. MEMORY MASTER ENGINE (NEURAL RETENTION)
     ===================================================================== */
  const MemoryEngine = {
    sequence: "",
    phase: "show",
    deadline: 0,
    round: 0,

    init() {
      this.round = 0;
      this.nextRound();
      $("#typing-label-text").textContent = "MEMORIZE CIPHER";
      typingInput.placeholder = "Wait for cipher to clear...";
      $("#typing-instruction").textContent = "Memorize the sequence before time expires, then type it.";
    },

    nextRound() {
      this.round++;
      const len = Math.min(10, 3 + this.round);
      this.sequence = "";
      for (let i = 0; i < len; i++) this.sequence += CHARS_BANK[Math.floor(Math.random() * CHARS_BANK.length)];
      this.phase = "show";
      this.deadline = performance.now() + Math.max(1400, 3200 - this.round * 160);

      typingInput.value = "";
      typingInput.disabled = true;
      submitButton.disabled = true;
    },

    handleSubmit(val) {
      if (this.phase !== "input") return;

      if (val === this.sequence) {
        registerHit(200 + this.sequence.length * 20);
        if (this.round >= 8) {
          endGame("MEMORY MASTER!", "All 8 neural rounds cleared.");
          return;
        }
        this.nextRound();
      } else {
        if (loseLife("Memory recall incorrect!")) return;
        this.nextRound();
      }
      typingInput.value = "";
    },

    update(delta, now) {
      if (this.phase === "show" && now >= this.deadline) {
        this.phase = "input";
        this.deadline = now + 12000;
        typingInput.disabled = false;
        submitButton.disabled = false;
        typingInput.focus();
        $("#typing-label-text").textContent = "TYPE RECALLED SEQUENCE";
        typingInput.placeholder = "Enter from memory...";
      } else if (this.phase === "input" && now >= this.deadline) {
        if (loseLife("Recall window expired!")) return;
        this.nextRound();
      }
    },

    render() {
      const cx = canvasWidth / 2;
      const cy = canvasHeight * 0.48;

      ctx.font = "700 12px Orbitron";
      ctx.fillStyle = "#4ce7ff";
      ctx.textAlign = "center";
      ctx.fillText(`NEURAL RETENTION ROUND 0${this.round} / 08`, cx, cy - 60);

      if (this.phase === "show") {
        ctx.font = "900 28px Orbitron";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(this.sequence, cx, cy);
      } else {
        ctx.font = "800 18px Orbitron";
        ctx.fillStyle = "#a879ff";
        ctx.fillText("DATA PURGED — REPRODUCE SEQUENCE", cx, cy);
      }
    }
  };

  /* =====================================================================
     HUB ROUTING
     ===================================================================== */
  const ENGINES = {
    bubble: BubbleEngine,
    wordrain: WordRainEngine,
    survival: SurvivalEngine,
    boss: BossEngine,
    bomb: BombEngine,
    memory: MemoryEngine
  };

  function selectEngine(mode) {
    if (!ENGINES[mode]) return;
    hub.currentMode = mode;
    hub.activeEngine = ENGINES[mode];

    modeCards.forEach((c) => c.classList.toggle("selected", c.dataset.mode === mode));
    $("#active-mode-title").textContent = modeCards.find((c) => c.dataset.mode === mode).querySelector(".mode-title").textContent;
    $("#mission-mode").textContent = mode.toUpperCase();

    const speedControlEl = $("#bubble-speed-controls");
    if (speedControlEl) {
      speedControlEl.style.display = (mode === "bubble") ? "inline-flex" : "none";
    }

    startOverlay.classList.remove("hidden");
    resultOverlay.classList.add("hidden");
    typingInput.disabled = true;
    submitButton.disabled = true;

    hub.score = 0;
    hub.hits = 0;
    hub.misses = 0;
    hub.combo = 0;
    hub.lives = 3;
    hub.running = false;
    updateTelemetry();
    drawBackground();
  }

  function startActiveGame() {
    initAudio();
    hub.score = 0;
    hub.hits = 0;
    hub.misses = 0;
    hub.combo = 0;
    hub.lives = 3;
    hub.running = true;
    hub.ended = false;
    hub.startedAt = performance.now();
    hub.lastFrame = performance.now();

    startOverlay.classList.add("hidden");
    resultOverlay.classList.add("hidden");
    typingInput.disabled = false;
    submitButton.disabled = false;
    typingInput.value = "";
    typingInput.focus();

    hub.activeEngine.init();
    updateTelemetry();

    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(masterLoop);
  }

  function masterLoop(now) {
    if (!hub.running || hub.paused || hub.ended) return;
    const delta = Math.min((now - hub.lastFrame) / 1000, 0.05);
    hub.lastFrame = now;
    hub.elapsed = Math.max(0, (now - hub.startedAt) / 1000);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawBackground();

    hub.activeEngine.update(delta, now);
    hub.activeEngine.render(now);

    const m = Math.floor(hub.elapsed / 60);
    const s = Math.floor(hub.elapsed % 60);
    $("#arena-time").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    animationId = requestAnimationFrame(masterLoop);
  }

  function drawBackground() {
    ctx.strokeStyle = "rgba(76, 231, 255, 0.035)";
    ctx.lineWidth = 1;
    const sz = 40;
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
  }

  /* =====================================================================
     INPUT LISTENERS
     ===================================================================== */
  typingInput.addEventListener("input", () => {
    if (!hub.running || hub.paused || hub.ended) return;
    if (hub.currentMode === "bubble") {
      hub.activeEngine.handleInput(typingInput.value);
    }
  });

  typingInput.addEventListener("keydown", (e) => {
    if (e.key.length === 1 && e.key !== "Enter") {
      playSound("type");
    }
  });

  typingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!hub.running || hub.paused || hub.ended) return;
    const val = typingInput.value.trim().toUpperCase();
    if (!val) return;

    if (hub.activeEngine.handleSubmit) {
      hub.activeEngine.handleSubmit(val);
    }
  });

  modeCards.forEach((c) => c.addEventListener("click", () => selectEngine(c.dataset.mode)));
  startButton.addEventListener("click", startActiveGame);
  restartButton.addEventListener("click", startActiveGame);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (!hub.running || hub.ended) && !e.repeat) {
      e.preventDefault();
      startActiveGame();
    } else if (e.key === "Escape" && hub.running) {
      hub.paused = !hub.paused;
      if (!hub.paused) {
        hub.lastFrame = performance.now();
        animationId = requestAnimationFrame(masterLoop);
      }
    }
  });

  function resizeCanvas() {
    const rect = arena.getBoundingClientRect();
    canvasWidth = Math.max(1, rect.width);
    canvasHeight = Math.max(1, rect.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvasWidth * pixelRatio);
    canvas.height = Math.round(canvasHeight * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  selectEngine("bubble");
})();
