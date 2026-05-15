import React, { useState } from 'react';
import { 
  Palette, 
  Sparkles, 
  Download, 
  Share2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Maximize2,
  Image as LuImage,
  ChevronRight,
  Frame,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../lib/i18n';
import { GoogleGenAI } from "@google/genai";

import { Settings } from '../types';

interface ImageLogMetadata {
  model: string;
  timestamp: string;
  status: string;
}

export default function ImageStudio({ lang, settings }: { lang: Language, settings: Settings }) {
  const t = translations[lang];
  const userApiKey = settings.apiKey;
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Please provide a description of the image.");
      return;
    }

    if (!userApiKey) {
      setError(t.image_studio.error_key);
      return;
    }

    setError(null);
    setIsGenerating(true);
    setImageUrl(null);
    setIsSuccess(false);

    const modelIds = [
      "imagen-3.0-generate-001",
      "image-generation-006",
      "imagen-3"
    ];

    let lastError: any = null;

    for (const modelId of modelIds) {
      try {
        console.log(`[Khittara] Attempting generation with model: ${modelId}`);
        
        const ai = new GoogleGenAI({ apiKey: settings.apiKey });
        
        const result = await ai.models.generateImages({
          model: modelId,
          prompt: prompt,
          config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio === '1:1' ? '1:1' : aspectRatio === '16:9' ? '16:9' : '9:16',
          }
        });

        const generatedImage = result.generatedImages[0];
        if (!generatedImage) throw new Error(`No image returned from ${modelId}`);

        const base64Data = generatedImage.image.imageBytes;
        const dataUrl = `data:image/png;base64,${base64Data}`;
        
        setImageUrl(dataUrl);
        setIsSuccess(true);

        const metadata: ImageLogMetadata = {
          model: modelId,
          timestamp: new Date().toISOString(),
          status: 'success'
        };

        await fetch('/api/image/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: prompt, 
            aspectRatio,
            metadata 
          })
        });

        await fetch('/api/usage/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'image' })
        });

        setIsGenerating(false);
        return; // EXIT SUCCESS

      } catch (err: any) {
        console.error(`[Khittara] Failed with ${modelId}:`, err);
        lastError = err;
        // Continue to next model in loop
      }
    }

    // IF ALL IMAGEN ATTEMPTS FAIL
    console.error('[Khittara] All Imagen attempts failed. Final Error Object:', lastError);
    
    // Final UI Error Message
    setError(`Attempting to connect to Imagen 3. Please ensure Vertex AI is enabled in your Google Cloud Console. Raw details: ${lastError?.message || "Unknown error"}`);
    setIsGenerating(false);
  };

  const handleRefresh = () => {
    setError(null);
    setIsSuccess(false);
    setImageUrl(null);
    setPrompt('');
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `Khittara_Art_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (!imageUrl) return;
    try {
      if (navigator.share) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'khittara_art.png', { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Khittara AI Art',
          text: `Check out this AI-generated art: ${prompt}`
        });
      } else {
        await navigator.clipboard.writeText(`Khittara AI Art Prompt: ${prompt}`);
        alert("Prompt copied to clipboard! (Sharing files not supported in this browser)");
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 pb-32">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Palette className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{t.image_studio.title}</h1>
              <p className="text-slate-400">{t.image_studio.subtitle}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Controls */}
          <section className="space-y-8">
            <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative space-y-6">
                <div>
                  <label className="block text-sm font-bold text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t.image_studio.prompt_label}
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t.image_studio.prompt_placeholder}
                    className="w-full h-40 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all text-lg leading-relaxed shadow-inner"
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" />
                    {t.image_studio.aspect_ratio}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: '1:1', label: t.image_studio.square, icon: LuImage },
                      { id: '16:9', label: t.image_studio.landscape, icon: ChevronRight },
                      { id: '9:16', label: t.image_studio.portrait, icon: Maximize2 }
                    ].map((ratio) => (
                      <button
                        key={ratio.id}
                        onClick={() => setAspectRatio(ratio.id as any)}
                        className={`py-4 rounded-xl font-bold transition-all flex flex-col items-center gap-2 border ${
                          aspectRatio === ratio.id 
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-lg' 
                            : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <ratio.icon className={`w-5 h-5 ${aspectRatio === ratio.id ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] uppercase tracking-tighter">{ratio.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateImage}
                  disabled={isGenerating}
                  className={`w-full py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-xl group/btn ${
                    isGenerating 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-violet-700 hover:shadow-indigo-500/30 text-white hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span className="animate-pulse">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Palette className="w-7 h-7 group-hover/btn:rotate-12 transition-transform" />
                      {t.image_studio.generate_btn}
                    </>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-4"
                  >
                    <div className="flex items-start gap-4 text-red-400">
                      <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-medium leading-relaxed break-words">{error}</p>
                    </div>
                    <button 
                      onClick={handleRefresh}
                      className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-xl transition-all border border-red-500/30 flex items-center justify-center gap-2"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Refresh Connection
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6">
              <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <LuImage className="w-3 h-3" />
                Artistic Guidelines
              </h5>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                  <span className="text-[10px] text-slate-500 block mb-1">Model Engine</span>
                  <span className="text-xs text-white font-bold">Imagen 3 (High Def)</span>
                </div>
                <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                  <span className="text-[10px] text-slate-500 block mb-1">Authenticity</span>
                  <span className="text-xs text-white font-bold">100% Unique Asset</span>
                </div>
              </div>
            </div>
          </section>

          {/* Canvas Section */}
          <section>
            <div className={`relative w-full overflow-hidden rounded-[2.5rem] border-2 ${
              isGenerating ? 'border-indigo-500/30 bg-slate-900/80' : imageUrl ? 'border-slate-700 bg-slate-800 shadow-2xl' : 'border-slate-800 border-dashed bg-slate-900/30'
            } transition-all duration-700`}
            style={{ 
              aspectRatio: aspectRatio === '1:1' ? '1/1' : aspectRatio === '16:9' ? '16/9' : '9/16' 
            }}>
              <AnimatePresence mode="wait">
                {isGenerating && (
                  <motion.div 
                    key="painting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center z-10 backdrop-blur-xl"
                  >
                    <div className="relative mb-8">
                       <motion.div 
                        animate={{ 
                          scale: [1, 1.2, 1],
                          rotate: [0, 180, 360] 
                        }}
                        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                        className="w-32 h-32 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full"
                      />
                      <Palette className="absolute inset-0 m-auto w-12 h-12 text-indigo-400 animate-bounce" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-2xl font-black text-white italic tracking-tight">{t.image_studio.painting}</h3>
                       <div className="flex justify-center gap-1">
                          {[0, 1, 2].map(i => (
                            <motion.div 
                              key={i}
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                              className="w-2 h-2 bg-indigo-500 rounded-full"
                            />
                          ))}
                       </div>
                    </div>
                  </motion.div>
                )}

                {imageUrl && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full w-full group/image relative"
                  >
                    <img 
                      src={imageUrl} 
                      alt="Generated Art" 
                      className="w-full h-full object-cover"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity flex items-end p-8 gap-4">
                       <button
                        onClick={handleDownload}
                        className="flex-1 py-4 bg-white text-slate-900 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-slate-100 transition-all shadow-2xl"
                      >
                        <Download className="w-5 h-5" />
                        {t.image_studio.download}
                      </button>
                      <button
                        onClick={handleShare}
                        className="p-4 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all shadow-2xl"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="absolute top-6 right-6">
                       <div className="px-4 py-2 bg-slate-950/80 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                          <Frame className="w-4 h-4 text-indigo-400" />
                          <span className="text-[10px] font-black text-white tracking-widest uppercase">Verified Art</span>
                       </div>
                    </div>
                  </motion.div>
                )}

                {!isGenerating && !imageUrl && (
                  <motion.div 
                    key="empty"
                    className="h-full w-full flex flex-col items-center justify-center p-12 text-center"
                  >
                    <div className="w-28 h-28 rounded-full bg-slate-900/50 flex items-center justify-center mb-8 border border-slate-800/50 shadow-inner">
                      <LuImage className="w-12 h-12 text-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-slate-500 uppercase tracking-tighter">{t.image_studio.title}</h3>
                      <p className="text-slate-600 max-w-xs mx-auto text-sm leading-relaxed">{t.image_studio.subtitle}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isSuccess && (
               <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mt-8 p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-4 text-indigo-300"
              >
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                   <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold font-mono tracking-tight">{t.image_studio.logs_saved}</p>
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
