/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sliders, 
  Search, 
  Palette, 
  Info, 
  Check, 
  Copy, 
  RefreshCw,
  ChevronRight,
  Wind,
  UploadCloud,
  Loader2
} from "lucide-react";
import { pantoneData, PantoneColor } from "./pantoneData";
import { 
  hsbToRgb, 
  rgbToHex, 
  calculateDistance, 
  hexToRgb,
  rgbToHsb,
  HSB,
  RGB
} from "./colorUtils";

const Slider = ({ 
  label, 
  value, 
  min, 
  max, 
  onChange, 
  unit = "", 
  colorClass = "bg-indigo-500" 
}: { 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  onChange: (val: number) => void; 
  unit?: string;
  colorClass?: string;
}) => (
  <div className="mb-6">
    <div className="flex justify-between items-center mb-2">
      <label className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center gap-2">
        {label}
        <span className="text-xs opacity-50 font-mono">({min}-{max}{unit})</span>
      </label>
      <span className="text-lg font-mono font-bold text-white">{value}{unit}</span>
    </div>
    <div className="relative h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
      <motion.div 
        className={`absolute top-0 left-0 h-full ${colorClass}`}
        initial={{ width: 0 }}
        animate={{ width: `${((value - min) / (max - min)) * 100}%` }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
    </div>
  </div>
);

interface ScoredPantone extends PantoneColor {
  distance: number;
  hsbDist: number;
}

const ColorCard: React.FC<{ 
  color: PantoneColor; 
  distance: number; 
  isSelected: boolean;
  onClick: () => void;
}> = ({ color, distance, isSelected, onClick }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(color.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5, scale: 1.02 }}
      onClick={onClick}
      className={`relative group cursor-pointer p-4 rounded-2xl border transition-all duration-300 ${
        isSelected ? "bg-zinc-800 border-indigo-500/50 shadow-xl shadow-indigo-500/10" : "bg-zinc-900/50 border-white/5 hover:border-white/20"
      }`}
    >
      <div className="flex gap-4 items-center">
        <div 
          className="w-16 h-16 rounded-xl shadow-inner border border-white/10"
          style={{ backgroundColor: color.hex }}
        />
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-white text-lg tracking-tight">{color.code}</h3>
            <button 
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-1">{color.name}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-500/50"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, 100 - distance)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-600 uppercase">Match: {Math.max(0, 100 - Math.round(distance))}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ImageUploader = ({ onColorsExtracted }: { onColorsExtracted: (colors: RGB[]) => void }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    setError(null);
    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      setPreview(reader.result as string);

      try {
        // Use Google Gemini API directly
        const apiKey = import.meta.env.GEMINI_API_KEY;
        console.log("Gemini API Key loaded:", apiKey ? apiKey.substring(0, 10) + "..." : "NOT FOUND");

        if (!apiKey) {
          throw new Error("API key not configured. Please set GEMINI_API_KEY in your environment.");
        }

        // Gemini expects the image as inline data in generateContent
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text:
                        "Analyze this image and extract the 5 most dominant or visually significant colors. " +
                        "Return ONLY a JSON array of objects, where each object has 'r', 'g', and 'b' integer properties " +
                        "representing the RGB values. Example format: [{\"r\":255,\"g\":0,\"b\":0},{\"r\":0,\"g\":255,\"b\":0}]. " +
                        "Do not include any other text or explanation."
                    },
                    {
                      inline_data: {
                        mime_type: file.type,
                        data: base64Data
                      }
                    }
                  ]
                }
              ]
            }),
            signal: AbortSignal.timeout(180000) // 180 second timeout
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.log("Error response:", errorText);
          let errorData: Record<string, unknown> = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {}
          throw new Error((errorData.msg as string) || (errorData.message as string) || `API request failed with status ${response.status}: ${errorText}`);
        }

        // Handle response
        const data = await response.json();
        console.log("Gemini API Response:", JSON.stringify(data, null, 2));

        // Check for API errors in response
        if (data.error) {
          throw new Error(data.error.message || data.error.toString());
        }

        // Gemini text output
        const textContent =
          data.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || "")
            .join(" ")
            .trim() || "";

        console.log("Response content:", textContent);

        let colors = [];
        if (textContent) {
          try {
            colors = JSON.parse(textContent);
          } catch (parseErr) {
            console.error("JSON parse error:", parseErr);
            // Try to extract JSON from response if it's wrapped in markdown or extra text
            const jsonMatch = textContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              try {
                colors = JSON.parse(jsonMatch[0]);
              } catch (e) {
                console.error("Failed to parse extracted JSON:", e);
              }
            }
          }
        }

        if (colors && colors.length > 0) {
          onColorsExtracted(colors);
        } else {
          setError("Could not extract colors from the image. Check console for details.");
        }
      } catch (err) {
        console.error(err);
        // Check for timeout or network errors
        if (err instanceof Error) {
          if (err.name === 'AbortError' || err.message.includes('timeout')) {
            setError("Request timed out. The image may be too large. Please try a smaller image.");
          } else {
            setError(`Failed to analyze image: ${err.message}`);
          }
        } else {
          setError("Failed to analyze image. Please try again.");
        }
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-zinc-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl mb-8">
      <div className="flex items-center gap-3 mb-6">
        <UploadCloud className="text-indigo-400" size={20} />
        <h2 className="text-xl font-bold text-white tracking-tight">AI Color Extraction</h2>
      </div>
      
      <div 
        className="relative border-2 border-dashed border-zinc-700 hover:border-indigo-500/50 rounded-2xl p-8 text-center transition-colors cursor-pointer group overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => document.getElementById('image-upload')?.click()}
      >
        <input 
          id="image-upload" 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
        
        {preview ? (
          <div className="absolute inset-0 w-full h-full">
            <img src={preview} alt="Preview" className="w-full h-full object-cover opacity-30 group-hover:opacity-20 transition-opacity" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                  <p className="text-sm font-medium text-white shadow-black drop-shadow-md">AI is analyzing colors...</p>
                </>
              ) : (
                <>
                  <UploadCloud className="w-8 h-8 text-white mb-2 shadow-black drop-shadow-md" />
                  <p className="text-sm font-medium text-white shadow-black drop-shadow-md">Click or drag to upload another</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <UploadCloud className="w-10 h-10 text-zinc-500 group-hover:text-indigo-400 transition-colors mb-3" />
            <p className="text-sm font-medium text-zinc-300">Drag & drop an image here</p>
            <p className="text-xs text-zinc-500 mt-1">or click to browse</p>
          </div>
        )}
      </div>
      
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
  );
};

function ProStudio() {
  const [hsb, setHsb] = useState<HSB>({ h: 200, s: 70, b: 80 });
  const [range, setRange] = useState(30); // HSB distance range
  const [selectedPantone, setSelectedPantone] = useState<PantoneColor | null>(null);
  const [extractedColors, setExtractedColors] = useState<RGB[]>([]);

  const currentRgb = useMemo(() => hsbToRgb(hsb.h, hsb.s, hsb.b), [hsb]);
  const currentHex = useMemo(() => rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b), [currentRgb]);

  const handleColorsExtracted = (colors: RGB[]) => {
    setExtractedColors(colors);
    if (colors.length > 0) {
      const firstColorHsb = rgbToHsb(colors[0].r, colors[0].g, colors[0].b);
      setHsb(firstColorHsb);
    }
  };

  const matches = useMemo(() => {
    const scored: ScoredPantone[] = pantoneData.map(color => {
      const targetRgb = hexToRgb(color.hex);
      const distance = calculateDistance(currentRgb, targetRgb);
      
      const targetHsb = rgbToHsb(targetRgb.r, targetRgb.g, targetRgb.b);
      const hDiff = Math.abs(hsb.h - targetHsb.h);
      const sDiff = Math.abs(hsb.s - targetHsb.s);
      const bDiff = Math.abs(hsb.b - targetHsb.b);
      const hsbDist = Math.sqrt(hDiff * hDiff + sDiff * sDiff + bDiff * bDiff);

      return { ...color, distance, hsbDist };
    });

    return scored
      .filter(c => c.hsbDist <= range * 2)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  }, [currentRgb, hsb, range]);

  useEffect(() => {
    if (matches.length > 0 && !selectedPantone) {
      setSelectedPantone(matches[0]);
    }
  }, [matches]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Dynamic Background Motion */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 100, 0],
            y: [0, -50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full blur-[120px]"
          style={{ backgroundColor: currentHex }}
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [0, -90, 0],
            x: [0, -100, 0],
            y: [0, 50, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full blur-[120px]"
          style={{ backgroundColor: selectedPantone?.hex || currentHex }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:py-20">
        {/* Header */}
        <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/20">
                <Palette className="text-white" size={24} />
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-indigo-400">Professional Studio</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none text-white">
              PANTONE<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">FINDER</span>
            </h1>
            <div className="mt-6">
              <Link to="/simple" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full text-sm font-medium transition-colors border border-white/10">
                Go to Simple AI Extractor <ChevronRight size={16} />
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-end"
          >
            <div className="text-right mb-4">
              <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Current Selection</p>
              <p className="text-2xl font-mono font-bold text-white">{currentHex.toUpperCase()}</p>
            </div>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-zinc-900 rounded-full border border-white/5 text-xs font-mono text-zinc-400">
                R:{currentRgb.r} G:{currentRgb.g} B:{currentRgb.b}
              </div>
              <div className="px-4 py-2 bg-zinc-900 rounded-full border border-white/5 text-xs font-mono text-zinc-400">
                H:{hsb.h}° S:{hsb.s}% B:{hsb.b}%
              </div>
            </div>
          </motion.div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Controls Section */}
          <div className="lg:col-span-5">
            <ImageUploader onColorsExtracted={handleColorsExtracted} />

            {extractedColors.length > 0 && (
              <div className="bg-zinc-900/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-2xl mb-8">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-4">Extracted Colors</h3>
                <div className="flex gap-3">
                  {extractedColors.map((color, idx) => {
                    const hex = rgbToHex(color.r, color.g, color.b);
                    const colorHsb = rgbToHsb(color.r, color.g, color.b);
                    const isActive = hsb.h === colorHsb.h && hsb.s === colorHsb.s && hsb.b === colorHsb.b;
                    return (
                      <button
                        key={idx}
                        onClick={() => setHsb(colorHsb)}
                        className={`w-12 h-12 rounded-xl shadow-inner border transition-all ${isActive ? 'border-white scale-110' : 'border-white/10 hover:scale-105'}`}
                        style={{ backgroundColor: hex }}
                        title={`R:${color.r} G:${color.g} B:${color.b}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <section className="bg-zinc-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <Sliders className="text-indigo-400" size={20} />
                  <h2 className="text-xl font-bold text-white tracking-tight">HSB Parameters</h2>
                </div>
                <motion.div 
                  animate={{ backgroundColor: currentHex }}
                  className="w-12 h-12 rounded-2xl border border-white/10 shadow-xl"
                  style={{ backgroundColor: currentHex }}
                />
              </div>
              
              <Slider 
                label="Hue" 
                value={hsb.h} 
                min={0} 
                max={360} 
                unit="°"
                onChange={(h) => setHsb({ ...hsb, h })} 
                colorClass="bg-gradient-to-r from-red-500 via-green-500 to-blue-500"
              />
              <Slider 
                label="Saturation" 
                value={hsb.s} 
                min={0} 
                max={100} 
                unit="%"
                onChange={(s) => setHsb({ ...hsb, s })} 
                colorClass="bg-indigo-400"
              />
              <Slider 
                label="Brightness" 
                value={hsb.b} 
                min={0} 
                max={100} 
                unit="%"
                onChange={(b) => setHsb({ ...hsb, b })} 
                colorClass="bg-zinc-100"
              />

              <div className="mt-12 pt-8 border-t border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    Search Range
                    <Info size={14} className="opacity-30" />
                  </label>
                  <span className="text-lg font-mono font-bold text-white">±{range}</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={range}
                  onChange={(e) => setRange(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                />
                <p className="text-[10px] text-zinc-600 mt-3 uppercase tracking-wider">Adjust the HSB proximity threshold for matching</p>
              </div>
            </section>

            {/* Preview Section */}
            <motion.section 
              layout
              className="relative aspect-video rounded-[2.5rem] overflow-hidden shadow-2xl group"
            >
              <div 
                className="absolute inset-0 transition-colors duration-500"
                style={{ backgroundColor: currentHex }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                <div>
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Active Color</p>
                  <h3 className="text-4xl font-black text-white tracking-tighter">VIBRANT SOURCE</h3>
                </div>
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center"
                >
                  <RefreshCw className="text-white/40" size={20} />
                </motion.div>
              </div>
            </motion.section>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Search className="text-indigo-400" size={20} />
                <h2 className="text-xl font-bold text-white tracking-tight">Recommended Pantone</h2>
              </div>
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-500/20">
                {matches.length} Matches Found
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {matches.map((match) => (
                  <ColorCard 
                    key={match.code} 
                    color={match as PantoneColor} 
                    distance={match.distance}
                    isSelected={selectedPantone?.code === match.code}
                    onClick={() => setSelectedPantone(match)}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Selected Detail */}
            <AnimatePresence mode="wait">
              {selectedPantone && (
                <motion.div
                  key={selectedPantone.code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-12 p-10 rounded-[3rem] bg-gradient-to-br from-zinc-900 to-black border border-white/5 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -mr-32 -mt-32" />
                  
                  <div className="flex flex-col md:flex-row gap-12 items-center relative z-10">
                    <div className="relative">
                      <motion.div 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="w-48 h-64 rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-white/10"
                        style={{ backgroundColor: selectedPantone.hex }}
                      >
                        <div className="absolute bottom-0 left-0 right-0 bg-white p-4">
                          <p className="text-[10px] font-black text-black uppercase tracking-tighter leading-none mb-1">Pantone</p>
                          <p className="text-xl font-black text-black tracking-tighter leading-none">{selectedPantone.code}</p>
                        </div>
                      </motion.div>
                      <div className="absolute -inset-4 bg-white/5 blur-2xl rounded-full -z-10" />
                    </div>

                    <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
                        <Wind className="text-indigo-400" size={16} />
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Color Insight</span>
                      </div>
                      <h2 className="text-4xl font-black text-white tracking-tighter mb-4 uppercase">{selectedPantone.name}</h2>
                      <p className="text-zinc-400 text-sm leading-relaxed max-w-md mb-8">
                        This color belongs to the <span className="text-white font-bold">{selectedPantone.category}</span> collection. 
                        It exhibits a high degree of visual harmony with your selected HSB values, making it an ideal choice for fashion and digital design.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Hex Code</p>
                          <p className="text-lg font-mono font-bold text-white">{selectedPantone.hex.toUpperCase()}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">RGB Value</p>
                          <p className="text-lg font-mono font-bold text-white">{selectedPantone.rgb.replace('rgb(', '').replace(')', '')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Footer Decoration */}
        <footer className="mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            <span className="text-xs font-bold uppercase tracking-[0.4em]">Vogue</span>
            <span className="text-xs font-bold uppercase tracking-[0.4em]">Design</span>
            <span className="text-xs font-bold uppercase tracking-[0.4em]">Studio</span>
          </div>
          <p className="text-zinc-600 text-[10px] font-medium uppercase tracking-widest">
            &copy; 2026 Pantone Finder Studio &bull; Precision Color Matching
          </p>
        </footer>
      </div>
    </div>
  );
}

function SimpleExtractor() {
  const [extractedColors, setExtractedColors] = useState<RGB[]>([]);
  const [selectedColor, setSelectedColor] = useState<RGB | null>(null);

  const handleColorsExtracted = (colors: RGB[]) => {
    setExtractedColors(colors);
    if (colors.length > 0) {
      setSelectedColor(colors[0]);
    }
  };

  const matches = useMemo(() => {
    if (!selectedColor) return [];
    const currentRgb = selectedColor;
    const currentHsb = rgbToHsb(currentRgb.r, currentRgb.g, currentRgb.b);
    
    const scored = pantoneData.map(color => {
      const targetRgb = hexToRgb(color.hex);
      const distance = calculateDistance(currentRgb, targetRgb);
      
      const targetHsb = rgbToHsb(targetRgb.r, targetRgb.g, targetRgb.b);
      const hDiff = Math.abs(currentHsb.h - targetHsb.h);
      const sDiff = Math.abs(currentHsb.s - targetHsb.s);
      const bDiff = Math.abs(currentHsb.b - targetHsb.b);
      const hsbDist = Math.sqrt(hDiff * hDiff + sDiff * sDiff + bDiff * bDiff);

      return { ...color, distance, hsbDist };
    });

    return scored
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  }, [selectedColor]);

  const currentHex = selectedColor ? rgbToHex(selectedColor.r, selectedColor.g, selectedColor.b) : "#0a0a0a";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <motion.div 
          animate={{ backgroundColor: currentHex }}
          transition={{ duration: 1 }}
          className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] rounded-full blur-[120px]"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 lg:py-20">
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white mb-2">
              AI COLOR <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">MATCH</span>
            </h1>
            <p className="text-zinc-400">Upload an image to instantly find its Pantone matches.</p>
          </div>
          <Link to="/" className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full text-sm font-medium transition-colors flex items-center gap-2 border border-white/10">
            Pro Studio <ChevronRight size={16} />
          </Link>
        </header>

        <ImageUploader onColorsExtracted={handleColorsExtracted} />

        {extractedColors.length > 0 && (
          <div className="space-y-12">
            <div className="bg-zinc-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-6 text-center">Extracted Colors</h3>
              <div className="flex flex-wrap gap-4 justify-center">
                {extractedColors.map((color, idx) => {
                  const hex = rgbToHex(color.r, color.g, color.b);
                  const isSelected = selectedColor === color;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedColor(color)}
                      className={`w-16 h-16 rounded-2xl shadow-xl transition-all duration-300 ${isSelected ? 'scale-110 ring-4 ring-white ring-offset-4 ring-offset-[#0a0a0a]' : 'hover:scale-105 opacity-80 hover:opacity-100 border border-white/10'}`}
                      style={{ backgroundColor: hex }}
                      title={`R:${color.r} G:${color.g} B:${color.b}`}
                    />
                  );
                })}
              </div>
            </div>

            {selectedColor && (
              <div>
                <h2 className="text-2xl font-bold mb-8 text-center tracking-tight">Closest Pantone Matches</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <AnimatePresence>
                    {matches.map((match, idx) => (
                      <ColorCard 
                        key={match.code + idx} 
                        color={match} 
                        distance={match.distance} 
                        isSelected={idx === 0}
                        onClick={() => {}}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProStudio />} />
        <Route path="/simple" element={<SimpleExtractor />} />
      </Routes>
    </BrowserRouter>
  );
}
