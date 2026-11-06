import React from 'react';
import { Sparkles, Square, RefreshCw, AlertCircle, Zap } from 'lucide-react';

export function ActionControls({
  isStreaming,
  isConnected,
  onStart,
  onStop,
  hasGarment,
  errorMsg,
  settings,
  onUpdateSettings
}) {
  return (
    <div className="w-full flex flex-col items-center justify-center space-y-3 pt-2">
      {/* Error alert if any */}
      {errorMsg && (
        <div className="w-full max-w-xl flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="flex-1 font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Mode Selector Pill */}
      {!isStreaming && onUpdateSettings && (
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-800 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, fps: 24, steps: 1, detectionMode: 'off' })}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              Number(settings?.steps) === 1 && Number(settings?.fps) === 24
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>⚡ 24 FPS Realtime (1 Step)</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, fps: 16, steps: 2 })}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              Number(settings?.steps) === 2
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>✨ 16 FPS High Detail (2 Steps)</span>
          </button>
        </div>
      )}

      {/* Active Mode Pill while streaming */}
      {isStreaming && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" />
          <span>Active Engine: 24 FPS Realtime DiT (1-Step, Fast-Accum FP8)</span>
        </div>
      )}

      {/* Main Action Buttons */}
      <div className="flex items-center gap-4 w-full max-w-md">
        {!isStreaming ? (
          <button
            onClick={onStart}
            disabled={!hasGarment}
            className={`w-full py-4 px-8 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 shadow-xl select-none ${
              hasGarment
                ? 'bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-600 bg-[length:200%_auto] hover:bg-right text-white shadow-brand-500/30 hover:shadow-brand-500/50 hover:scale-[1.02] active:scale-95 animate-pulse-glow cursor-pointer'
                : 'bg-surface-800 text-slate-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-5 h-5 text-brand-300 animate-pulse" />
            <span>WEAR OUTFIT (REAL-TIME)</span>
          </button>
        ) : (
          <button
            onClick={onStop}
            className="w-full py-4 px-8 rounded-2xl font-bold text-sm tracking-wide bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>STOP TRY-ON MIRROR</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Powered by JoyAI DiT & NVIDIA L40S Triton FP8 Engine (24 FPS Streaming)
      </p>
    </div>
  );
}

