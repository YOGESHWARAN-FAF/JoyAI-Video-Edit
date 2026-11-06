import React from 'react';
import { Sparkles, Square, RefreshCw, AlertCircle } from 'lucide-react';

export function ActionControls({
  isStreaming,
  isConnected,
  onStart,
  onStop,
  hasGarment,
  errorMsg
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
