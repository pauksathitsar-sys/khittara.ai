import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Bot, Trash2, Loader2, Sparkles, Plus, Image as ImageIcon, FileText, X, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { Message, ChatSession, Attachment } from '../types';
import { cn } from '../lib/utils';
import { translations, Language } from '../lib/i18n';
import { MessageContent } from '../components/MessageContent';

interface ChatProps {
  session: ChatSession;
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  onClearHistory: () => void;
  onSyncMemory?: () => void;
  isProcessing: boolean;
  isSyncing?: boolean;
  lang: Language;
}

export const Chat: React.FC<ChatProps> = ({ session, onSendMessage, onClearHistory, onSyncMemory, isProcessing, isSyncing, lang }) => {
  const [input, setInput] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [tempAttachments, setTempAttachments] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [session.messages, isProcessing]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const url = reader.result as string;
        const attachment: Attachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          url: url,
          name: file.name,
          mimeType: file.type
        };
        setTempAttachments(prev => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (index: number) => {
    setTempAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((input.trim() || tempAttachments.length > 0) && !isProcessing) {
      onSendMessage(input.trim(), tempAttachments);
      setInput('');
      setTempAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto px-6 relative">
      {/* Header Info */}
      <div className="pt-24 pb-6 flex items-center justify-between border-b border-zinc-900 theme-light:border-zinc-200 theme-dark:border-zinc-900 mb-6 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center text-gold">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="font-bold">{t.hero_title} Intelligence</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold opacity-60">Gemini 1.5 Flash Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.messages.length > 0 && onSyncMemory && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSyncMemory}
              disabled={isSyncing}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2",
                isSyncing 
                  ? "bg-zinc-900 text-gold cursor-wait" 
                  : "bg-gold/10 text-gold hover:bg-gold/20"
              )}
              title="Sync conversation highlights to Second Brain"
            >
              {isSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <BrainCircuit size={16} />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Sync Memory</span>
            </motion.button>
          )}
          <button
            onClick={onClearHistory}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 theme-light:hover:bg-zinc-100 theme-dark:hover:bg-zinc-900 rounded-lg transition-colors"
            title={t.clear_history}
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-8 pb-32 scrollbar-none"
      >
        {session.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 italic">
            <div className="w-20 h-20 bg-zinc-900/50 theme-light:bg-zinc-100 theme-dark:bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-zinc-800 theme-light:border-zinc-200 theme-dark:border-zinc-800">
              <Bot size={40} className="opacity-20" />
            </div>
            <p className="text-sm font-medium tracking-tight opacity-40">{t.history_empty}</p>
          </div>
        ) : (
          session.messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-[90%] md:max-w-[80%]",
                m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm transition-colors",
                m.role === 'user' ? "bg-gold text-zinc-950 font-bold" : "bg-zinc-800 theme-light:bg-zinc-200 theme-dark:bg-zinc-800 text-zinc-400"
              )}>
                {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={cn(
                "px-5 py-3.5 rounded-2xl text-sm leading-relaxed transition-all",
                m.role === 'user' 
                  ? "bg-gold text-zinc-950 font-bold rounded-tr-none shadow-lg shadow-gold/20" 
                  : "bg-zinc-900 theme-light:bg-white theme-dark:bg-zinc-900 border border-zinc-800 theme-light:border-zinc-200 theme-dark:border-zinc-800 rounded-tl-none prose prose-sm max-w-none text-zinc-200 theme-light:text-zinc-800 theme-dark:text-zinc-200",
                m.role === 'assistant' && "prose-zinc theme-dark:prose-invert shadow-sm"
              )}>
                <MessageContent 
                  content={m.content} 
                  attachments={m.attachments} 
                  role={m.role} 
                />
              </div>
            </motion.div>
          ))
        )}

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-4 max-w-[80%] mr-auto"
          >
            <div className="w-9 h-9 rounded-full bg-zinc-800 theme-light:bg-zinc-200 theme-dark:bg-zinc-800 text-gold flex items-center justify-center shrink-0 animate-pulse border border-zinc-700 theme-light:border-zinc-300 theme-dark:border-zinc-700">
              <Sparkles size={18} />
            </div>
            <div className="px-5 py-4 bg-zinc-900 theme-light:bg-white theme-dark:bg-zinc-900 border border-zinc-800 theme-light:border-zinc-200 theme-dark:border-zinc-800 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-sm">
               <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{t.processing}</span>
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-6 left-6 right-6">
        {/* Attachment Previews */}
        <AnimatePresence>
          {tempAttachments.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="max-w-3xl mx-auto flex flex-wrap gap-2 mb-3 px-2"
            >
              {tempAttachments.map((att, i) => (
                <div key={`att-${i}-${att.name}`} className="relative group">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-xl">
                    {att.type === 'image' ? (
                      <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
                        <FileText size={20} />
                        <span className="text-[8px] uppercase font-black mt-1">{att.mimeType.split('/')[1]}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-red-500/50 transition-colors shadow-lg"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form 
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto glass-zinc rounded-3xl p-2 pl-4 flex items-end gap-2 ring-1 ring-white/5 focus-within:ring-gold/50 transition-all shadow-2xl theme-light:shadow-black/5"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-zinc-500 hover:text-gold hover:bg-zinc-800 theme-light:hover:bg-zinc-100 theme-dark:hover:bg-zinc-800 rounded-2xl transition-all mb-0.5"
            title="Attach files"
          >
            <Plus size={20} />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.ask_something}
            disabled={isProcessing}
            className="w-full bg-transparent border-none outline-none text-zinc-100 theme-light:text-zinc-950 theme-dark:text-zinc-100 placeholder:text-zinc-500/60 py-3 transition-colors resize-none custom-scrollbar min-h-[44px]"
          />
          <button
            type="submit"
            disabled={(!input.trim() && tempAttachments.length === 0) || isProcessing}
            className="bg-gold text-zinc-950 p-3.5 rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:hover:scale-100 shadow-lg shadow-gold/20 mb-0.5"
          >
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};
