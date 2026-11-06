import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SettingsDrawer } from './components/SettingsDrawer';
import { GarmentStudio } from './components/GarmentStudio';
import { CameraStudio } from './components/CameraStudio';
import { MirrorViewport } from './components/MirrorViewport';
import { ActionControls } from './components/ActionControls';
import { useJoyStreaming } from './hooks/useJoyStreaming';
import { loadSettings, saveSettings } from './services/api';

export default function App() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Selected Garment state
  const [selectedGarment, setSelectedGarment] = useState({
    base64: null,
    name: 'Biker Jacket',
    isCustom: false,
  });

  const [customPrompt, setCustomPrompt] = useState(
    'Replace the subject jacket with a matte black leather biker jacket with silver metallic zippers, highly detailed realistic leather texture, natural creases and folds, clean fit.'
  );

  // Streaming Hook
  const {
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
  } = useJoyStreaming(settings);

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleStartWear = () => {
    startStreaming({
      refImageBase64: selectedGarment?.base64 || null,
      prompt: customPrompt,
    });
  };

  return (
    <div className="min-h-screen bg-surface-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Header
        isConnected={isConnected}
        isStreaming={isStreaming}
        actualFps={actualFps}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Responsive Grid: Left Garment Studio, Right Camera & Mirror */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Garment Studio (5 cols on lg) */}
          <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 h-full flex flex-col justify-between">
            <GarmentStudio
              selectedGarment={selectedGarment}
              onSelectGarment={setSelectedGarment}
              customPrompt={customPrompt}
              onChangePrompt={setCustomPrompt}
            />
          </div>

          {/* RIGHT: Live Camera & Try-On Mirror (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Webcam Viewfinder */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">
                  Input Camera & Stance
                </span>
                <CameraStudio
                  videoRef={videoRef}
                  faceGateStatus={faceGateStatus}
                  gateReason={gateReason}
                  isStreaming={isStreaming}
                />
              </div>

              {/* Real-time Try-On Output Mirror */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1 flex items-center justify-between">
                  <span>AI Try-On Mirror</span>
                  {isStreaming && (
                    <span className="text-[10px] text-emerald-400 font-mono tracking-wider">
                      ● LIVE STREAMING
                    </span>
                  )}
                </span>
                <MirrorViewport
                  outputCanvasRef={outputCanvasRef}
                  videoRef={videoRef}
                  isStreaming={isStreaming}
                  statusText={statusText}
                  actualFps={actualFps}
                  selectedGarment={selectedGarment}
                />
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="glass-card rounded-2xl p-4 sm:p-6 mt-2">
              <ActionControls
                isStreaming={isStreaming}
                isConnected={isConnected}
                onStart={handleStartWear}
                onStop={stopStreaming}
                hasGarment={Boolean(selectedGarment?.name || selectedGarment?.base64)}
                errorMsg={errorMsg}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}

