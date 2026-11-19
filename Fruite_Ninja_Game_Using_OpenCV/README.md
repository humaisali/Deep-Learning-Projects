# 🍉 Fruit Ninja AR — React.js Web Edition

An interactive, high-performance motion-controlled Fruit Ninja game rewritten in **React.js** with **MediaPipe Hand Tracking**, real-time canvas physics, dual display modes, and split-screen 2-player duels.

---

## 🌟 Key Features

### 🥷 1. Motion & Touch Slicing
* **MediaPipe AI Hand Tracking**: Tracks your index finger (`landmark 8`) in real time through your webcam with high accuracy and low latency.
* **Dynamic Blade Aura**: Visual blade trails with outer glow and razor-sharp inner core (`#38bdf8` Cyan for Player 1, `#f87171` Coral for Player 2).
* **Mouse / Touch Fallback**: Slice with your mouse or touchscreen anytime—no camera required to enjoy the full game.
* **Velocity-Based Hitbox**: Slices only register when moving faster than 14 px/frame to prevent resting hand exploits.

### ⚔️ 2. Game Modes
* **1P Solo Survival**:
  * 3 Lives (Hearts) display.
  * Avoid bombs (striking a bomb costs a life).
  * Slice multi-fruit combos (2x, 3x, 4x+) for multiplier score bonuses.
  * High-score tracking stored persistently in `localStorage`.
* **2P Split-Screen Duel**:
  * Side-by-side battle! Player 1 controls the left half, Player 2 controls the right half.
  * 30-second timed rounds.
  * Best of 3 rounds decides the ultimate Dojo Champion.

### 🥋 3. Visual & Audio Dojo Experience
* **Fullscreen Mirrored Camera Feed**:
  * Real-time mirrored webcam feed directly in the background behind the action, giving an immersive augmented reality feel.
  * **Real-Time Hand Feedback**: Glowing neon Katana reticle on landmark 8 (index finger tip) and an ambient 21-point hand skeleton tracking overlay so players always know their hand is locked on.
* **Spatial Web Audio Effects**:
  * High-fidelity fruit splat impacts, bomb explosions, combo chimes, round start fanfares, and game-over jingles.
  * Integrated procedural Web Audio synth fallback if external audio buffers are loading or blocked.
  * One-click Mute / Unmute and Fullscreen controls.

### ⚙️ 4. Difficulty Tiers
* **Easy**: Relaxed spawn rate, 5% bomb frequency—ideal for getting accustomed to hand tracking.
* **Medium**: Classic arcade tempo, 15% bomb frequency.
* **Hard**: Rapid spawn rate, 25% bomb frequency, fast angular trajectories.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v18+ or v20+ recommended.
* **Webcam**: Optional (for MediaPipe hand tracking). Mouse/touch controls are supported out of the box.

### Installation & Launch

1. Navigate to the `frontend` folder:
   ```bash
   cd "Fruite_Ninja_Game_Using_OpenCV/frontend"
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```

3. Open your browser at:
   ```
   http://localhost:5173/
   ```
   *(or the port reported by Vite in your terminal)*

4. To build and preview production assets:
   ```bash
   npm run build
   npm run preview -- --port 5174
   ```

---

## 🎮 How to Play & Controls

| Action | Motion Gesture | Mouse / Touch Fallback |
| :--- | :--- | :--- |
| **Slice Fruit** | Raise index finger and swipe across fruit | Click and drag cursor across fruit |
| **Combo Multiplier** | Slice 2 or more fruits in a single swipe | Rapidly drag across 2+ fruits in one motion |
| **Avoid Bombs** | Pull hand away from black bomb trajectories | Release mouse or steer cursor clear of bombs |
| **Pause / Resume** | Click the Pause button in the top HUD | Press Pause button or `Esc` |
| **Switch Background** | Click the Camera / Screen icon in top HUD | Click Camera / Screen icon in top HUD |

---

## 🏗️ Project Architecture

```
Fruite_Ninja_Game_Using_OpenCV/
├── frontend/                     # React.js application
│   ├── public/assets/            # Audio, fonts, fruit graphics, vfx
│   │   ├── audio/                # Splat, bomb, combo, start SFX
│   │   ├── bg/                   # Dojo wood background texture
│   │   ├── fonts/                # Custom ninja.ttf typography
│   │   └── fruits/               # Fruit textures & sliced half-cuts
│   ├── src/
│   │   ├── game/
│   │   │   ├── audio.js          # Web Audio API SoundManager
│   │   │   ├── engine.js         # Core 60 FPS Canvas GameEngine
│   │   │   ├── handTracker.js    # MediaPipe Hands lifecycle wrapper
│   │   │   └── objects.js        # Blade, Fruit, SlicedFruit, Bomb, Splash
│   │   ├── App.jsx               # React Game UI, HUD, Modals, State Machine
│   │   ├── App.css               # Dojo aesthetic, glassmorphic HUD, animations
│   │   ├── index.css             # Viewport resets & ninja typography
│   │   └── main.jsx              # Application entrypoint
│   ├── index.html                # MediaPipe CDN and Google Fonts
│   ├── package.json              # React 19, Vite, Lucide-react
│   └── vite.config.js            # Vite bundler configuration
├── index.html                    # Legacy HTML5 interface (preserved)
├── style.css                     # Legacy CSS (preserved)
├── js/                           # Legacy vanilla JS game logic (preserved)
└── README.md                     # Documentation
```

---

## 🏆 Slicing Physics & Collision Algorithm

Fruit collisions use high-speed **point-to-line-segment distance projection**:
$$\text{dist}(P, \overline{AB}) = \left\| P - \left( A + t \cdot (B - A) \right) \right\|$$
where $t = \text{clamp}\left(\frac{(P - A) \cdot (B - A)}{\|B - A\|^2}, 0, 1\right)$.

This ensures that even during ultra-fast swipes where a finger jumps 50–100 pixels in a single 60 FPS frame, the line segment connecting consecutive finger positions will reliably cut fruits cleanly without missing.

---

## 📜 Credits
* Hand Tracking: [Google MediaPipe](https://developers.google.com/mediapipe)
* Audio & Physics: Web Audio API & HTML5 Canvas
* Icons: [Lucide React](https://lucide.dev/)
