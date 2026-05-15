import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ArrowRight, Sparkles, TrendingUp, ShieldCheck, Zap, Settings, Check } from 'lucide-react';
import { translations, Language } from '../lib/i18n';
import { ApiStatus } from '../types';
import { cn } from '../lib/utils';

interface DashboardProps {
  onQuickChat: (message: string) => void;
  lang: Language;
  stats: ApiStatus | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ onQuickChat, lang, stats }) => {
  const [input, setInput] = useState('');
  const t = translations[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onQuickChat(input);
    }
  };

  const features = [
    { icon: Sparkles, title: t.features.ai, desc: t.features.ai_desc },
    { icon: TrendingUp, title: t.data_extractor.title, desc: t.data_extractor.subtitle },
    { icon: ShieldCheck, title: t.features.secure, desc: t.features.secure_desc },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto pt-24 px-6 md:pt-32 relative"
    >
      <div className="text-center mb-16 px-4">
        <motion.h1
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-6xl md:text-8xl font-display font-bold tracking-tighter mb-4"
        >
          {t.hero_title} <span className="text-gold">.</span>
        </motion.h1>
        <p className="text-zinc-500 text-base md:text-lg font-medium max-w-xl mx-auto leading-relaxed">
          {t.hero_subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative group max-w-2xl mx-auto mb-20 px-4">
        <div className="absolute inset-0 bg-gold/15 blur-3xl rounded-full group-focus-within:bg-gold/25 transition-all duration-700" />
        <div className="relative flex items-center glass-zinc rounded-2xl p-2 pl-6">
          <Search className="text-zinc-500 mr-4 shrink-0 transition-colors group-focus-within:text-gold" size={24} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.search_placeholder}
            className="w-full bg-transparent border-none outline-none text-base md:text-lg theme-light:text-zinc-950 theme-dark:text-white py-4 placeholder:text-zinc-500/60 transition-colors"
          />
          <button
            type="submit"
            className="bg-gold text-zinc-950 p-4 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gold/20"
          >
            <ArrowRight size={24} />
          </button>
        </div>
      </form>

      {/* Neural Energy Meter */}
      <div className="max-w-2xl mx-auto mb-12 px-4">
        <div className="glass-zinc p-4 px-6 rounded-2xl flex items-center justify-between group overflow-hidden relative">
          <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center text-gold">
              <Zap size={16} className="group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{lang === 'mm' ? 'Neural စွမ်းအင်' : 'Neural Energy'}</p>
              <p className="text-xs font-black text-white">{(stats?.tokensToday || 0).toLocaleString()} <span className="text-zinc-600 font-medium">{lang === 'mm' ? 'ယနေ့အသုံးပြုမှု' : 'tokens used today'}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="text-right hidden sm:block">
               <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{lang === 'mm' ? 'အခြေအနေ' : 'Status'}</p>
               <p className={cn(
                 "text-xs font-black uppercase",
                 stats?.status === 'Active' ? "text-green-500" : stats?.status === 'Rate Limited' ? "text-amber-500" : "text-red-500"
               )}>
                 {stats?.status === 'Active' 
                   ? (lang === 'mm' ? 'အဆင်ပြေသည်' : 'Connected') 
                   : (lang === 'mm' ? 'ချိတ်ဆက်မှု ပြတ်တောက်နေသည်' : 'Disconnected')}
               </p>
            </div>
            <div className="w-20 h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ((stats?.tokensToday || 0) / 1000000) * 100)}%` }}
                className="h-full bg-gold shadow-[0_0_10px_rgba(234,179,8,0.5)]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + (i * 0.1) }}
            className="glass-zinc p-8 rounded-3xl hover:border-gold/30 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-gold/10 transition-colors" />
            <div className="w-12 h-12 bg-zinc-800 theme-light:bg-zinc-100 theme-dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 text-gold group-hover:scale-110 transition-transform">
              <f.icon size={22} />
            </div>
            <h3 className="text-lg font-bold mb-2">{f.title}</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
