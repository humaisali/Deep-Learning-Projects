import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Upload,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  Check,
  X,
  Sliders,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('webcam'); // 'webcam' | 'upload' | 'demo'
  const [serverStatus, setServerStatus] = useState({
    status: 'connecting',
    model_path: 'best.pt',
    classes: {},
    device: 'cpu'
  });

  // Settings
  const [confidence, setConfidence] = useState(0.35);
  const [iou, setIou] = useState(0.45);
  const [soundAlert, setSoundAlert] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Webcam State
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isProcessingFrame = useRef(false);
  const lastFrameTime = useRef(performance.now());
  const audioContextRef = useRef(null);

  // Results State
  const [annotatedImage, setAnnotatedImage] = useState(null);
  const [detections, setDetections] = useState([]);
  const [summary, setSummary] = useState({
    total_faces: 0,
    mask_count: 0,
    no_mask_count: 0,
    compliance_rate: 100,
    all_compliant: true
  });
  const [inferenceTime, setInferenceTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Audio tone generator
  const playAlertTone = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio autoplay policy
    }
  }, []);

  // Fetch status
  const checkStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setServerStatus({
          status: 'connected',
          model_path: data.model_path || 'best.pt',
          classes: data.classes || {},
          device: data.device || 'cpu'
        });
      } else {
        setServerStatus((prev) => ({ ...prev, status: 'offline' }));
      }
    } catch {
      setServerStatus((prev) => ({ ...prev, status: 'offline' }));
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 12000);
    return () => clearInterval(interval);
  }, []);

  // Camera Management
  const startCamera = async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setIsCameraRunning(true);
        };
      }
    } catch (err) {
      setErrorMsg(`Camera error: ${err.message}. Please allow permissions.`);
      setIsCameraRunning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraRunning(false);
    setFps(0);
    setAnnotatedImage(null);
    setDetections([]);
    setSummary({
      total_faces: 0,
      mask_count: 0,
      no_mask_count: 0,
      compliance_rate: 100,
      all_compliant: true
    });
  };

  useEffect(() => {
    if (activeTab !== 'webcam' && isCameraRunning) {
      stopCamera();
    }
  }, [activeTab]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Real-time Frame Capture
  useEffect(() => {
    let timerId;

    const processFrame = async () => {
      if (!isCameraRunning || !videoRef.current || isProcessingFrame.current) {
        return;
      }
      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0) {
        return;
      }

      isProcessingFrame.current = true;
      try {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

        const response = await fetch('/api/detect-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            confidence: parseFloat(confidence),
            iou: parseFloat(iou)
          })
        });

        if (response.ok) {
          const data = await response.json();
          setDetections(data.detections || []);
          setSummary(data.summary || {});
          setInferenceTime(data.inference_time_ms || 0);
          setAnnotatedImage(data.annotated_image || null);

          const now = performance.now();
          const delta = now - lastFrameTime.current;
          lastFrameTime.current = now;
          if (delta > 0) {
            setFps(Math.round(1000 / delta));
          }

          if (data.summary?.no_mask_count > 0 && soundAlert) {
            playAlertTone();
          }
        }
      } catch {
        // Stream network catch
      } finally {
        isProcessingFrame.current = false;
      }
    };

    if (isCameraRunning && activeTab === 'webcam') {
      timerId = setInterval(processFrame, 90);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isCameraRunning, activeTab, confidence, iou, soundAlert, playAlertTone]);

  // Image Upload
  const handleImageUpload = async (file) => {
    if (!file) return;
    setErrorMsg('');
    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('confidence', confidence);
    formData.append('iou', iou);

    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Inference failed');
      }

      const data = await res.json();
      setDetections(data.detections || []);
      setSummary(data.summary || {});
      setInferenceTime(data.inference_time_ms || 0);
      setAnnotatedImage(data.annotated_image || null);

      if (data.summary?.no_mask_count > 0 && soundAlert) {
        playAlertTone();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Demo Sample
  const handleLoadDemo = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/sample-image');
      const data = await res.json();
      if (data.image) {
        const detectRes = await fetch('/api/detect-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: data.image,
            confidence: parseFloat(confidence),
            iou: parseFloat(iou)
          })
        });
        const detectData = await detectRes.json();
        setDetections(detectData.detections || []);
        setSummary(detectData.summary || {});
        setInferenceTime(detectData.inference_time_ms || 0);
        setAnnotatedImage(detectData.annotated_image || null);
      }
    } catch (err) {
      setErrorMsg('Failed to run demo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadResult = () => {
    if (!annotatedImage) return;
    const link = document.createElement('a');
    link.href = annotatedImage;
    link.download = `mask_detection_${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="app-shell">
      {/* TOP NAVIGATION BAR */}
      <header className="navbar">
        <div className="nav-left">
          <div className="nav-brand">
            <span className="brand-dot"></span>
            <span className="brand-name">MaskVision</span>
            <span className="brand-tag">YOLOv8</span>
          </div>

          {/* MODE SELECTOR (Segmented Control) */}
          <div className="segmented-control">
            <button
              className={`segment-btn ${activeTab === 'webcam' ? 'active' : ''}`}
              onClick={() => setActiveTab('webcam')}
            >
              <Camera size={15} />
              <span>Webcam</span>
            </button>
            <button
              className={`segment-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <Upload size={15} />
              <span>Upload</span>
            </button>
            <button
              className={`segment-btn ${activeTab === 'demo' ? 'active' : ''}`}
              onClick={() => setActiveTab('demo')}
            >
              <Sparkles size={15} />
              <span>Demo</span>
            </button>
          </div>
        </div>

        <div className="nav-right">
          <div className={`status-badge ${serverStatus.status}`}>
            <span className="indicator-dot"></span>
            <span>{serverStatus.status === 'connected' ? serverStatus.model_path : 'Offline'}</span>
          </div>

          <button
            className={`icon-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Toggle Settings"
          >
            <Sliders size={16} />
          </button>
        </div>
      </header>

      {/* COMPACT SETTINGS DRAWER */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-inner">
            <div className="setting-control">
              <div className="setting-label">
                <span>Confidence Threshold</span>
                <strong>{Math.round(confidence * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
              />
            </div>

            <div className="setting-control">
              <div className="setting-label">
                <span>IoU Threshold</span>
                <strong>{Math.round(iou * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.05"
                value={iou}
                onChange={(e) => setIou(parseFloat(e.target.value))}
              />
            </div>

            <div className="setting-control sound-control">
              <span className="setting-title">Audio Chime</span>
              <button
                className={`btn-chime ${soundAlert ? 'active' : ''}`}
                onClick={() => setSoundAlert(!soundAlert)}
              >
                {soundAlert ? <Volume2 size={15} /> : <VolumeX size={15} />}
                <span>{soundAlert ? 'On' : 'Off'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR NOTICE */}
      {errorMsg && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
          <button className="error-close" onClick={() => setErrorMsg('')}>×</button>
        </div>
      )}

      {/* MAIN WORKSPACE - Fits in screen */}
      <main className="main-content">
        {/* LEFT COLUMN: VIEWPORT STAGE */}
        <section className="viewport-stage">
          <div className="viewport-box">
            {/* FLOATING HUD OVERLAY */}
            <div className="viewport-hud">
              <div className="hud-left">
                {summary.total_faces === 0 ? (
                  <span className="hud-pill neutral">
                    <span className="dot"></span>
                    <span>Ready</span>
                  </span>
                ) : summary.all_compliant ? (
                  <span className="hud-pill success">
                    <span className="dot"></span>
                    <span>Compliant (100%)</span>
                  </span>
                ) : (
                  <span className="hud-pill danger">
                    <span className="dot"></span>
                    <span>{summary.no_mask_count} Unmasked</span>
                  </span>
                )}
              </div>

              <div className="hud-right">
                {inferenceTime > 0 && <span className="hud-metric">{inferenceTime}ms</span>}
                {activeTab === 'webcam' && isCameraRunning && (
                  <span className="hud-metric">{fps} FPS</span>
                )}
              </div>
            </div>

            {/* SCREEN VIEWPORT */}
            <div className="viewport-canvas">
              {activeTab === 'webcam' && (
                <>
                  <video ref={videoRef} className="hidden-video" playsInline muted />
                  {isCameraRunning ? (
                    annotatedImage ? (
                      <img src={annotatedImage} alt="Feed" className="feed-image" />
                    ) : (
                      <div className="stage-message">
                        <RefreshCw size={24} className="spin" />
                        <p>Starting vision stream...</p>
                      </div>
                    )
                  ) : (
                    <div className="stage-empty">
                      <div className="empty-icon-wrap">
                        <Camera size={28} />
                      </div>
                      <h3>Webcam Inactive</h3>
                      <p>Start live monitoring to detect mask compliance in real time.</p>
                      <button className="btn-primary mt-2" onClick={startCamera}>
                        <Camera size={16} />
                        <span>Start Camera</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'upload' && (
                <>
                  {annotatedImage ? (
                    <img src={annotatedImage} alt="Uploaded Result" className="feed-image" />
                  ) : (
                    <label className="upload-dropzone">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0])}
                      />
                      <div className="empty-icon-wrap">
                        <Upload size={28} />
                      </div>
                      <h3>Upload Image</h3>
                      <p>Click or drag image file here (PNG, JPG, WEBP)</p>
                    </label>
                  )}
                </>
              )}

              {activeTab === 'demo' && (
                <>
                  {annotatedImage ? (
                    <img src={annotatedImage} alt="Demo Result" className="feed-image" />
                  ) : (
                    <div className="stage-empty">
                      <div className="empty-icon-wrap">
                        <Sparkles size={28} />
                      </div>
                      <h3>Synthetic Test Generator</h3>
                      <p>Test the detection engine with simulated test subjects.</p>
                      <button
                        className="btn-primary mt-2"
                        onClick={handleLoadDemo}
                        disabled={isLoading}
                      >
                        <Sparkles size={16} />
                        <span>{isLoading ? 'Running...' : 'Generate Demo Sample'}</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* TOOLBAR CONTROLS */}
            <div className="stage-toolbar">
              <div className="toolbar-actions">
                {activeTab === 'webcam' && (
                  isCameraRunning ? (
                    <button className="btn-outline danger" onClick={stopCamera}>
                      <CameraOff size={15} />
                      <span>Stop Camera</span>
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={startCamera}>
                      <Camera size={15} />
                      <span>Start Camera</span>
                    </button>
                  )
                )}

                {activeTab === 'upload' && (
                  <>
                    <label className="btn-outline file-trigger">
                      <Upload size={15} />
                      <span>Select New Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0])}
                        hidden
                      />
                    </label>
                    {annotatedImage && (
                      <button className="btn-outline" onClick={downloadResult}>
                        <Download size={15} />
                        <span>Download Result</span>
                      </button>
                    )}
                  </>
                )}

                {activeTab === 'demo' && (
                  <>
                    <button
                      className="btn-primary"
                      onClick={handleLoadDemo}
                      disabled={isLoading}
                    >
                      <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
                      <span>Regenerate Sample</span>
                    </button>
                    {annotatedImage && (
                      <button className="btn-outline" onClick={downloadResult}>
                        <Download size={15} />
                        <span>Download Result</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: TELEMETRY & FEED INSPECTOR */}
        <aside className="telemetry-stage">
          {/* COMPLIANCE KPI SUMMARY */}
          <div className="telemetry-card">
            <div className="card-top">
              <span className="card-title">Compliance Rate</span>
              <span className={`compliance-tag ${summary.all_compliant ? 'green' : 'red'}`}>
                {summary.all_compliant ? 'Safe' : 'Alert'}
              </span>
            </div>

            <div className="compliance-display">
              <span className="compliance-val">{summary.compliance_rate}%</span>
              <div className="compliance-bar-bg">
                <div
                  className={`compliance-bar-fill ${summary.compliance_rate >= 100 ? 'full' : 'low'}`}
                  style={{ width: `${summary.compliance_rate}%` }}
                ></div>
              </div>
            </div>

            {/* QUICK STAT COUNTERS */}
            <div className="stats-inline">
              <div className="stat-slot">
                <span className="slot-num">{summary.total_faces}</span>
                <span className="slot-lbl">Total</span>
              </div>
              <div className="stat-slot">
                <span className="slot-num text-green">{summary.mask_count}</span>
                <span className="slot-lbl">Masked</span>
              </div>
              <div className="stat-slot">
                <span className="slot-num text-red">{summary.no_mask_count}</span>
                <span className="slot-lbl">Unmasked</span>
              </div>
            </div>
          </div>

          {/* DETECTIONS LIST */}
          <div className="telemetry-card feed-card">
            <div className="card-top">
              <span className="card-title">Detection Breakdown</span>
              <span className="count-pill">{detections.length}</span>
            </div>

            <div className="feed-list">
              {detections.length === 0 ? (
                <div className="feed-empty">
                  <span>No detections in frame</span>
                </div>
              ) : (
                detections.map((item, idx) => (
                  <div
                    key={idx}
                    className={`feed-item ${item.status === 'COMPLIANT' ? 'item-mask' : 'item-nomask'}`}
                  >
                    <div className="item-row">
                      <div className="item-lead">
                        <span className={`item-badge ${item.status === 'COMPLIANT' ? 'bg-green' : 'bg-red'}`}>
                          {item.status === 'COMPLIANT' ? <Check size={12} /> : <X size={12} />}
                        </span>
                        <strong>Person #{idx + 1}</strong>
                      </div>
                      <span className={`item-tag ${item.status === 'COMPLIANT' ? 'tag-green' : 'tag-red'}`}>
                        {item.display_name}
                      </span>
                    </div>

                    <div className="item-sub">
                      <span>Conf: {Math.round(item.confidence * 100)}%</span>
                      <code>[{item.box[0]}, {item.box[1]}, {item.box[2]}, {item.box[3]}]</code>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SYSTEM ARCHITECTURE FOOTNOTE */}
          <div className="system-spec">
            <div>
              <span>Model</span>
              <strong>YOLOv8n</strong>
            </div>
            <div>
              <span>Device</span>
              <strong>{serverStatus.device.toUpperCase()}</strong>
            </div>
            <div>
              <span>Resolution</span>
              <strong>640×640</strong>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
