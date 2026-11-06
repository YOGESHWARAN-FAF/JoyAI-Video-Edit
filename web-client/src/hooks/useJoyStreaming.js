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

    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
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
          max_inflight_chunks: 3,
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
          // Binary video frame received from GPU! Render immediately for ultra-low latency
          setFaceGateStatus('passed');
          setStatusText('Wear Active: Real-Time Stream Running');

          const blob = new Blob([event.data], { type: 'image/jpeg' });
          createImageBitmap(blob)
            .then((bitmap) => {
              const canvas = outputCanvasRef.current;
              if (canvas) {
                if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                  canvas.width = bitmap.width;
                  canvas.height = bitmap.height;
                }
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0);
              }
              bitmap.close();

              // Record render time for rolling FPS
              const now = performance.now();
              renderTimestampsRef.current.push(now);

              // Latency readout
              const meta = lastOutputMetaRef.current;
              if (meta && meta.t_capture_ms) {
                const lat = Date.now() - Number(meta.t_capture_ms);
                if (lat > 0 && lat < 5000) setLatencyMs(Math.round(lat));
              }
            })
            .catch((err) => {
              console.error('Bitmap decode error', err);
            });
        }
      };

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

      // Adaptive camera uplink
      function beginFrameUplink() {
        if (!captureCanvasRef.current) {
          captureCanvasRef.current = document.createElement('canvas');
        }
        const capCanvas = captureCanvasRef.current;
        capCanvas.width = Number(settings.width || 840);
        capCanvas.height = Number(settings.height || 480);
        const capCtx = capCanvas.getContext('2d', { willReadFrequently: true });

        const targetFps = Math.max(12, Number(settings.fps || 24));
        const targetInterval = 1000 / targetFps;
        let tickInFlight = false;

        sendIntervalRef.current = setInterval(() => {
          if (!isStreamingRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }
          if (tickInFlight) return;

          // Flow control guard:
          // Keep chunk pipeline fed without overfilling socket buffer
          const pending = Math.max(0, sentFramesRef.current - backendAckedFramesRef.current);
          const socketBuffered = wsRef.current.bufferedAmount || 0;
          if (pending >= 16 || socketBuffered > 131072) {
            return;
          }

          const video = videoRef.current;
          if (!video || video.readyState < 2) return;

          tickInFlight = true;
          capCtx.drawImage(video, 0, 0, capCanvas.width, capCanvas.height);

          capCanvas.toBlob(
            (blob) => {
              try {
                if (blob && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  sentFramesRef.current += 1;
                  const seq = sentFramesRef.current;
                  const tCaptureMs = Date.now();

                  // 1. Send frame metadata header
                  wsRef.current.send(
                    JSON.stringify({
                      session_id: currentSessionIdRef.current,
                      type: 'frame_meta',
                      seq,
                      t_capture_ms: tCaptureMs,
                    })
                  );

                  // 2. Send JPEG blob directly (55% quality: compresses in < 7ms)
                  wsRef.current.send(blob);
                }
              } catch (e) {
                console.error('Frame uplink send error:', e);
              } finally {
                tickInFlight = false;
              }
            },
            'image/jpeg',
            0.55 // Fast lightweight JPEG encoding
          );
        }, targetInterval);
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
