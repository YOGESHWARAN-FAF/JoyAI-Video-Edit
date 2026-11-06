import { useState, useEffect, useRef, useCallback } from 'react';
import { getWsUrl } from '../services/api';

export function useJoyStreaming(settings) {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState('Standby');
  const [faceGateStatus, setFaceGateStatus] = useState('idle'); // 'idle', 'waiting', 'off_center', 'settling', 'passed'
  const [gateReason, setGateReason] = useState('');
  const [latencyMs, setLatencyMs] = useState(0);
  const [actualFps, setActualFps] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // References
  const wsRef = useRef(null);
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const outputCanvasRef = useRef(null);
  const sendIntervalRef = useRef(null);
  const isStreamingRef = useRef(false);
  const fpsTimerRef = useRef(null);
  const currentSessionIdRef = useRef(null);
  const outputQueueRef = useRef([]); // [{ bitmap, tCaptureMs }]
  const playbackTimerRef = useRef(null);

  // Flow control & Telemetry
  const sentFramesRef = useRef(0);
  const backendAckedFramesRef = useRef(0);
  const renderTimestampsRef = useRef([]); // [timestampMs]
  const lastOutputMetaRef = useRef(null);

  // Synchronize state ref
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
    isStreamingRef.current = false;
    setStatusText('Disconnected');
    setFaceGateStatus('idle');
    setGateReason('');
    setActualFps(0);

    if (playbackTimerRef.current) {
      cancelAnimationFrame(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (outputQueueRef.current) {
      while (outputQueueRef.current.length > 0) {
        const item = outputQueueRef.current.shift();
        if (item && item.bitmap) {
          try { item.bitmap.close(); } catch (e) {}
        }
      }
    }

    if (sendIntervalRef.current) {
      if (typeof sendIntervalRef.current === 'object' && sendIntervalRef.current.cancel) {
        sendIntervalRef.current.cancel();
      } else {
        clearInterval(sendIntervalRef.current);
      }
      sendIntervalRef.current = null;
    }
    if (fpsTimerRef.current) {
      clearInterval(fpsTimerRef.current);
      fpsTimerRef.current = null;
    }

    renderTimestampsRef.current = [];
    sentFramesRef.current = 0;
    backendAckedFramesRef.current = 0;

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, 'User stopped streaming');
        }
      } catch (e) {}
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const startStreaming = useCallback(async ({ refImageBase64, prompt }) => {
    setErrorMsg(null);
    stopStreaming();

    if (!videoRef.current || !videoRef.current.srcObject) {
      setErrorMsg('Webcam not ready. Please enable camera first.');
      return false;
    }

    const wsUrl = getWsUrl(settings);
    setStatusText('Connecting to JoyAI Real-Time Engine...');
    setFaceGateStatus(settings.detectionMode === 'off' ? 'passed' : 'waiting');

    const sessionId = 'tryon_' + Math.random().toString(36).substring(2, 10);
    currentSessionIdRef.current = sessionId;
    sentFramesRef.current = 0;
    backendAckedFramesRef.current = 0;
    renderTimestampsRef.current = [];
    outputQueueRef.current = [];
    if (playbackTimerRef.current) {
      cancelAnimationFrame(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    try {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatusText('Configuring Garment Try-On...');

        const seedVal = settings.randomSeed ? Math.floor(Math.random() * 1000000) : Number(settings.seed || 42);

        const startPayload = {
          type: 'start',
          session_id: sessionId,
          prompt: prompt || 'Keep the person and scene temporally consistent while applying the requested garment edit.',
          width: Number(settings.width || 840),
          height: Number(settings.height || 480),
          num_inference_steps: Number(settings.steps || 1), // 1 step = 24+ FPS
          use_pe: false,
          detection_mode: settings.detectionMode || 'off',
          seed: seedVal,
          kv_reset_frames: 0,
          output_quality: settings.quality === 'auto' ? 75 : Number(settings.quality || 65),
          fps: Number(settings.fps || 24),
          output_codec: 'mjpeg',
          input_codec: 'mjpeg',
          max_temporal_ids: Number(settings.maxTemporalIds || 8),
          freeze_kv_on_static: Boolean(settings.freezeKvOnStatic),
          static_diff_thresh: Number(settings.staticDiffThresh || 0.5),
          max_inflight_chunks: 2, // 2 chunks max keeps queue shallow and eliminates delay
        };

        if (refImageBase64) {
          startPayload.ref_image = refImageBase64;
        }

        ws.send(JSON.stringify(startPayload));
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            
            // Flow control: track frame acknowledgments
            if (msg.frames_in != null) {
              backendAckedFramesRef.current = Math.max(backendAckedFramesRef.current, Number(msg.frames_in));
            }
            if (msg.source_seq != null) {
              backendAckedFramesRef.current = Math.max(backendAckedFramesRef.current, Number(msg.source_seq));
            }

            if (msg.type === 'started') {
              setIsStreaming(true);
              isStreamingRef.current = true;
              setStatusText('Live Stream Active');
              beginFrameUplink();
              startFpsMeter();
            } else if (msg.type === 'output_frame') {
              lastOutputMetaRef.current = msg;
              if (msg.source_seq != null) {
                backendAckedFramesRef.current = Math.max(backendAckedFramesRef.current, Number(msg.source_seq));
              }
            } else if (msg.type === 'waiting_face') {
              setFaceGateStatus(msg.reason || 'waiting');
              setGateReason(msg.reason || '');
              if (msg.reason === 'settling') {
                setStatusText('Hold Position: Stabilizing Pose...');
              } else if (msg.reason === 'off_center') {
                setStatusText('Center Your Face In Frame');
              } else if (msg.reason === 'no_face') {
                setStatusText('Face Not Detected - Look At Camera');
              } else {
                setStatusText(`Aligning: ${msg.reason}`);
              }
            } else if (msg.type === 'accepted') {
              if (faceGateStatus !== 'passed') {
                setFaceGateStatus('passed');
                setStatusText('Wear Active: Real-Time Stream Running');
              }
            } else if (msg.type === 'error') {
              setErrorMsg(msg.message || 'Server reported an error');
              setStatusText('Error');
            }
          } catch (e) {
            console.error('Error parsing JSON control message', e);
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Binary video frame received from GPU! Queue into adaptive 24 FPS pacer
          setFaceGateStatus('passed');
          setStatusText('Wear Active: Real-Time Stream Running');

          const meta = lastOutputMetaRef.current;
          const blob = new Blob([event.data], { type: 'image/jpeg' });
          createImageBitmap(blob)
            .then((bitmap) => {
              outputQueueRef.current.push({
                bitmap,
                tCaptureMs: meta?.t_capture_ms || Date.now(),
              });

              // Latency readout
              if (meta && meta.t_capture_ms) {
                const lat = Date.now() - Number(meta.t_capture_ms);
                if (lat > 0 && lat < 10000) setLatencyMs(Math.round(lat));
              }

              ensurePlaybackTimer();
            })
            .catch((err) => {
              console.error('Bitmap decode error', err);
            });
        }
      };

      // Adaptive 24 FPS playback governor (smooths 8-frame chunk bursts into continuous 24 FPS stream)
      function ensurePlaybackTimer() {
        if (playbackTimerRef.current) return;

        const targetFps = Math.max(16, Number(settings.fps || 24));
        const baseIntervalMs = 1000 / targetFps; // ~41.6ms for 24 FPS
        let lastDrawTime = performance.now();

        const tickPlayback = () => {
          if (!isStreamingRef.current) {
            playbackTimerRef.current = null;
            return;
          }

          const q = outputQueueRef.current;
          const now = performance.now();

          if (q.length > 0) {
            // Low-latency backlog pruner:
            // If backlog exceeds 10 frames (~400ms), drop oldest frames to lock mirror to real-time live edge
            if (q.length > 10) {
              while (q.length > 5) {
                const dropped = q.shift();
                if (dropped && dropped.bitmap) {
                  try { dropped.bitmap.close(); } catch (e) {}
                }
              }
            }

            // Adaptive interval: if queue has 4+ frames, accelerate slightly (35ms) to catch up
            const interval = q.length > 3 ? baseIntervalMs * 0.82 : baseIntervalMs;

            if (now - lastDrawTime >= interval) {
              const item = q.shift();
              if (item && item.bitmap) {
                const canvas = outputCanvasRef.current;
                if (canvas) {
                  if (canvas.width !== item.bitmap.width || canvas.height !== item.bitmap.height) {
                    canvas.width = item.bitmap.width;
                    canvas.height = item.bitmap.height;
                  }
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(item.bitmap, 0, 0);
                }
                try { item.bitmap.close(); } catch (e) {}

                lastDrawTime = now;
                renderTimestampsRef.current.push(now);
              }
            }
          }

          playbackTimerRef.current = requestAnimationFrame(tickPlayback);
        };

        playbackTimerRef.current = requestAnimationFrame(tickPlayback);
      }

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setErrorMsg('Connection error to JoyAI server');
      };

      ws.onclose = (e) => {
        setIsConnected(false);
        setIsStreaming(false);
        isStreamingRef.current = false;
        if (e.code === 4401) {
          setErrorMsg('Authentication failed: Invalid API Key. Please check settings.');
        } else if (e.code !== 1000 && !errorMsg) {
          setStatusText('Disconnected');
        }
      };

      // Rolling FPS counter (counts frames rendered in the last 1000ms)
      function startFpsMeter() {
        fpsTimerRef.current = setInterval(() => {
          const now = performance.now();
          renderTimestampsRef.current = renderTimestampsRef.current.filter((t) => now - t <= 1000);
          setActualFps(renderTimestampsRef.current.length);
        }, 500);
      }

      // Zero-jitter adaptive camera uplink with hardware presentation timing
      function beginFrameUplink() {
        if (!captureCanvasRef.current) {
          captureCanvasRef.current = document.createElement('canvas');
        }
        const capCanvas = captureCanvasRef.current;
        capCanvas.width = Number(settings.width || 840);
        capCanvas.height = Number(settings.height || 480);
        const capCtx = capCanvas.getContext('2d', { willReadFrequently: true });

        const targetFps = Math.max(16, Math.min(30, Number(settings.fps || 24)));
        const frameIntervalMs = 1000 / targetFps;
        let inFlightEncodes = 0;
        let lastCaptureTime = 0;
        let animId = null;

        const processTick = () => {
          if (!isStreamingRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }

          const now = performance.now();
          const elapsed = now - lastCaptureTime;

          if (elapsed >= frameIntervalMs) {
            const socketBuffered = wsRef.current.bufferedAmount || 0;
            const pending = Math.max(0, sentFramesRef.current - backendAckedFramesRef.current);

            // Flow control: allow up to 2 concurrent encodes and 32 pending frames
            if (inFlightEncodes < 2 && pending < 32 && socketBuffered < 262144) {
              const video = videoRef.current;
              if (video && video.readyState >= 2) {
                lastCaptureTime = now - (elapsed % frameIntervalMs);
                inFlightEncodes += 1;
                capCtx.drawImage(video, 0, 0, capCanvas.width, capCanvas.height);

                capCanvas.toBlob(
                  (blob) => {
                    inFlightEncodes = Math.max(0, inFlightEncodes - 1);
                    try {
                      if (blob && isStreamingRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        sentFramesRef.current += 1;
                        const seq = sentFramesRef.current;
                        const tCaptureMs = Date.now();

                        wsRef.current.send(
                          JSON.stringify({
                            session_id: currentSessionIdRef.current,
                            type: 'frame_meta',
                            seq,
                            t_capture_ms: tCaptureMs,
                          })
                        );
                        wsRef.current.send(blob);
                      }
                    } catch (e) {
                      console.error('Frame uplink send error:', e);
                    }
                  },
                  'image/jpeg',
                  0.50
                );
              }
            }
          }

          const vid = videoRef.current;
          if (vid && 'requestVideoFrameCallback' in vid) {
            animId = vid.requestVideoFrameCallback(processTick);
          } else {
            animId = requestAnimationFrame(processTick);
          }
        };

        const vid = videoRef.current;
        if (vid && 'requestVideoFrameCallback' in vid) {
          animId = vid.requestVideoFrameCallback(processTick);
        } else {
          animId = requestAnimationFrame(processTick);
        }

        sendIntervalRef.current = {
          cancel: () => {
            const v = videoRef.current;
            if (v && 'cancelVideoFrameCallback' in v && animId != null) {
              try { v.cancelVideoFrameCallback(animId); } catch (e) {}
            } else if (animId != null) {
              cancelAnimationFrame(animId);
            }
          }
        };
      }

      return true;
    } catch (err) {
      setErrorMsg(`Failed to connect: ${err.message}`);
      return false;
    }
  }, [settings, stopStreaming, faceGateStatus, errorMsg]);

  return {
    isConnected,
    isStreaming,
    statusText,
    faceGateStatus,
    gateReason,
    latencyMs,
    actualFps,
    errorMsg,
    videoRef,
    outputCanvasRef,
    startStreaming,
    stopStreaming,
  };
}
