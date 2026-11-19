// MediaPipe Hand Tracker Wrapper for Fruit Slice AR

export class HandTracker {
  constructor({ onResults, onStatusChange }) {
    this.onResults = onResults;
    this.onStatusChange = onStatusChange;
    this.videoElement = null;
    this.hands = null;
    this.stream = null;
    this.isTracking = false;
    this.isProcessing = false;
  }

  async init(videoElement) {
    this.videoElement = videoElement;
    if (!window.Hands) {
      this.onStatusChange({ status: 'error', message: 'MediaPipe library not loaded' });
      return;
    }

    try {
      this.hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });

      this.hands.onResults((results) => {
        if (this.onResults) {
          this.onResults(results);
        }
      });

      await this.startCamera();
    } catch (err) {
      this.onStatusChange({ status: 'error', message: err.message });
    }
  }

  async startCamera() {
    try {
      this.onStatusChange({ status: 'starting', message: 'Requesting camera...' });
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
      }

      this.isTracking = true;
      this.onStatusChange({ status: 'active', message: 'Hand tracking active' });

      const processLoop = async () => {
        if (!this.isTracking) return;
        if (this.videoElement && this.videoElement.readyState >= 2 && !this.isProcessing) {
          this.isProcessing = true;
          try {
            await this.hands.send({ image: this.videoElement });
          } catch {
            // Frame processing catch
          }
          this.isProcessing = false;
        }
        requestAnimationFrame(processLoop);
      };

      requestAnimationFrame(processLoop);
    } catch (err) {
      this.onStatusChange({ status: 'camera_denied', message: err.message });
    }
  }

  stop() {
    this.isTracking = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.onStatusChange({ status: 'idle', message: 'Camera stopped' });
  }
}
