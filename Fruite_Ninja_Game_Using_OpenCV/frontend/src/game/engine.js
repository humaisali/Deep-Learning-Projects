import { HandMotion, projectHand } from './handMotion';
// Fruit Slice AR - Core Game Engine
import { Blade, Fruit, SlicedFruit, Bomb, Splash, ComboText } from './objects';
import { soundManager } from './audio';

export const FRUIT_TYPES = ['apple', 'watermelon', 'orange', 'banana'];

export const FRUIT_COLORS = {
  apple: '239, 68, 68',
  banana: '234, 179, 8',
  coconut: '255, 255, 255',
  orange: '249, 115, 22',
  pineapple: '245, 158, 11',
  watermelon: '220, 38, 38'
};

export class GameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks; // { onStateChange, onScoreUpdate, onGameOver, onCombo }

    // Game Settings & State
    this.state = 'WELCOME'; // 'WELCOME' | 'PLAYING' | 'ROUND_TRANSITION' | 'GAME_OVER' | 'PAUSED'
    this.mode = '1P'; // '1P' | '2P'
    this.difficulty = 'Medium'; // 'Easy' | 'Medium' | 'Hard'
    this.bgMode = 'ar'; // Default to 'ar' so camera is immediately visible behind game!

    // Scores & Stats
    this.score1 = 0;
    this.score2 = 0;
    this.totalScore1 = 0;
    this.totalScore2 = 0;
    this.lives1 = 3;
    this.lives2 = 3;
    this.timeLeft = 30;
    this.currentRound = 1;
    this.roundWins1 = 0;
    this.roundWins2 = 0;
    this.roundWinnerText = '';
    this.highScore = parseInt(localStorage.getItem('fruit_slice_highscore') || '0', 10);
    this.isNewHighScore = false;

    // Blades (P1 Cyan, P2 Red/Coral)
    this.blade1 = new Blade('rgba(56, 189, 248, 0.75)', '#ffffff');
    this.blade2 = new Blade('rgba(239, 68, 68, 0.75)', '#ffffff');

    // Live Game Collections
    this.activeFruits = [];
    this.activeSplashes = [];
    this.activeComboTexts = [];

    // Animation & Loop
    this.animationId = null;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.spawnElapsed = 0;
    this.roundTransitionTimer = 0;

    // Assets
    this.bgImage = new Image();
    this.bgImage.src = '/assets/bg/background.png';

    // Video Frame reference from MediaPipe
    this.currentVideoFrame = null;
    this.currentHandsLandmarks = null;
    this.handMotion = [new HandMotion(), new HandMotion()];

  }

  setVideoFrame(frame) {
    this.currentVideoFrame = frame;
  }

  setHandsLandmarks(landmarks) {
    this.currentHandsLandmarks = landmarks;
    this.hasNewHandResults = true;
  }

  start() {
    this.lastTime = performance.now();
    if (!this.animationId) {
      this.loop();
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  setDifficulty(diff) {
    this.difficulty = diff;
  }

  setBgMode(bgMode) {
    this.bgMode = bgMode;
  }

  getDifficultySettings() {
    if (this.difficulty === 'Easy') return { spawnRate: 65, bombChance: 0.05 };
    if (this.difficulty === 'Medium') return { spawnRate: 45, bombChance: 0.15 };
    if (this.difficulty === 'Hard') return { spawnRate: 28, bombChance: 0.25 };
    return { spawnRate: 45, bombChance: 0.15 };
  }

  startNewGame() {
    this.score1 = 0;
    this.score2 = 0;
    this.totalScore1 = 0;
    this.totalScore2 = 0;
    this.lives1 = 3;
    this.lives2 = 3;
    this.timeLeft = 30;
    this.currentRound = 1;
    this.roundWins1 = 0;
    this.roundWins2 = 0;
    this.isNewHighScore = false;
    this.frameCount = 0;
    this.spawnElapsed = 0;
    this.activeFruits = [];
    this.activeSplashes = [];
    this.activeComboTexts = [];

    this.state = 'PLAYING';
    soundManager.play('start');

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange('PLAYING');
    }
    this.notifyScore();
  }

  pauseGame() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      if (this.callbacks.onStateChange) this.callbacks.onStateChange('PAUSED');
    }
  }

  resumeGame() {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.lastTime = performance.now();
      if (this.callbacks.onStateChange) this.callbacks.onStateChange('PLAYING');
    }
  }

  notifyScore() {
    if (this.callbacks.onScoreUpdate) {
      this.callbacks.onScoreUpdate({
        score1: this.score1,
        score2: this.score2,
        totalScore1: this.totalScore1,
        totalScore2: this.totalScore2,
        lives1: this.lives1,
        lives2: this.lives2,
        timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
        currentRound: this.currentRound,
        roundWins1: this.roundWins1,
        roundWins2: this.roundWins2,
        highScore: this.highScore,
        isNewHighScore: this.isNewHighScore
      });
    }
  }

  end1PGame() {
    this.state = 'GAME_OVER';
    soundManager.play('over');

    if (this.score1 > this.highScore) {
      this.highScore = this.score1;
      this.isNewHighScore = true;
      localStorage.setItem('fruit_slice_highscore', this.highScore.toString());
    }

    if (this.callbacks.onGameOver) {
      this.callbacks.onGameOver({
        winner: 'GAME OVER',
        score1: this.score1,
        highScore: this.highScore,
        isNewHighScore: this.isNewHighScore
      });
    }
    if (this.callbacks.onStateChange) this.callbacks.onStateChange('GAME_OVER');
  }

  end2PRound(reason) {
    let roundWinner = null;
    if (reason === 'bomb') {
      if (this.lives1 <= 0 && this.lives2 > 0) roundWinner = 2;
      else if (this.lives2 <= 0 && this.lives1 > 0) roundWinner = 1;
      else roundWinner = 0;
    } else if (reason === 'timer') {
      if (this.score1 > this.score2) roundWinner = 1;
      else if (this.score2 > this.score1) roundWinner = 2;
      else roundWinner = 0;
    }

    if (roundWinner === 1) {
      this.roundWins1++;
      this.roundWinnerText = `Humais Wins Round ${this.currentRound}!`;
    } else if (roundWinner === 2) {
      this.roundWins2++;
      this.roundWinnerText = `Aiman Wins Round ${this.currentRound}!`;
    } else {
      this.roundWinnerText = `Round ${this.currentRound} Tied!`;
    }

    this.totalScore1 += this.score1;
    this.totalScore2 += this.score2;

    if (this.roundWins1 >= 2 || this.roundWins2 >= 2 || this.currentRound >= 3) {
      this.state = 'GAME_OVER';
      soundManager.play('over');

      let finalWinner = 'DRAW!';
      if (this.roundWins1 > this.roundWins2) finalWinner = 'HUMAIS VICTORY!';
      else if (this.roundWins2 > this.roundWins1) finalWinner = 'AIMAN VICTORY!';

      if (this.callbacks.onGameOver) {
        this.callbacks.onGameOver({
          winner: finalWinner,
          score1: this.totalScore1,
          score2: this.totalScore2,
          roundWins1: this.roundWins1,
          roundWins2: this.roundWins2
        });
      }
      if (this.callbacks.onStateChange) this.callbacks.onStateChange('GAME_OVER');
    } else {
      this.state = 'ROUND_TRANSITION';
      this.roundTransitionTimer = 0;
      soundManager.play('splat');
      if (this.callbacks.onStateChange) this.callbacks.onStateChange('ROUND_TRANSITION');
    }
    this.notifyScore();
  }

  loop() {
    this.animationId = requestAnimationFrame(() => this.loop());

    const now = performance.now();
    const elapsed = (now - this.lastTime) / 1000;
    const dt = Math.min(elapsed, 0.05);
    const step = dt * 60;
    this.lastTime = now;

    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // DRAW BACKGROUND
    if (this.bgMode === 'ar') {
      // Live camera video is mounted directly behind canvas in DOM for ultra-smooth 60fps hardware acceleration!
      // Add very subtle transparent scrim so bright fruits and HUD have exceptional contrast
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else {
      // Draw Rich Wood Dojo Background
      if (this.bgImage.complete && this.bgImage.naturalHeight !== 0) {
        ctx.drawImage(this.bgImage, 0, 0, width, height);
      } else {
        // Fallback Dojo Dark Gradient
        const grad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width);
        grad.addColorStop(0, '#2b1b17');
        grad.addColorStop(1, '#0c0706');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    }

    // SPLIT SCREEN DIVIDER (2P Mode)
    if (this.mode === '2P') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.restore();
    }

    // UPDATE BLADES FROM MEDIAPIPE HANDS
    const blades = [this.blade1, this.blade2];
    if (this.hasNewHandResults) {
      const video = this.currentVideoFrame;
      const hands = (this.currentHandsLandmarks || []).map(hand =>
        projectHand(hand, width, height, video?.videoWidth || width, video?.videoHeight || height));
      this.handMotion.forEach((track, player) => {
        const candidates = hands.filter(hand => this.mode === '2P'
          ? Number(hand[8].x >= width / 2) === player : player === 0);
        track.update(candidates, blades[player], now, Math.min(width, height));
      });
      this.hasNewHandResults = false;
    } else {
      this.handMotion.forEach((track, player) => {
        if (track.points && now - track.time > 200) track.update([], blades[player], now, 0);
      });
    }

    // GAMEPLAY STATE LOGIC
    if (this.state === 'PLAYING') {
      this.frameCount += step;
      this.spawnElapsed += step;

      if (this.mode === '2P') {
        this.timeLeft -= elapsed;
        if (this.timeLeft <= 0) {
          this.end2PRound('timer');
          return;
        }
      }

      // Spawn Fruits
      const diff = this.getDifficultySettings();
      let spawnRate = Math.max(15, diff.spawnRate - Math.floor(this.frameCount / 400) * 3);
      const isInstantSpawn = this.frameCount <= step;

      if (isInstantSpawn || this.spawnElapsed >= spawnRate) {
        this.spawnElapsed = 0;
        const spawnY = height + 50;

        if (this.mode === '2P') {
          // Left player spawn
          const x1 = Math.random() * (width / 2 - 160) + 80;
          if (Math.random() < diff.bombChance) {
            this.activeFruits.push(new Bomb(x1, spawnY));
          } else {
            const t1 = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
            this.activeFruits.push(new Fruit(x1, spawnY, t1));
          }

          // Right player spawn
          const x2 = width / 2 + Math.random() * (width / 2 - 160) + 80;
          if (Math.random() < diff.bombChance) {
            this.activeFruits.push(new Bomb(x2, spawnY));
          } else {
            const t2 = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
            this.activeFruits.push(new Fruit(x2, spawnY, t2));
          }
        } else {
          // 1P Random spawn
          const x = Math.random() * (width - 180) + 90;
          if (Math.random() < diff.bombChance) {
            this.activeFruits.push(new Bomb(x, spawnY));
          } else {
            const t = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
            this.activeFruits.push(new Fruit(x, spawnY, t));
          }
        }
      }

      // Check Slices & Update Fruits
      let p1Combos = 0;
      let p2Combos = 0;
      let p1SumX = 0, p1SumY = 0;
      let p2SumX = 0, p2SumY = 0;

      for (let i = this.activeFruits.length - 1; i >= 0; i--) {
        const f = this.activeFruits[i];
        let slicedBy = null;
        let sliceVel = 0;

        if (f.checkSlice) {
          if ((this.mode === '1P' || f.x < width / 2) && f.checkSlice(this.blade1)) {
            slicedBy = 1;
            sliceVel = this.blade1.velocity;
          } else if (this.mode === '2P' && f.x >= width / 2 && f.checkSlice(this.blade2)) {
            slicedBy = 2;
            sliceVel = this.blade2.velocity;
          }
        }

        if (slicedBy !== null) {
          if (f.type === 'bomb') {
            soundManager.play('bomb');
            // Red flash screen
            ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
            ctx.fillRect(0, 0, width, height);

            if (slicedBy === 1) this.lives1--;
            if (slicedBy === 2) this.lives2--;

            this.activeFruits.splice(i, 1);
            this.notifyScore();

            if (this.mode === '1P' && this.lives1 <= 0) {
              this.end1PGame();
              return;
            } else if (this.mode === '2P' && (this.lives1 <= 0 || this.lives2 <= 0)) {
              this.end2PRound('bomb');
              return;
            }
            continue;
          } else {
            // Cut Fruit
            soundManager.play('splat');
            if (slicedBy === 1) {
              this.score1++;
              p1Combos++;
              p1SumX += f.x;
              p1SumY += f.y;
            } else {
              this.score2++;
              p2Combos++;
              p2SumX += f.x;
              p2SumY += f.y;
            }

            this.activeFruits.push(new SlicedFruit(f.x, f.y, f.type, -1, sliceVel));
            this.activeFruits.push(new SlicedFruit(f.x, f.y, f.type, 1, sliceVel));
            this.activeSplashes.push(new Splash(f.x, f.y, FRUIT_COLORS[f.type] || '255, 165, 0'));
            this.activeFruits.splice(i, 1);
            this.notifyScore();
            continue;
          }
        }

        f.update(step);

        // Screen boundary walls
        if (this.mode === '2P') {
          const mid = width / 2;
          if (f.x < mid && f.x + f.size / 2 > mid) {
            f.x = mid - f.size / 2;
            f.vx = -Math.abs(f.vx);
          } else if (f.x >= mid && f.x - f.size / 2 < mid) {
            f.x = mid + f.size / 2;
            f.vx = Math.abs(f.vx);
          }
        }
        if (f.x - f.size / 2 < 0) {
          f.x = f.size / 2;
          f.vx = Math.abs(f.vx);
        } else if (f.x + f.size / 2 > width) {
          f.x = width - f.size / 2;
          f.vx = -Math.abs(f.vx);
        }

        f.draw(ctx);

        if (f.y > height + 120) {
          this.activeFruits.splice(i, 1);
        }
      }

      this.blade1.velocity = 0;
      this.blade2.velocity = 0;

      // Combo Evaluation
      if (p1Combos >= 2) {
        this.score1 += p1Combos;
        soundManager.play('combo');
        const avgX = p1SumX / p1Combos;
        const avgY = p1SumY / p1Combos;
        this.activeComboTexts.push(new ComboText(avgX, avgY, `${p1Combos}x COMBO!`, '#38bdf8'));
        this.notifyScore();
      }
      if (p2Combos >= 2) {
        this.score2 += p2Combos;
        soundManager.play('combo');
        const avgX = p2SumX / p2Combos;
        const avgY = p2SumY / p2Combos;
        this.activeComboTexts.push(new ComboText(avgX, avgY, `${p2Combos}x COMBO!`, '#f87171'));
        this.notifyScore();
      }

      // Update Splashes & Combos
      for (let i = this.activeSplashes.length - 1; i >= 0; i--) {
        const s = this.activeSplashes[i];
        s.update(step);
        s.draw(ctx);
        if (s.particles.length === 0) this.activeSplashes.splice(i, 1);
      }
      for (let i = this.activeComboTexts.length - 1; i >= 0; i--) {
        const c = this.activeComboTexts[i];
        c.update(step);
        c.draw(ctx);
        if (c.alpha <= 0) this.activeComboTexts.splice(i, 1);
      }
    } else if (this.state === 'ROUND_TRANSITION') {
      this.roundTransitionTimer += dt;
      // Draw transition message
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px "Cinzel", "Shojumaru", sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.strokeText(this.roundWinnerText, width / 2, height / 2 - 20);
      ctx.fillText(this.roundWinnerText, width / 2, height / 2 - 20);

      ctx.font = '24px "Inter", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Next Round Starting in ${Math.ceil(3 - this.roundTransitionTimer)}s...`, width / 2, height / 2 + 30);
      ctx.restore();

      if (this.roundTransitionTimer >= 3) {
        this.currentRound++;
        this.timeLeft = 30;
        this.lives1 = 3;
        this.lives2 = 3;
        this.score1 = 0;
        this.score2 = 0;
        this.frameCount = 0;
        this.spawnElapsed = 0;
        this.activeFruits = [];
        this.activeSplashes = [];
        this.activeComboTexts = [];
        this.state = 'PLAYING';
        soundManager.play('start');
        if (this.callbacks.onStateChange) this.callbacks.onStateChange('PLAYING');
        this.notifyScore();
      }
    }

    // DRAW BLADE TRAILS
    this.blade1.draw(ctx);
    if (this.mode === '2P') {
      this.blade2.draw(ctx);
    }

    // DRAW REAL-TIME HAND & FINGERTIP TRACKING FEEDBACK
    this.handMotion.forEach((track, player) => {
      if (track.points) this.drawHandFeedback(ctx, track.points, player === 1);
    });
  }

  drawHandFeedback(ctx, landmarks, isPlayer2 = false) {
    const color = isPlayer2 ? '#f87171' : '#38bdf8';
    const glowColor = isPlayer2 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(56, 189, 248, 0.45)';

    ctx.save();

    // 1. Draw subtle neon connecting skeleton
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm base
    ];

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = glowColor;
    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      const x1 = p1.x;
      const y1 = p1.y;
      const x2 = p2.x;
      const y2 = p2.y;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // 2. Draw subtle joint dots
    landmarks.forEach((lm, idx) => {
      if (idx === 8) return; // Landmark 8 (Index tip) gets the special reticle
      const jx = lm.x;
      const jy = lm.y;
      ctx.beginPath();
      ctx.arc(jx, jy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
    });

    // 3. Highlight Index Finger Tip (Landmark 8) with Katana Blade Reticle
    const tip = landmarks[8];
    const tx = tip.x;
    const ty = tip.y;

    // Outer aura
    ctx.beginPath();
    ctx.arc(tx, ty, 20, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();

    // Rotating Crosshair Ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(tx, ty, 13, 0, Math.PI * 2);
    ctx.stroke();

    // Center Hot White Core
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fill();

    // Reticle Crosshairs
    const tLen = 8;
    ctx.beginPath();
    ctx.moveTo(tx - 13 - tLen, ty); ctx.lineTo(tx - 13, ty);
    ctx.moveTo(tx + 13, ty); ctx.lineTo(tx + 13 + tLen, ty);
    ctx.moveTo(tx, ty - 13 - tLen); ctx.lineTo(tx, ty - 13);
    ctx.moveTo(tx, ty + 13); ctx.lineTo(tx, ty + 13 + tLen);
    ctx.stroke();

    // Floating Blade Tag
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#000000';
    ctx.fillText(this.mode === '1P' ? 'BLADE' : (isPlayer2 ? 'Aiman' : 'Humais'), tx, ty - 26);

    ctx.restore();
  }
}
