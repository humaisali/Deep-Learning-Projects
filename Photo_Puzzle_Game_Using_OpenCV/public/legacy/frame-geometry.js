/** Build a mirrored, canvas-clipped frame from both thumbs and index fingers. */
export function frameFromHands(hands, width, height, padding = 28) {
  if (hands.length !== 2) return null;
  const points = hands.flatMap(hand => [hand[4], hand[8]]);
  if (points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
  const xs = points.map(point => (1 - point.x) * width);
  const ys = points.map(point => point.y * height);
  const left = Math.max(0, Math.min(...xs) - padding);
  const top = Math.max(0, Math.min(...ys) - padding);
  const right = Math.min(width, Math.max(...xs) + padding);
  const bottom = Math.min(height, Math.max(...ys) + padding);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** An open frame needs a visible thumb-to-index gap on both hands. */
export function isOpenFrame(hands) {
  return hands.length === 2 && hands.every(hand => hand[4] && hand[8] &&
    Math.abs(hand[4].y - hand[8].y) >= 0.035);
}

export function framesAreStable(a, b, width, height) {
  const tolerance = Math.min(width, height) * 0.025;
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance &&
    Math.abs((a.x + a.width) - (b.x + b.width)) <= tolerance &&
    Math.abs((a.y + a.height) - (b.y + b.height)) <= tolerance;
}
