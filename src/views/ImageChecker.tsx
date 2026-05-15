import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Send, Trash2, Upload, Sparkles, AlertCircle, CheckCircle2, Loader2, Eye, Table as TableIcon, Zap, Share2, Search, FileDown, ChevronDown, FileText, FileCode, FileSpreadsheet, FileJson, Globe } from 'lucide-react';
import { Settings } from '../types';
import { GeminiService } from '../lib/gemini';
import { translations, TranslationKeys } from '../lib/i18n';
import Markdown from 'react-markdown';

interface DetectedBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label: string;
}

interface ImageCheckerProps {
  settings: Settings;
}

const ImageChecker: React.FC<ImageCheckerProps> = ({ settings }) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeepScan, setIsDeepScan] = useState(false);
  const [isTableMode, setIsTableMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [detectedBoxes, setDetectedBoxes] = useState<DetectedBox[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageDisplayRef = useRef<HTMLImageElement>(null);

  const t = translations[settings.language] as TranslationKeys;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size too large (max 10MB)');
        return;
      }
      setSelectedImage(file);
      setDetectedBoxes([]);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      setError(t.image_checker.select_image_first);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult('');
    setDetectedBoxes([]);
    setSyncSuccess(false);

    try {
      const gemini = new GeminiService(settings);
      
      const generateSystemPrompt = (deep: boolean) => `You are Khittara Vision Core, a high-precision OCR and Vision AI.
      Current Task: Analyze the user's image.
      
      Requirements:
      1. If the user wants a table, format it perfectly in Markdown first, followed by CSV data.
      2. ${deep ? 'DEEP SCAN MODE ENABLED: Spend extra compute cycles on character-level precision. Double-check all technical digits.' : 'Perform standard OCR and semantic extraction.'}
      3. CRITICAL: Identify major text areas or objects and provide their bounding boxes at the END of your response in a hidden JSON block format:
      ---BOXES---
      [
        {"ymin": int, "xmin": int, "ymax": int, "xmax": int, "label": "string"},
        ...
      ]
      ---END_BOXES---
      Use 0-1000 normalized coordinates.
      `;

      let activeSystemPrompt = generateSystemPrompt(isDeepScan);
      if (isTableMode) activeSystemPrompt += "\nTABLE MODE ENABLED: Prioritize structural extraction into Markdown tables.";

      const fullPrompt = `${activeSystemPrompt}\n\nUser Request: ${prompt || 'Analyze this image and extract all useful information.'}`;

      let response = await gemini.analyzeImageAndPrompt(
        selectedImage,
        fullPrompt,
        settings.preferredModel
      );

      // Fallback Logic: If response is empty or suspiciously short, try a raw OCR skip
      if (!response || response.length < 10) {
        console.warn("Primary analysis returned low-quality result. Triggering fallback OCR...");
        response = await gemini.analyzeImageAndPrompt(
          selectedImage,
          "Perform a raw, exhaustive OCR scan of this image. Extract every piece of text visible without any formatting or conversation. Just raw data.",
          settings.preferredModel
        );
      }

      if (!response) {
        throw new Error("Neural link failed to extract data. Please try a clearer image.");
      }

      // Parse boxes
      const boxMatch = response.match(/---BOXES---([\s\S]*?)---END_BOXES---/);
      if (boxMatch && boxMatch[1]) {
        try {
          const boxes = JSON.parse(boxMatch[1].trim());
          setDetectedBoxes(Array.isArray(boxes) ? boxes : []);
          setResult(response.replace(/---BOXES---[\s\S]*?---END_BOXES---/g, '').trim());
        } catch (e) {
          console.error("Failed to parse bounding boxes:", e);
          setResult(response);
        }
      } else {
        setResult(response.trim());
      }
    } catch (err: any) {
      setError(err.message || 'Khittara Vision Link Interrupted');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSyncToBrain = async () => {
    if (!result) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/second-brain/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: result,
          section: isTableMode ? '## ၃။ နည်းပညာဆိုင်ရာ ဗဟုသုတများ (Technical Knowledge)' : undefined
        })
      });
      if (response.ok) {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!result) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const response = await fetch('/api/vision/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: result,
          format,
          filename: `VisionCore_Export_${Date.now()}.${format}`
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VisionCore_Export_${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Export failed');
      }
    } catch (err) {
      console.error("Export failed:", err);
      setError("Export process failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const resetSession = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setPrompt('');
    setResult('');
    setError(null);
    setDetectedBoxes([]);
    setSyncSuccess(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto p-4 sm:p-8"
    >
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center text-gold ring-1 ring-gold/20 relative">
            <Eye size={24} />
            <motion.div 
              className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-black"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {t.image_checker.title}
              <span className="text-[10px] uppercase tracking-widest bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30">
                Vision Core v2.0
              </span>
            </h1>
            <p className="text-zinc-500 text-sm">Advanced Structural Analysis & Neural Syncing</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Upload & Controls */}
        <div className="space-y-6">
          <div className="glass-zinc p-6 rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden">
            {/* Visual scanner line effect */}
            {isAnalyzing && (
              <motion.div 
                className="absolute inset-x-0 h-1 bg-cyan-400 z-20 opacity-50"
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            )}

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleImageSelect({ target: { files: [file] } } as any);
              }}
              className={`relative aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden ${
                imagePreview 
                  ? 'border-cyan-500/50 bg-cyan-500/5' 
                  : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-600 hover:bg-zinc-900/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              
              {imagePreview ? (
                <>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    ref={imageDisplayRef}
                    className="absolute inset-0 w-full h-full object-contain p-2" 
                  />
                  
                  {/* Bounding Box Overlay */}
                  <div className="absolute inset-2 pointer-events-none">
                    <svg viewBox="0 0 1000 1000" className="w-full h-full preserve-3d">
                      {detectedBoxes.map((box, i) => (
                        <motion.rect
                          key={i}
                          initial={{ opacity: 0, pathLength: 0 }}
                          animate={{ opacity: 1, pathLength: 1 }}
                          x={box.xmin}
                          y={box.ymin}
                          width={box.xmax - box.xmin}
                          height={box.ymax - box.ymin}
                          fill="rgba(34, 211, 238, 0.1)"
                          stroke="#22d3ee"
                          strokeWidth="2"
                        />
                      ))}
                    </svg>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetSession();
                      }}
                      className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-600 group-hover:text-cyan-400 transition-colors">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-400">Drop vision feed here</p>
                    <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-tighter">Deep Neural Scan Ready</p>
                  </div>
                </>
              )}
            </div>

            {/* Analysis Options */}
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={() => setIsDeepScan(!isDeepScan)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border transition-all ${
                  isDeepScan 
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                <Zap size={14} className={isDeepScan ? 'animate-pulse' : ''} />
                Deep Scan Mode
              </button>
              <button
                onClick={() => setIsTableMode(!isTableMode)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border transition-all ${
                  isTableMode 
                    ? 'bg-gold/20 border-gold text-gold' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                <TableIcon size={14} />
                Table Analysis
              </button>
            </div>

            <div className="mt-6">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">
                Custom Focus (Optional)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Target specific fields or patterns..."
                className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 resize-none transition-all"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !selectedImage}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all ${
                  isAnalyzing || !selectedImage
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-cyan-500 text-black hover:bg-white hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] shadow-lg'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Analyzing Neural Paths...</span>
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    <span>Initiate Analysis</span>
                  </>
                )}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-[11px] text-red-500"
                >
                  <AlertCircle size={14} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Result & Brain Sync */}
        <div className="space-y-6">
          <div className="glass-zinc flex-1 flex flex-col min-h-[500px] rounded-3xl border border-zinc-800 shadow-xl overflow-hidden relative">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${result ? 'bg-cyan-400' : 'bg-zinc-700'} animate-pulse`} />
                <h3 className="font-bold text-sm text-zinc-300">Analysis Intelligence</h3>
              </div>
              {result && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    <CheckCircle2 size={10} />
                    Precision Check OK
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 p-6 relative overflow-y-auto max-h-[600px] custom-scrollbar">
              <AnimatePresence mode="wait">
                {result ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-2xl"
                  >
                    <Markdown>{result}</Markdown>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 p-8 text-center"
                  >
                    <ImageIcon size={48} className="mb-4 opacity-10" />
                    <p className="text-sm italic font-mono opacity-40 uppercase tracking-widest">Waiting for Vision Data</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center z-10"
                >
                  <div className="relative">
                    <Loader2 size={40} className="text-cyan-500 animate-spin" />
                    <Sparkles size={16} className="absolute -top-1 -right-1 text-gold animate-pulse" />
                  </div>
                  <p className="mt-4 text-xs font-bold text-cyan-400/80 tracking-widest uppercase animate-pulse">
                    Khittara Vision Core Active...
                  </p>
                </motion.div>
              )}
            </div>

            {/* Export & Sync Logic */}
            {result && !isAnalyzing && (
              <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 space-y-3">
                {/* Export Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    className="w-full flex items-center justify-between gap-2 py-3 px-4 rounded-xl font-bold bg-zinc-800 text-white hover:bg-zinc-700 transition-all border border-zinc-700/50"
                  >
                    <div className="flex items-center gap-2">
                      <FileDown size={18} className="text-cyan-400" />
                      <span>Export Analysis As...</span>
                    </div>
                    <ChevronDown size={16} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showExportMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-20"
                      >
                        <div className="p-2 grid grid-cols-2 gap-1 uppercase tracking-tighter text-[10px]">
                          <button onClick={() => handleExport('csv')} className="flex items-center gap-2 p-3 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors">
                            <FileSpreadsheet size={16} className="text-green-500" />
                            CSV Data
                          </button>
                          <button onClick={() => handleExport('xlsx')} className="flex items-center gap-2 p-3 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors">
                            <TableIcon size={16} className="text-emerald-400" />
                            Excel (XLSX)
                          </button>
                          <button onClick={() => handleExport('md')} className="flex items-center gap-2 p-3 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors">
                            <FileCode size={16} className="text-cyan-400" />
                            Markdown
                          </button>
                          <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 p-3 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors">
                            <FileText size={16} className="text-red-400" />
                            PDF Report
                          </button>
                          <button onClick={() => handleExport('html')} className="flex items-center gap-2 p-3 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors">
                            <Globe size={16} className="text-yellow-400" />
                            HTML Table
                          </button>
                          <button onClick={() => handleExport('txt')} className="flex items-center gap-2 p-3 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors">
                            <FileText size={16} className="text-zinc-400" />
                            Plain Text
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleSyncToBrain}
                  disabled={isSyncing}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all relative overflow-hidden ${
                    syncSuccess 
                      ? 'bg-green-500 text-black' 
                      : 'bg-zinc-950 text-gold hover:bg-gold/10 border border-gold/30'
                  }`}
                >
                  {isSyncing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : syncSuccess ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Brain Synced Successfully!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={16} />
                      <span>Sync to Second Brain</span>
                    </>
                  )}
                  
                  {isSyncing && (
                    <motion.div 
                      className="absolute inset-0 bg-white/20"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="p-4 bg-cyan-900/10 border border-cyan-500/20 rounded-2xl">
            <div className="flex gap-3">
              <div className="shrink-0 text-cyan-400 mt-0.5">
                <Zap size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-tighter mb-1">Architecture Note</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Vision Core utilizes deep feature extraction for structural OCR. Tables are parsed through semantic alignment before Markdown conversion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ImageChecker;
