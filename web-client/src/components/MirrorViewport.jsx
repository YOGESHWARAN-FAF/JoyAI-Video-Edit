import React, { useState, useRef } from 'react';
import { Sparkles, Camera, Download, Maximize2, Columns, SplitSquareVertical } from 'lucide-react';

export function MirrorViewport({
  outputCanvasRef,
  videoRef,
  isStreaming,
  statusText,
  actualFps,
  selectedGarment
}) {
  const [viewMode, setViewMode] = useState('full'); // 'full', 'split'
  const [splitPos, setSplitPos] = useState(50); // percentage (0 - 100)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const containerRef = useRef(null);

  // Snapshot capture
  const handleSnapshot = () => {
    const canvas = outputCanvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `tryon_anywhere_${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (err) {
      console.error('Failed to take snapshot', err);
    }
  };

  // Split slider mouse events
  const handleMouseDown = () => setIsDraggingSlider(true);
  const handleMouseUp = () => setIsDraggingSlider(false);

  const handleMouseMove = (e) => {
    if (!isDraggingSlider || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSplitPos(Math.round((x / rect.width) * 100));
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="relative rounded-2xl overflow-hidden bg-black/70 border border-white/10 shadow-2xl aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center select-none"
    >
      {/* Real-Time Transformed Output Canvas */}
      <canvas
        ref={outputCanvasRef}
        className={`w-full h-full object-cover transform -scale-x-100 ${
          isStreaming ? 'block' : 'hidden'
        }`}
      />

      {/* Standby / Loading Placeholder */}
      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-surface-800/80 to-surface-900/90 backdrop-blur-sm z-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-500/20 to-indigo-500/30 border border-brand-500/40 flex items-center justify-center text-brand-400 mb-3.5 shadow-xl shadow-brand-500/10 animate-pulse-glow">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            Try-On Mirror Standby
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
            {selectedGarment?.name 
              ? `Garment locked: "${selectedGarment.name}". Click "Wear Outfit" below to begin live video generation.`
              : 'Select or drop a garment in the studio, then click "Wear Outfit" to see real-time results.'}
          </p>
        </div>
      )}

      {/* Split Comparison Slider (when enabled) */}
      {isStreaming && viewMode === 'split' && videoRef.current && (
        <>
          {/* Underlying webcam frame on left side of split */}
          <div 
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ width: `${splitPos}%` }}
          >
            <video
              srcObject={videoRef.current.srcObject}
              autoPlay
              playsInline
              muted
              className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 filter brightness-95"
              style={{
                width: containerRef.current ? containerRef.current.clientWidth : '100%',
                maxWidth: 'none',
              }}
            />
            <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/60 text-[10px] font-mono text-slate-300 backdrop-blur-sm">
              Original
            </div>
          </div>

          {/* Slider divider bar */}
          <div
            onMouseDown={handleMouseDown}
            style={{ left: `${splitPos}%` }}
            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_12px_rgba(255,255,255,0.7)] flex items-center justify-center"
          >
            <div className="w-6 h-6 rounded-full bg-white text-surface-900 flex items-center justify-center shadow-lg text-[10px] font-bold">
              ↔
            </div>
          </div>
        </>
      )}

      {/* Top Left Status Badge */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 text-xs font-semibold backdrop-blur-md text-white shadow-lg">
          <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-brand-400 animate-ping' : 'bg-slate-500'}`} />
          <span>{statusText}</span>
        </div>
      </div>

      {/* Top Right Toolbars (Snapshot, View Modes) */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
        {isStreaming && (
          <>
            <button
              onClick={() => setViewMode(viewMode === 'full' ? 'split' : 'full')}
              className={`p-2 rounded-xl border backdrop-blur-md text-xs transition active:scale-95 ${
                viewMode === 'split'
                  ? 'bg-brand-600 border-brand-400 text-white'
                  : 'bg-black/60 border-white/10 text-slate-300 hover:text-white hover:bg-black/80'
              }`}
              title="Toggle Before / After Split Slider"
            >
              <SplitSquareVertical className="w-4 h-4" />
            </button>

            <button
              onClick={handleSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 hover:border-brand-500/40 text-slate-200 hover:text-white backdrop-blur-md text-xs font-medium transition active:scale-95"
              title="Capture Outfit Snapshot"
            >
              <Camera className="w-3.5 h-3.5 text-brand-400" />
              <span>Snapshot</span>
            </button>
          </>
        )}
      </div>

      {/* Bottom overlay: Garment label & FPS */}
      {isStreaming && (
        <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
          <div className="px-3 py-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md text-[11px] font-medium text-slate-200">
            Outfit: <span className="text-brand-300 font-semibold">{selectedGarment?.name || 'Custom'}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md font-mono text-[11px] text-emerald-400 font-semibold">
            {actualFps} FPS
          </div>
        </div>
      )}
    </div>
  );
}

