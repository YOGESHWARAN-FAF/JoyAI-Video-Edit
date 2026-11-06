import React, { useState } from 'react';
import { X, Key, Sliders, Eye, Cpu, RotateCcw, Check, Sparkles } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../services/api';

export function SettingsDrawer({ isOpen, onClose, settings, onSaveSettings }) {
  const [activeTab, setActiveTab] = useState('auth');
  const [form, setForm] = useState({ ...settings });
  const [savedBadge, setSavedBadge] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSaveSettings(form);
    setSavedBadge(true);
    setTimeout(() => {
      setSavedBadge(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_SETTINGS });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-xl bg-surface-900 border-l border-white/10 shadow-2xl flex flex-col h-full z-10 transition-transform">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Engine Settings</h2>
              <p className="text-xs text-slate-400">Configure TryOn Anywhere runtime & AI parameters</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-white/5 bg-surface-800/40 px-6 gap-2 text-xs">
          {[
            { id: 'auth', label: 'Auth & Server', icon: Key },
            { id: 'quality', label: 'Quality & Stream', icon: Sliders },
            { id: 'vision', label: 'Vision & Gates', icon: Eye },
            { id: 'dit', label: 'Diffusion & DiT', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition ${
                  active 
                    ? 'border-brand-500 text-brand-400 bg-brand-500/5' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Mode Presets */}
        <div className="px-6 pt-3 pb-2 flex items-center gap-2 border-b border-white/5 bg-surface-900/50">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Presets:</span>
          <button
            type="button"
            onClick={() => {
              setForm((prev) => ({ ...prev, fps: 24, steps: 1, width: 840, height: 480, maxTemporalIds: 8 }));
            }}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1 transition"
          >
            ⚡ 24 FPS (Realtime)
          </button>
          <button
            type="button"
            onClick={() => {
              setForm((prev) => ({ ...prev, fps: 16, steps: 2, width: 840, height: 480, maxTemporalIds: 8 }));
            }}
            className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 text-xs font-semibold flex items-center gap-1 transition"
          >
            ✨ 16 FPS (High Detail)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: AUTH & SERVER */}
          {activeTab === 'auth' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1">
                  API Key (Optional Auth Gating)
                </label>
                <input
                  type="password"
                  value={form.apiKey || ''}
                  onChange={(e) => handleChange('apiKey', e.target.value)}
                  placeholder="Enter your JoyAI API Key..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500 transition font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Stored securely in browser localStorage. Passed via query token to protected WebSocket endpoints.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1">
                  Backend Server Address Override
                </label>
                <input
                  type="text"
                  value={form.serverUrl || ''}
                  onChange={(e) => handleChange('serverUrl', e.target.value)}
                  placeholder="e.g. http://100.117.76.50:8090 (leave empty for auto)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500 transition font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Leave blank to connect directly to the current hosting origin (Tailscale/LAN).
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: QUALITY & STREAM */}
          {activeTab === 'quality' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Resolution Preset
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { w: 840, h: 480, label: '840×480 (Recommended)', desc: 'Fastest real-time responsiveness & lowest latency' },
                    { w: 1248, h: 720, label: '1248×720 (High Res)', desc: 'Sharper fabric texture; requires powerful GPU' }
                  ].map((res) => (
                    <button
                      key={res.label}
                      type="button"
                      onClick={() => {
                        handleChange('width', res.w);
                        handleChange('height', res.h);
                      }}
                      className={`p-3 rounded-xl border text-left transition ${
                        form.width === res.w && form.height === res.h
                          ? 'border-brand-500 bg-brand-500/10 text-white'
                          : 'border-white/10 bg-surface-800 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="font-medium text-xs text-white">{res.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{res.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Camera Stream Framerate
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { rate: 16, label: '16 FPS', hint: '(Stable)' },
                    { rate: 24, label: '24 FPS', hint: '(Fast)' },
                    { rate: 30, label: '30 FPS', hint: '(Max)' },
                  ].map((item) => (
                    <button
                      key={item.rate}
                      type="button"
                      onClick={() => handleChange('fps', item.rate)}
                      className={`py-2 rounded-lg border text-xs font-medium transition ${
                        Number(form.fps) === item.rate
                          ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                          : 'border-white/10 bg-surface-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label} <span className="opacity-75">{item.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Downlink Preview Quality
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'auto', label: 'Auto (Adaptive)' },
                    { id: '85', label: 'High' },
                    { id: '65', label: 'Mid' },
                    { id: '40', label: 'Low' },
                  ].map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleChange('quality', q.id)}
                      className={`py-2 rounded-lg border text-xs font-medium transition ${
                        form.quality === q.id
                          ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                          : 'border-white/10 bg-surface-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Streaming Codec
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'mjpeg', label: 'MJPEG (Lossless Face Detail)', desc: 'Guarantees sharp facial features' },
                    { id: 'h264', label: 'H.264 (Low Bandwidth)', desc: 'Compressed video for mobile connections' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleChange('outputCodec', c.id)}
                      className={`p-3 rounded-xl border text-left transition ${
                        form.outputCodec === c.id
                          ? 'border-brand-500 bg-brand-500/10 text-white'
                          : 'border-white/10 bg-surface-800 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="font-medium text-xs text-white">{c.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{c.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VISION & GATES */}
          {activeTab === 'vision' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Detection & Pose Gate Mode
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'near', title: 'Face Detection Mode (YuNet Near-Field)', desc: 'Monitors face position & centering before editing starts. Best for upper garments & portraits.' },
                    { id: 'full', title: 'Full-Body Detection Mode (YOLOv8)', desc: 'Enforces full torso & garment presence. Best for full-length outfits & dresses.' },
                    { id: 'off', title: 'Gate Disabled (Instant Edit)', desc: 'Starts editing immediately on first frame without waiting for centering.' },
                  ].map((mode) => {
                    const isSelected = form.detectionMode === mode.id || (mode.id === 'near' && form.detectionMode === 'face');
                    return (
                      <label
                        key={mode.id}
                        onClick={() => handleChange('detectionMode', mode.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? 'border-brand-500 bg-brand-500/10 text-white'
                            : 'border-white/10 bg-surface-800 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="radio"
                          name="detectionMode"
                          checked={isSelected}
                          onChange={() => handleChange('detectionMode', mode.id)}
                          className="mt-1 text-brand-600 focus:ring-brand-500"
                        />
                        <div>
                          <div className="font-medium text-xs text-white">{mode.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{mode.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200 uppercase tracking-wider">Face Gate Sensitivity</span>
                  <span className="font-mono text-brand-400">{form.faceScore}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={form.faceScore || 0.35}
                  onChange={(e) => handleChange('faceScore', parseFloat(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Lenient (0.1)</span>
                  <span>Default (0.35)</span>
                  <span>Strict (0.8)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200 uppercase tracking-wider">Pose Stability Frames</span>
                  <span className="font-mono text-brand-400">{form.stableFrames} frames</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="48"
                  step="6"
                  value={form.stableFrames || 24}
                  onChange={(e) => handleChange('stableFrames', parseInt(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Frames of still, centered posture before try-on activates (~24 frames ≈ 1 second).
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: DIFFUSION & DIT */}
          {activeTab === 'dit' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  DiT Inference Steps
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { step: 1, label: '1 Step', sub: '(24 FPS)' },
                    { step: 2, label: '2 Steps', sub: '(16 FPS)' },
                    { step: 3, label: '3 Steps', sub: '(Quality)' },
                    { step: 4, label: '4 Steps', sub: '(Max)' },
                  ].map((item) => (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => handleChange('steps', item.step)}
                      className={`py-2 px-1 rounded-lg border text-center transition ${
                        Number(form.steps) === item.step
                          ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                          : 'border-white/10 bg-surface-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-[10px] opacity-75">{item.sub}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  <span className="text-emerald-400 font-semibold">1 Step:</span> Runs at <span className="text-white font-medium">24–30 FPS stably</span> with minimal latency.
                  <br />
                  <span className="text-indigo-400 font-semibold">2 Steps:</span> Runs at <span className="text-white font-medium">16 FPS</span> with maximum fabric texture detail.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Max Temporal Window (KV Cache Size)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[4, 8, 16].map((mti) => (
                    <button
                      key={mti}
                      type="button"
                      onClick={() => handleChange('maxTemporalIds', mti)}
                      className={`py-2 rounded-lg border text-xs font-medium transition ${
                        Number(form.maxTemporalIds) === mti
                          ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                          : 'border-white/10 bg-surface-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mti} Chunks {mti === 8 ? '(Default)' : ''}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Limits temporal KV cache depth so video remains temporally stable without overflowing VRAM.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-800 border border-white/5 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.freezeKvOnStatic)}
                    onChange={(e) => handleChange('freezeKvOnStatic', e.target.checked)}
                    className="rounded text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-xs font-medium text-slate-200">Freeze KV Cache on Static Frames</span>
                </label>
                <p className="text-[11px] text-slate-400 pl-6">
                  Prevents temporal flickering when you stand still in front of the camera.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form.randomSeed)}
                    onChange={(e) => handleChange('randomSeed', e.target.checked)}
                    className="rounded text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Random Seed Per Session
                  </span>
                </label>
                {!form.randomSeed && (
                  <input
                    type="number"
                    value={form.seed || 42}
                    onChange={(e) => handleChange('seed', parseInt(e.target.value) || 42)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-800 border border-white/10 text-white font-mono text-sm"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-white/10 bg-surface-900/90 flex items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-surface-800 text-xs transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-300 hover:bg-surface-800 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 transition active:scale-95"
            >
              {savedBadge ? <Check className="w-4 h-4 text-emerald-300" /> : <Sparkles className="w-4 h-4" />}
              <span>{savedBadge ? 'Saved!' : 'Apply Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

