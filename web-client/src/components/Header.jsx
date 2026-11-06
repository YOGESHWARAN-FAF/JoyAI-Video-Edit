import React from 'react';
import { Sparkles, Settings as SettingsIcon, Wifi, WifiOff, Activity } from 'lucide-react';

export function Header({ isConnected, isStreaming, actualFps, onOpenSettings }) {
  return (
    <header className="w-full border-b border-white/10 glass sticky top-0 z-40 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg text-white font-sans">
                TRYON <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">ANYWHERE</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20">
                Decart Realtime
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Interactive Video-to-Video Virtual Garment Mirror
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Connection status badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-white/5 text-xs">
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-400 font-medium hidden sm:inline">Engine Live</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-slate-400 font-medium hidden sm:inline">Ready</span>
              </>
            )}

            {isStreaming && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-white/10 text-brand-300 font-mono text-[11px]">
                <Activity className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
                <span>{actualFps} FPS</span>
              </div>
            )}
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-700 active:scale-95 text-slate-200 hover:text-white border border-white/10 hover:border-brand-500/40 transition-all text-xs font-medium shadow-sm group"
            title="Configure System & Quality Settings"
          >
            <SettingsIcon className="w-4 h-4 text-slate-400 group-hover:text-brand-400 group-hover:rotate-45 transition-transform" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}

