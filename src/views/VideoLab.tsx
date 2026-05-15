import React, { useState, useRef } from 'react';
import { 
  Video, 
  Upload, 
  Sparkles, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Image as LuImage,
  RefreshCcw,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../lib/i18n';
import { GoogleGenAI, VideoGenerationReferenceType } from "@google/genai";

import { Settings } from '../types';

interface VideoLogMetadata {
  model: string;
  resolution: string;
  aspectRatio: string;
  timestamp: string;
  duration?: string;
}

export default function VideoLab({ lang, settings }: { lang: Language, settings: Settings }) {
  const t = translations[lang];
  const userApiKey = settings.apiKey;
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<{file: File, preview: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedImages.length + files.length > 3) {
      setError(t.video_lab.max_images);
      return;
    }

    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setSelectedImages(prev => [...prev, ...newImages]);
    setError(null);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const generateVideo = async () => {
    if (!prompt.trim() && activeTab === 'text') {
      setError("Please provide a prompt.");
      return;
    }

    if (activeTab === 'image' && selectedImages.length === 0) {
      setError(t.video_lab.error_limit);
      return;
    }

    setError(null);
    setIsGenerating(true);
    setVideoUrl(null);
    setIsSuccess(false);

    let messageIndex = 0;
    const interval = setInterval(() => {
      setProgressMessage(t.video_lab.reassuring_messages[messageIndex % t.video_lab.reassuring_messages.length]);
      messageIndex++;
    }, 5000);

    try {
      const modelName = activeTab === 'image' ? 'veo-3.1-generate-preview' : 'veo-3.1-lite-generate-preview';
      
      const ai = new GoogleGenAI({ apiKey: settings.apiKey });
      
      let operation;

      if (activeTab === 'image') {
        const referenceImagesPayload = [];
        for (const img of selectedImages) {
          const b64 = await fileToBase64(img.file);
          referenceImagesPayload.push({
            image: {
              imageBytes: b64,
              mimeType: img.file.type,
            },
            referenceType: VideoGenerationReferenceType.ASSET,
          });
        }

        operation = await ai.models.generateVideos({
          model: modelName,
          prompt: prompt || 'Animate these images into a cinematic scene',
          config: {
            numberOfVideos: 1,
            referenceImages: referenceImagesPayload,
            resolution: '720p',
            aspectRatio: '16:9'
          }
        });
      } else {
        operation = await ai.models.generateVideos({
          model: modelName,
          prompt: prompt,
          config: {
            numberOfVideos: 1,
            resolution: '1080p',
            aspectRatio: '16:9'
          }
        });
      }

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("No video generated");

      // Fetch video with API Key auth
      const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': settings.apiKey,
        },
      });

      if (!response.ok) throw new Error("Failed to download video");
      
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      setVideoUrl(localUrl);
      setIsSuccess(true);

      // Log metadata
      const metadata: VideoLogMetadata = {
        model: modelName,
        resolution: activeTab === 'image' ? '720p' : '1080p',
        aspectRatio: '16:9',
        timestamp: new Date().toISOString()
      };

      await fetch('/api/video/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt || 'Image-to-Video generation', 
          resultUrl: 'Local IndexedDB/Blob',
          metadata 
        })
      });

      // Update global usage
      await fetch('/api/usage/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'video' })
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during generation.");
    } finally {
      setIsGenerating(false);
      clearInterval(interval);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `Khittara_Video_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!userApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <AlertCircle className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Gemini API Key Required</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Please provide your <span className="text-cyan-400 font-bold">Paid Gemini API Key</span> in the <span className="text-white font-medium italic">Settings</span> menu to unlock the Khittara Video Lab capabilities.
          </p>
          <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-sm text-slate-500">
            Navigation: <span className="text-slate-300">Settings</span> → <span className="text-slate-300 font-bold">API Key</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
              <Video className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{t.video_lab.title}</h1>
              <p className="text-slate-400">{t.video_lab.subtitle}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls Section */}
          <section className="space-y-6">
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl">
              <div className="flex p-1 bg-slate-800 rounded-2xl mb-6">
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'text' ? 'bg-slate-700 text-cyan-400 shadow-md' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {t.video_lab.text_to_video}
                </button>
                <button
                  onClick={() => setActiveTab('image')}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'image' ? 'bg-slate-700 text-cyan-400 shadow-md' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <LuImage className="w-4 h-4" />
                  {t.video_lab.image_to_video}
                </button>
              </div>

              {activeTab === 'image' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-400 mb-3">{t.video_lab.upload_images}</label>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group border border-slate-700">
                        <img src={img.preview} alt="Upload" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {selectedImages.length < 3 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-500/5 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-cyan-400 transition-all group"
                      >
                        <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold font-mono">UPLOAD</span>
                      </button>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    multiple 
                    onChange={handleImageUpload} 
                  />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t.video_lab.prompt_label}</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t.video_lab.prompt_placeholder}
                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none transition-all"
                  />
                </div>

                <button
                  onClick={generateVideo}
                  disabled={isGenerating}
                  className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl ${
                    isGenerating 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-cyan-500/30 text-white hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      {t.video_lab.generating}
                    </>
                  ) : (
                    <>
                      <Video className="w-6 h-6" />
                      {t.video_lab.generate_btn}
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
                    className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Player/Progress Section */}
          <section>
            <div className={`relative aspect-video rounded-3xl border ${isGenerating ? 'border-cyan-500/30 bg-slate-900' : 'border-slate-800 bg-slate-900'} overflow-hidden shadow-2xl`}>
              <AnimatePresence mode="wait">
                {isGenerating && (
                  <motion.div 
                    key="generating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900/80 backdrop-blur-sm z-10"
                  >
                    <div className="relative mb-8">
                      <div className="w-24 h-24 border-4 border-cyan-500/10 rounded-full animate-pulse" />
                      <div className="absolute inset-0 w-24 h-24 border-4 border-t-cyan-500 rounded-full animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-cyan-400 animate-bounce" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{t.video_lab.generating}</h3>
                    <p className="text-cyan-400/80 font-medium h-6">{progressMessage}</p>
                    
                    <div className="mt-8 w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        animate={{ x: [-200, 200] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      />
                    </div>
                  </motion.div>
                )}

                {videoUrl && (
                  <motion.div
                    key="video"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full w-full"
                  >
                    <video 
                      src={videoUrl} 
                      controls 
                      className="w-full h-full object-contain"
                      autoPlay
                      loop
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                       <button
                        onClick={handleDownload}
                        className="p-3 bg-cyan-500 text-slate-900 rounded-xl hover:bg-cyan-400 transition-all shadow-xl flex items-center gap-2 font-bold"
                      >
                        <Download className="w-5 h-5" />
                        {t.video_lab.download}
                      </button>
                    </div>
                  </motion.div>
                )}

                {!isGenerating && !videoUrl && (
                  <motion.div 
                    key="empty"
                    className="h-full w-full flex flex-col items-center justify-center p-12 text-center"
                  >
                    <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-6">
                      <Video className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 mb-2">{t.video_lab.video_player}</h3>
                    <p className="text-slate-600 max-w-xs">{t.video_lab.subtitle}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isSuccess && (
               <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-400"
              >
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-xs font-bold font-mono tracking-tight">{t.video_lab.logs_saved}</p>
              </motion.div>
            )}

            <div className="mt-8 bg-slate-900/50 rounded-3xl border border-slate-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-cyan-400" />
                  Neural Guidelines
                </h4>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ChevronRight className="w-3 h-3 text-cyan-400" />
                  </div>
                  <p className="text-sm text-slate-400"><span className="text-white font-bold">Text-to-Video</span> renders in 1080p high definition via Veo Lite.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ChevronRight className="w-3 h-3 text-cyan-400" />
                  </div>
                  <p className="text-sm text-slate-400"><span className="text-white font-bold">Image-to-Video</span> handles up to 3 reference assets for identity consistency.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ChevronRight className="w-3 h-3 text-cyan-400" />
                  </div>
                  <p className="text-sm text-slate-400"><span className="text-white font-bold">Persistence:</span> All results are temporarily stored in Local RAM for download.</p>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
