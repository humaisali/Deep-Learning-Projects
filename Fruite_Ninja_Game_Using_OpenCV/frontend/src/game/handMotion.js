// Project the mirrored camera using the same centered cover crop as the video.
export function projectHand(points, width, height, videoWidth, videoHeight) {
  const scale = Math.max(width / videoWidth, height / videoHeight);
  return points.map(({ x, y }) => ({
    x: width / 2 + (0.5 - x) * videoWidth * scale,
    y: height / 2 + (y - 0.5) * videoHeight * scale
  }));
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const median = (a, b, c) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));

export class HandMotion {
  reset() {
    this.points = null;
    this.samples = [];
  }

  update(candidates, blade, now, size) {
    if (!candidates.length || now - this.time > 200) {
      this.reset();
      blade.history.length = 0;
      blade.velocity = 0;
    }
    if (!candidates.length) return;
    const last = this.points;
    const hand = last ? candidates.reduce((a, b) =>
      distance(a[0], last[0]) <= distance(b[0], last[0]) ? a : b) : candidates[0];
    const dt = now - this.time;
    this.time = now;
    if (!last || distance(last[0], hand[0]) > size * 0.22) {
      this.points = hand;
      this.samples = [hand, hand];
      blade.history.length = 0;
    } else {
      const [a, b] = this.samples;
      this.samples = [b, hand];
      this.points = hand.map((point, i) => {
        const target = { x: median(a[i].x, b[i].x, point.x), y: median(a[i].y, b[i].y, point.y) };
        const d = distance(last[i], target);
        const deadband = Math.max(3, size * 0.006);
        if (d <= deadband) return last[i];
        const response = d > 3 * deadband ? 0.9 : 0.45;
        return { x: last[i].x + response * (target.x - last[i].x),
          y: last[i].y + response * (target.y - last[i].y) };
      });
    }
    const tip = this.points[8];
    blade.update(tip.x, tip.y);
    // Existing collision checks expect displacement per nominal 60 Hz frame.
    blade.velocity *= 1000 / (60 * Math.max(8, dt || 16.7));
  }
}
