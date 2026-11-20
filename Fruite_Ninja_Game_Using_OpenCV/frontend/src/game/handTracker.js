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
        locateFile: (file) => `/vendor/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });

      this.hands.onResults((results) => {
        if (!this.stopped && this.onResults) {
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
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.stopped) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
      }

      if (this.stopped) return;
      this.isTracking = true;
      this.onStatusChange({ status: 'active', message: 'Hand tracking active' });

      const processLoop = async () => {
        if (!this.isTracking) return;
        if (this.videoElement && this.videoElement.readyState >= 2 && !this.isProcessing) {
          this.isProcessing = true;
          try {
            await this.hands.send({ image: this.videoElement });
          } catch (err) {
            if (!this.stopped) this.onStatusChange({ status: 'error', handsCount: 0, message: 'Hand tracking failed: ' + err.message });
            return;
          }
          this.isProcessing = false;
        }
        requestAnimationFrame(processLoop);
      };

      requestAnimationFrame(processLoop);
    } catch (err) {
      if (!this.stopped) this.onStatusChange({ status: 'camera_denied', message: err.message });
    }
  }

  stop() {
    this.stopped = true;
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
