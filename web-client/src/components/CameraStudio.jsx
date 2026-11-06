import React, { useEffect, useState } from 'react';
import { Camera, CameraOff, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';

export function CameraStudio({ 
  videoRef, 
  faceGateStatus, 
  gateReason, 
  isStreaming 
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    initCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const initCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 840 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError(err.message || 'Camera access denied or unavailable');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  // Compute Decart-style status badges
  const getBadgeInfo = () => {
    if (!cameraActive) {
      return { text: 'Camera Disabled', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle };
    }
    if (faceGateStatus === 'passed') {
      return { text: 'Pose Locked & Streaming', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: UserCheck };
    }
    if (faceGateStatus === 'settling') {
      return { text: 'Hold Still... Stabilizing Pose', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 animate-pulse', icon: RefreshCw };
    }
    if (faceGateStatus === 'off_center') {
      return { text: 'Move Face to Frame Center', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: AlertCircle };
    }
    if (faceGateStatus === 'no_face') {
      return { text: 'Face Not Detected - Look At Camera', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30', icon: AlertCircle };
    }
    return { text: 'Stance Ready: Face Visible', color: 'bg-brand-500/15 text-brand-300 border-brand-500/30', icon: UserCheck };
  };

  const badge = getBadgeInfo();
  const BadgeIcon = badge.icon;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-xl aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center group">
      {/* Underlying Webcam Stream */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="w-full h-full object-cover transform -scale-x-100"
      />

      {/* Fallback when camera is disabled */}
      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-surface-900/90 z-20">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
            <CameraOff className="w-7 h-7 text-rose-400" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Webcam Inactive</h3>
          <p className="text-xs text-slate-400 max-w-xs mb-4">
            {cameraError ? cameraError : 'Please allow camera access in your browser to start the virtual try-on mirror.'}
          </p>
          <button
            onClick={initCamera}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 transition active:scale-95"
          >
            Enable Camera
          </button>
        </div>
      )}

      {/* Decart-Style Silhouette HUD Framing Guide */}
      {cameraActive && !isStreaming && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          {/* Outer focus bounds */}
          <div className="w-[72%] h-[82%] border-2 border-brand-400/30 rounded-3xl relative flex items-center justify-center">
            {/* Corner reticles */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-brand-400" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-brand-400" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-brand-400" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-brand-400" />

            {/* Upper body / Face oval silhouette */}
            <div className="w-36 h-48 border border-dashed border-brand-300/40 rounded-[50%] mt-[-40px] flex items-center justify-center">
              <span className="text-[10px] font-mono tracking-wider text-brand-300/60 uppercase">
                Align Face
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Live Pose Guidance Pill */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md shadow-lg ${badge.color}`}>
          <BadgeIcon className="w-3.5 h-3.5" />
          <span>{badge.text}</span>
        </div>
      </div>

      {/* Top right camera label */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono text-slate-300 backdrop-blur-md">
        <Camera className="w-3.5 h-3.5 text-brand-400" />
        <span>Live Input</span>
      </div>
    </div>
  );
}

