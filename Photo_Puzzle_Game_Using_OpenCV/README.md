# Puzzle Cam

A gesture-controlled photobooth and puzzle game with a React setup interface. Choose a puzzle size, photo count, and filter; frame a shot with your hands; solve each photo puzzle; then decorate and download your strip.

## Run locally

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Allow camera access when prompted. The hand-tracking model and some assets are loaded from external CDNs, so an internet connection is required. Camera access requires localhost or HTTPS.

## How to play

1. Select a 3×3 or 4×4 challenge, a two-, three-, or four-photo strip, and a filter.
2. Select **Let’s play** and allow access to your camera.
3. Make a frame with your hands and hold still for the countdown.
4. Pinch and move pieces to arrange your photo; make a fist when the puzzle is complete.
5. Repeat for the remaining photos, then decorate and download your strip.

The React interface lives in `src/`. The existing game engine and its original screens are preserved in `public/legacy/`, which is loaded in a same-origin iframe. Changes to the original game logic should be made to `public/legacy/app.js`. The original project files are also retained at the project root for reference.

Created and modified by Humais Ali; React interface added for Puzzle Cam.
