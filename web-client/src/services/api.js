export const DEFAULT_SETTINGS = {
  apiKey: '',
  serverUrl: '', // empty means current host
  width: 840,
  height: 480,
  fps: 24,
  steps: 2,
  quality: 'auto', // 'auto', '85', '65', '45'
  detectionMode: 'near', // 'near' (face), 'full', 'off'
  outputCodec: 'mjpeg', // 'mjpeg', 'h264'
  inputCodec: 'mjpeg',
  maxTemporalIds: 8,
  freezeKvOnStatic: true,
  staticDiffThresh: 0.5,
  faceScore: 0.35,
  stableFrames: 24,
  seed: 42,
  randomSeed: true,
  smoothPlayback: true,
};

const SETTINGS_KEY = 'joyai_tryon_settings_v1';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (parsed.detectionMode === 'face') parsed.detectionMode = 'near';
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.warn('Failed to load settings from localStorage', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save settings to localStorage', err);
  }
}

export function getWsUrl(settings) {
  const custom = (settings.serverUrl || '').trim();
  let baseWs = '';
  if (custom) {
    baseWs = custom.replace(/^http/, 'ws');
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    baseWs = `${proto}//${window.location.host}`;
  }
  // Ensure starts with ws:// or wss://
  if (!baseWs.startsWith('ws://') && !baseWs.startsWith('wss://')) {
    baseWs = `ws://${baseWs}`;
  }
  const cleanBase = baseWs.replace(/\/+$/, '');
  const apiKey = (settings.apiKey || '').trim();
  return apiKey ? `${cleanBase}/ws?api_key=${encodeURIComponent(apiKey)}` : `${cleanBase}/ws`;
}

export async function checkServerHealth(settings) {
  const custom = (settings.serverUrl || '').trim();
  const base = custom ? custom.replace(/\/+$/, '') : '';
  const url = `${base}/health`;
  const headers = {};
  if (settings.apiKey) {
    headers['X-API-Key'] = settings.apiKey;
  }
  try {
    const t0 = performance.now();
    const res = await fetch(url, { headers, cache: 'no-store' });
    const latency = Math.round(performance.now() - t0);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, data, latency };
  } catch (err) {
    return { ok: false, error: err.message, latency: null };
  }
}

export async function fetchServerRefImages(settings) {
  const custom = (settings.serverUrl || '').trim();
  const base = custom ? custom.replace(/\/+$/, '') : '';
  const url = `${base}/ref-images`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

