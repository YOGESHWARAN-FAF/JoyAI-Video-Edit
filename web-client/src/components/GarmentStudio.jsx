import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Check, RefreshCw, Layers } from 'lucide-react';

const PRESETS = [
  {
    id: 'leather-jacket',
    name: 'Biker Jacket',
    desc: 'Matte black leather biker jacket with silver metallic zippers',
    prompt: 'Replace the subject jacket with a matte black leather biker jacket with silver metallic zippers, highly detailed realistic leather texture, natural creases and folds, clean fit.',
    icon: '🧥',
    // High quality sample garment preview data URI or placeholder
    gradient: 'from-zinc-900 to-neutral-800'
  },
  {
    id: 'formal-suit',
    name: 'Italian Navy Suit',
    desc: 'Midnight navy tailored blazer with silk lapel and crisp dress shirt',
    prompt: 'Dress the subject in a midnight navy blue tailored Italian slim-fit blazer with crisp white collared dress shirt, luxury wool fabric, elegant formal menswear.',
    icon: '👔',
    gradient: 'from-blue-950 to-slate-900'
  },
  {
    id: 'trench-coat',
    name: 'Wool Trench Coat',
    desc: 'Classic camel beige long wool coat with horn buttons',
    prompt: 'The person is wearing a long luxury camel beige wool trench coat with structured shoulders, horn buttons, premium winter outerwear.',
    icon: '🥼',
    gradient: 'from-amber-950 to-stone-900'
  },
  {
    id: 'streetwear-hoodie',
    name: 'Cyberpunk Hoodie',
    desc: 'Dark oversized hoodie with holographic neon accents',
    prompt: 'Wear an oversized dark charcoal streetwear hoodie with futuristic neon accents, heavy cotton fabric, relaxed modern fit.',
    icon: '👕',
    gradient: 'from-purple-950 to-zinc-900'
  },
  {
    id: 'satin-dress',
    name: 'Emerald Satin Dress',
    desc: 'Elegant emerald green silk evening gown',
    prompt: 'The subject is wearing an elegant emerald green silk satin evening gown with natural fluid fabric drape and gentle luster.',
    icon: '👗',
    gradient: 'from-emerald-950 to-teal-950'
  },
  {
    id: 'white-denim',
    name: 'Vintage Denim',
    desc: 'Washed denim jacket with brass button details',
    prompt: 'The subject wears a classic vintage washed blue denim jacket with brass buttons, durable cotton twill weave, timeless casual style.',
    icon: '🎽',
    gradient: 'from-cyan-950 to-sky-950'
  }
];

export function GarmentStudio({ 
  selectedGarment, 
  onSelectGarment, 
  customPrompt, 
  onChangePrompt 
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [activePresetId, setActivePresetId] = useState('leather-jacket');
  const [showPromptEdit, setShowPromptEdit] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const autoPrompt = `The person is wearing this exact outfit: ${cleanName}, photorealistic fabric textures, seamless fit, naturally conforming to body posture.`;
      
      setActivePresetId(null);
      onSelectGarment({
        base64,
        name: cleanName,
        isCustom: true,
      });
      onChangePrompt(autoPrompt);
    };
    reader.readAsDataURL(file);
  };

  const selectPreset = (preset) => {
    setActivePresetId(preset.id);
    onSelectGarment({
      base64: null, // text-guided or preset
      name: preset.name,
      isCustom: false,
    });
    onChangePrompt(preset.prompt);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Studio Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            1. Garment Studio
          </h2>
        </div>
        <span className="text-[11px] text-slate-400">
          Drop any outfit or pick preset
        </span>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[170px] ${
          isDragging 
            ? 'border-brand-400 bg-brand-500/15 scale-[1.01]' 
            : selectedGarment?.base64
            ? 'border-brand-500/50 bg-surface-800/80 hover:border-brand-400'
            : 'border-white/10 bg-surface-800/40 hover:border-brand-500/40 hover:bg-surface-800/70'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInput} 
          accept="image/*" 
          className="hidden" 
        />

        {selectedGarment?.base64 ? (
          <div className="flex items-center gap-4 w-full">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 relative group">
              <img 
                src={selectedGarment.base64} 
                alt="Selected garment" 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white transition">
                Replace
              </div>
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Custom Garment Loaded</span>
              </div>
              <p className="text-sm font-bold text-white truncate mt-0.5">
                {selectedGarment.name}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Drag a new image or click to change outfit
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-500/20 to-indigo-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-2.5">
              <Upload className="w-6 h-6 animate-bounce" />
            </div>
            <div className="text-xs font-semibold text-white">
              Drag & Drop Garment Photo
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              PNG, JPG, or WebP (tops, coats, outfits)
            </p>
          </>
        )}
      </div>

      {/* Wardrobe Presets */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-300">Curated Wardrobe Presets</span>
          <span className="text-[10px] text-slate-500">Instant One-Click Try-On</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id && !selectedGarment?.isCustom;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset)}
                className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500/15 shadow-md shadow-brand-500/10'
                    : 'border-white/5 bg-surface-800 hover:border-white/20 hover:bg-surface-700/60'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xl">{preset.icon}</span>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-brand-300 transition">
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                    {preset.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-Prompt Preview & Fine-Tune */}
      <div className="rounded-xl p-3 bg-surface-800/60 border border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-300">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>AI Fitting Prompt</span>
          </div>
          <button
            onClick={() => setShowPromptEdit(!showPromptEdit)}
            className="text-[10px] text-slate-400 hover:text-white underline transition"
          >
            {showPromptEdit ? 'Hide Prompt' : 'Edit Prompt'}
          </button>
        </div>

        {showPromptEdit ? (
          <textarea
            value={customPrompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            rows={2}
            className="w-full p-2 rounded-lg bg-surface-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition font-mono"
            placeholder="Custom try-on prompt..."
          />
        ) : (
          <p className="text-[11px] text-slate-300 line-clamp-2 italic font-sans leading-relaxed">
            "{customPrompt}"
          </p>
        )}
      </div>
    </div>
  );
}

