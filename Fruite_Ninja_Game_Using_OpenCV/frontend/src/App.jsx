import { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Pause,
  Maximize2,
  Minimize2,
  Swords,
  User,
  Users,
  Flame,
  Camera,
  Tv,
  HelpCircle,
  Trophy,
  Heart,
  X,
  Sparkles,
  Hand
} from 'lucide-react';
import { GameEngine } from './game/engine';
import { HandTracker } from './game/handTracker';
import { soundManager } from './game/audio';
import './App.css';

export default function App() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const engineRef = useRef(null);
  const trackerRef = useRef(null);

  // Game Settings & UI States
  const [gameState, setGameState] = useState('WELCOME'); // 'WELCOME' | 'PLAYING' | 'PAUSED' | 'ROUND_TRANSITION' | 'GAME_OVER'
  const [gameMode, setGameMode] = useState('1P'); // '1P' | '2P'
  const [difficulty, setDifficulty] = useState('Medium'); // 'Easy' | 'Medium' | 'Hard'
  const [bgMode, setBgMode] = useState('ar'); // Default to 'ar' live camera background
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Live Stats
  const [scoreData, setScoreData] = useState({
    score1: 0,
    score2: 0,
    totalScore1: 0,
    totalScore2: 0,
    lives1: 3,
    lives2: 3,
    timeLeft: 30,
    currentRound: 1,
    roundWins1: 0,
    roundWins2: 0,
    highScore: parseInt(localStorage.getItem('fruit_slice_highscore') || '0', 10),
    isNewHighScore: false
  });

  const [gameOverData, setGameOverData] = useState({
    winner: '',
    score1: 0,
    score2: 0,
    highScore: 0,
    isNewHighScore: false,
    roundWins1: 0,
    roundWins2: 0
  });

  const [trackerStatus, setTrackerStatus] = useState({
    status: 'idle',
    message: 'Initializing camera...',
    handsCount: 0
  });

  // Initialize Canvas, Engine, and MediaPipe Tracker
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resize handler
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Instantiate Game Engine
    const engine = new GameEngine(canvas, {
      onStateChange: (state) => setGameState(state),
      onScoreUpdate: (data) => setScoreData(data),
      onGameOver: (data) => setGameOverData(data)
    });
    engineRef.current = engine;
    engine.start();

    // Instantiate MediaPipe Hand Tracker
    const tracker = new HandTracker({
      onResults: (results) => {
        if (engineRef.current) {
          engineRef.current.setHandsLandmarks(results.multiHandLandmarks);
          if (videoRef.current && videoRef.current.readyState >= 2) {
            engineRef.current.setVideoFrame(videoRef.current);
          }
        }
        const hands = results.multiHandLandmarks || [];
        setTrackerStatus((prev) => ({ ...prev, handsCount: hands.length }));
      },
      onStatusChange: (statusObj) => {
        setTrackerStatus((prev) => ({ ...prev, ...statusObj }));
      }
    });
    trackerRef.current = tracker;

    if (videoRef.current) {
      tracker.init(videoRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.stop();
      tracker.stop();
    };
  }, []);

  // Update GameEngine mode / difficulty / bgMode when states change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setMode(gameMode);
      engineRef.current.setDifficulty(difficulty);
      engineRef.current.setBgMode(bgMode);
    }
  }, [gameMode, difficulty, bgMode]);

  // Actions
  const handleStartGame = () => {
    soundManager.init();
    if (engineRef.current) {
      engineRef.current.setMode(gameMode);
      engineRef.current.setDifficulty(difficulty);
      engineRef.current.setBgMode(bgMode);
      engineRef.current.startNewGame();
    }
  };

  const handlePauseToggle = () => {
    if (!engineRef.current) return;
    if (gameState === 'PLAYING') {
      engineRef.current.pauseGame();
    } else if (gameState === 'PAUSED') {
      engineRef.current.resumeGame();
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.startNewGame();
    }
  };

  const handleReturnToMenu = () => {
    if (engineRef.current) {
      engineRef.current.state = 'WELCOME';
      setGameState('WELCOME');
    }
  };

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleBg = () => {
    const nextBg = bgMode === 'dojo' ? 'ar' : 'dojo';
    setBgMode(nextBg);
    if (engineRef.current) {
      engineRef.current.setBgMode(nextBg);
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="game-viewport">
      {/* Live Mirrored Web Camera in the Background */}
      <video
        ref={videoRef}
        className="camera-fullscreen-bg"
        playsInline
        muted
        autoPlay
      />
      <div className="camera-vignette-overlay" />

      {/* Game Canvas on top */}
      <canvas ref={canvasRef} id="game-canvas" />

      {/* =========================================================================
          TOP HUD (IN-GAME)
          ========================================================================= */}
      {gameState !== 'WELCOME' && (
        <header className="game-hud">
          {/* Left Brand & Live Tracking Badge */}
          <div className="hud-left">
            <div className="hud-brand-pill">
              <span className="hud-brand-title">FRUIT NINJA AR</span>
              <span className={`hud-status-badge ${trackerStatus.handsCount > 0 ? 'active' : 'waiting'}`}>
                <span className={`status-dot ${trackerStatus.handsCount > 0 ? 'active' : 'warning'}`} />
                {trackerStatus.handsCount > 0
                  ? `Blade Active (${trackerStatus.handsCount} Hand${trackerStatus.handsCount > 1 ? 's' : ''})`
                  : 'Raise Hand To Slice (Or Mouse)'}
              </span>
            </div>
          </div>

          {/* Center Score & Round Display */}
          <div className="hud-center">
            {gameMode === '1P' ? (
              <div className="score-display-1p">
                <span className="score-label">Score</span>
                <span className="score-val">{scoreData.score1}</span>
                <span className="highscore-pill">Best: {scoreData.highScore}</span>
              </div>
            ) : (
              <div className="score-display-2p">
                <div className="player-score-box p1">
                  <span className="p-name">P1 (Cyan)</span>
                  <span className="p-score">{scoreData.score1}</span>
                  <span className="p-wins">Wins: {scoreData.roundWins1}</span>
                </div>

                <div className="vs-divider">
                  <span className="round-badge">R{scoreData.currentRound}/3</span>
                  <span className={`timer-pill ${scoreData.timeLeft <= 5 ? 'urgent' : ''}`}>
                    {scoreData.timeLeft}s
                  </span>
                </div>

                <div className="player-score-box p2">
                  <span className="p-name">P2 (Coral)</span>
                  <span className="p-score">{scoreData.score2}</span>
                  <span className="p-wins">Wins: {scoreData.roundWins2}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Controls & Lives */}
          <div className="hud-right">
            {/* Lives for 1P */}
            {gameMode === '1P' && (
              <div className="lives-container" title={`${scoreData.lives1} Lives Remaining`}>
                {[1, 2, 3].map((heartIndex) => (
                  <Heart
                    key={heartIndex}
                    className={`heart-icon ${heartIndex <= scoreData.lives1 ? 'alive' : 'dead'}`}
                  />
                ))}
              </div>
            )}

            {/* Toggle Dojo Wood / Live AR Camera */}
            <button
              type="button"
              className={`hud-btn ${bgMode === 'ar' ? 'active' : ''}`}
              onClick={handleToggleBg}
              title={`Switch to ${bgMode === 'dojo' ? 'AR Camera Feed' : 'Dojo Wood Background'}`}
            >
              {bgMode === 'dojo' ? <Camera size={18} /> : <Tv size={18} />}
            </button>

            {/* Toggle Audio Mute */}
            <button
              type="button"
              className="hud-btn"
              onClick={handleToggleMute}
              title={isMuted ? 'Unmute SFX' : 'Mute SFX'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Pause Button */}
            <button
              type="button"
              className="hud-btn"
              onClick={handlePauseToggle}
              title="Pause Game"
            >
              <Pause size={18} />
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              className="hud-btn"
              onClick={handleToggleFullscreen}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </header>
      )}


      {/* =========================================================================
          WELCOME / MAIN MENU MODAL
          ========================================================================= */}
      {gameState === 'WELCOME' && (
        <div className="overlay-backdrop">
          <div className="modal-dialog welcome-modal">
            <div className="welcome-header">
              <div className="kanji-subtitle">果物忍者 · 手勢割切</div>
              <h1 className="main-title">FRUIT NINJA AR</h1>
              <p className="tagline">Interactive Real-Time Motion Fruit Slicing Game</p>
            </div>

            {/* Mode Selector */}
            <div className="section-label">Select Battle Mode</div>
            <div className="mode-grid">
              <div
                className={`mode-card ${gameMode === '1P' ? 'selected' : ''}`}
                onClick={() => setGameMode('1P')}
              >
                <div className="mode-icon-wrap">
                  <User size={22} />
                </div>
                <div className="mode-name">1P Solo Survival</div>
                <div className="mode-desc">
                  Classic arcade mode. 3 lives. Slice fruits, avoid bombs, and beat the record!
                </div>
              </div>

              <div
                className={`mode-card ${gameMode === '2P' ? 'selected' : ''}`}
                onClick={() => setGameMode('2P')}
              >
                <div className="mode-icon-wrap">
                  <Users size={22} />
                </div>
                <div className="mode-name">2P Split Duel</div>
                <div className="mode-desc">
                  1v1 Split-screen duel! 30-second rounds. Highest score or last standing wins!
                </div>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div className="section-label">Select Difficulty</div>
            <div className="diff-row">
              <button
                type="button"
                className={`diff-btn ${difficulty === 'Easy' ? 'selected easy' : ''}`}
                onClick={() => setDifficulty('Easy')}
              >
                Easy (5% Bombs)
              </button>
              <button
                type="button"
                className={`diff-btn ${difficulty === 'Medium' ? 'selected medium' : ''}`}
                onClick={() => setDifficulty('Medium')}
              >
                Medium (15% Bombs)
              </button>
              <button
                type="button"
                className={`diff-btn ${difficulty === 'Hard' ? 'selected hard' : ''}`}
                onClick={() => setDifficulty('Hard')}
              >
                Hard (25% Bombs)
              </button>
            </div>

            {/* Hand Tracker Status Banner */}
            <div className="tracking-banner">
              <div className="tracking-banner-icon">
                <Hand size={24} />
              </div>
              <div className="tracking-banner-text">
                <strong>Motion Control Ready:</strong> Raise your hand in front of the camera and slice
                with your index finger! You can also slice with your mouse or touch swipe anytime.
              </div>
            </div>

            {/* Start Button */}
            <button
              type="button"
              className="btn-primary-slash"
              onClick={handleStartGame}
            >
              <Swords size={26} />
              START GAME
            </button>

            {/* Rules Button */}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowHowToPlay(true)}
            >
              <HelpCircle size={16} />
              How to Play & Controls
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAUSE MODAL
          ========================================================================= */}
      {gameState === 'PAUSED' && (
        <div className="overlay-backdrop">
          <div className="modal-dialog pause-dialog">
            <h2 className="pause-title">GAME PAUSED</h2>

            <div className="pause-btn-stack">
              <button
                type="button"
                className="btn-action primary"
                onClick={handlePauseToggle}
              >
                <Play size={18} /> Resume
              </button>
              <button
                type="button"
                className="btn-action secondary"
                onClick={handleRestart}
              >
                <RotateCcw size={18} /> Restart
              </button>
              <button
                type="button"
                className="btn-action secondary"
                onClick={handleReturnToMenu}
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GAME OVER MODAL
          ========================================================================= */}
      {gameState === 'GAME_OVER' && (
        <div className="overlay-backdrop">
          <div className="modal-dialog gameover-dialog">
            <div className="gameover-badge">DOJO RESULTS</div>
            <h2 className="gameover-title">
              {gameMode === '1P' ? 'GAME OVER' : gameOverData.winner}
            </h2>

            {gameMode === '1P' && gameOverData.isNewHighScore && (
              <div className="new-record-alert">
                <Trophy size={20} /> NEW HIGH SCORE RECORD!
              </div>
            )}

            <div className="stats-card-grid">
              {gameMode === '1P' ? (
                <>
                  <div className="stat-item">
                    <div className="stat-num">{gameOverData.score1}</div>
                    <div className="stat-title">Final Score</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-num">{gameOverData.highScore}</div>
                    <div className="stat-title">High Score</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="stat-item">
                    <div className="stat-num" style={{ color: '#38bdf8' }}>
                      {gameOverData.score1}
                    </div>
                    <div className="stat-title">P1 Score ({gameOverData.roundWins1} Wins)</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-num" style={{ color: '#f87171' }}>
                      {gameOverData.score2}
                    </div>
                    <div className="stat-title">P2 Score ({gameOverData.roundWins2} Wins)</div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-action primary"
                onClick={handleRestart}
              >
                <RotateCcw size={18} /> Play Again
              </button>
              <button
                type="button"
                className="btn-action secondary"
                onClick={handleReturnToMenu}
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HOW TO PLAY MODAL
          ========================================================================= */}
      {showHowToPlay && (
        <div className="overlay-backdrop" onClick={() => setShowHowToPlay(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="welcome-header">
              <h2 className="main-title" style={{ fontSize: '32px' }}>HOW TO PLAY</h2>
              <p className="tagline">Master the Blade of Fruit Ninja AR</p>
            </div>

            <div className="rules-grid">
              <div className="rule-box">
                <div className="rule-icon-circle">
                  <Hand size={20} />
                </div>
                <div>
                  <div className="rule-title">Hand Gesture Tracking</div>
                  <div className="rule-desc">
                    Point your index finger towards your webcam. Swipe through the air swiftly to
                    create a cutting blade! (Mouse drag or touch swipe works as well).
                  </div>
                </div>
              </div>

              <div className="rule-box">
                <div className="rule-icon-circle">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="rule-title">Slice Fruits & Build Combos</div>
                  <div className="rule-desc">
                    Slice apples, bananas, watermelons, and pineapples for points. Slice 2 or more
                    fruits in a single rapid swipe to unlock Combo Multipliers!
                  </div>
                </div>
              </div>

              <div className="rule-box">
                <div className="rule-icon-circle">
                  <Flame size={20} />
                </div>
                <div>
                  <div className="rule-title">Avoid Explosive Bombs</div>
                  <div className="rule-desc">
                    Don't slash the black bombs! Hitting a bomb in 1P mode costs 1 life. In 2P mode, it
                    costs you the round!
                  </div>
                </div>
              </div>

              <div className="rule-box">
                <div className="rule-icon-circle">
                  <Users size={20} />
                </div>
                <div>
                  <div className="rule-title">2-Player Dojo Duel</div>
                  <div className="rule-desc">
                    Player 1 guards the left screen, Player 2 guards the right screen. 30-second rounds,
                    best of 3 rounds takes the victory!
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary-slash"
              onClick={() => setShowHowToPlay(false)}
            >
              GOT IT, LET'S SLICE!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
