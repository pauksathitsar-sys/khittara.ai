import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, Zap, Shield, BarChart3, Clock, AlertTriangle, RefreshCcw } from 'lucide-react';
import { ApiStatus } from '../types';
import { cn } from '../lib/utils';
import { translations } from '../lib/i18n';

export const ApiHealth: React.FC<{ lang: 'en' | 'mm', stats: ApiStatus | null, onRefresh: () => void }> = ({ lang, stats, onRefresh }) => {
  const t = translations[lang];

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCcw className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  const tokensToday = stats?.tokensToday || 0;
  const requestsToday = stats?.requestsToday || 0;
  const remainingRequests = stats?.remainingRequests ?? 1500;
  const tokenPercent = Math.min(100, (tokensToday / 1000000) * 100);
  
  const getStatusColor = (percent: number) => {
    const status = t.api_health.usage_status || { critical: 'Critical', warning: 'Warning', safe: 'Stable' };
    if (percent > 90) return { color: 'text-red-500', bg: 'bg-red-500', label: status.critical };
    if (percent > 70) return { color: 'text-amber-500', bg: 'bg-amber-500', label: status.warning };
    return { color: 'text-green-500', bg: 'bg-green-500', label: status.safe };
  };

  const tokenStatus = getStatusColor(tokenPercent);

  const getApiStatusLabel = () => {
    if (stats.status === 'Active') return lang === 'mm' ? 'အဆင်ပြေသည်' : 'Active';
    if (stats.status === 'Rate Limited') return lang === 'mm' ? 'ကန့်သတ်ချက် ပြည့်နေသည်' : 'Rate Limited';
    return lang === 'mm' ? 'ချိတ်ဆက်မှု ပြတ်တောက်နေသည်' : 'Disconnected';
  };

  const statusLabel = getApiStatusLabel();
  const statusColor = stats.status === 'Active' ? 'text-green-500' : stats.status === 'Rate Limited' ? 'text-amber-500' : 'text-red-500';
  const statusBg = stats.status === 'Active' ? 'bg-green-500' : stats.status === 'Rate Limited' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto pt-24 px-6 md:pt-32 pb-32"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight mb-2">
            {t.api_health.title} <span className="text-gold">.</span>
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-zinc-500 text-sm">{t.api_health.subtitle}</p>
            <div className="h-1 w-1 rounded-full bg-zinc-700" />
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
              {lang === 'mm' ? 'သမိုင်းဝင်အချက်အလက်- ၂၀၂၄-၂၀၂၆ ထည့်သွင်းပြီး' : 'Historical Data: 2024-2026 Loaded'}
            </p>
          </div>
        </div>
        <button 
          onClick={onRefresh}
          className="p-3 bg-zinc-900 border border-white/5 rounded-2xl text-zinc-400 hover:text-gold transition-colors"
        >
          <RefreshCcw size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Tier Status */}
        <div className="glass-zinc p-5 rounded-3xl relative overflow-hidden group border border-white/5">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <Shield size={48} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.api_health.tier}</p>
          <h3 className={cn("text-xl font-black", stats?.tier === 'Pay-as-you-go' ? "text-green-500" : "text-gold")}>
            {stats?.tier === 'Pay-as-you-go' ? t.api_health.pay_as_you_go : t.api_health.free_tier}
          </h3>
          <div className="mt-2 flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", statusBg)} />
            <span className={cn("text-[9px] font-bold uppercase tracking-tight", statusColor)}>{statusLabel}</span>
          </div>
        </div>

        {/* Tokens Today */}
        <div className="glass-zinc p-5 rounded-3xl relative overflow-hidden group border border-white/5">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap size={48} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.api_health.tokens_today}</p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-xl font-black text-white">{tokensToday.toLocaleString()}</h3>
            <span className="text-[10px] text-zinc-600 font-mono">/ 1M</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-zinc-950 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${tokenPercent}%` }} className={cn("h-full", tokenStatus.bg)} />
            </div>
            <span className={cn("text-[9px] font-black", tokenStatus.color)}>{Math.round(tokenPercent)}%</span>
          </div>
        </div>

        {/* Requests Today */}
        <div className="glass-zinc p-5 rounded-3xl relative overflow-hidden group border border-white/5">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <BarChart3 size={48} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{lang === 'mm' ? 'ယနေ့ requests' : 'Requests Today'}</p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-xl font-black text-white">{requestsToday.toLocaleString()}</h3>
            <span className="text-[10px] text-zinc-600 font-mono">/ 1.5K</span>
          </div>
          <p className="text-[9px] text-zinc-500 font-bold uppercase mt-2">{t.api_health.remaining_requests}: <span className="text-gold">{remainingRequests}</span></p>
        </div>

        {/* Latency */}
        <div className="glass-zinc p-5 rounded-3xl relative overflow-hidden group border border-white/5">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <Clock size={48} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.api_health.latency}</p>
          <h3 className="text-xl font-black text-white">{stats?.avgLatency || 0}ms</h3>
          <div className="mt-2 flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
             <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tight">{t.api_health.avg_speed}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Main Meter */}
          <div className="glass-zinc p-8 rounded-3xl relative overflow-hidden border border-white/5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
                  <Activity size={20} />
                </div>
                <h3 className="font-bold">{t.api_health.quota_overview}</h3>
              </div>
              <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", tokenStatus.bg === 'bg-gold' ? 'bg-gold/10 border-gold/20 text-gold' : tokenStatus.bg === 'bg-red-500' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500')}>
                {tokenStatus.label}
              </div>
            </div>

            <div className="space-y-10 relative z-10">
              <div>
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 mb-1">{t.api_health.daily_consumption}</p>
                    <p className="text-2xl font-black text-white">
                      {lang === 'mm' ? `အသုံးပြုပြီး - ${tokensToday.toLocaleString()}` : `Used - ${tokensToday.toLocaleString()}`} 
                      <span className="text-sm font-medium text-zinc-600"> / 1,000,000 Tokens</span>
                    </p>
                  </div>
                  <span className="text-xs font-mono text-zinc-500">{t.api_health.tokens_limit}</span>
                </div>
                <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${tokenPercent}%` }}
                    className={cn("h-full rounded-full shadow-lg", tokenStatus.bg)}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-4">
                   <div>
                    <p className="text-xs font-bold text-zinc-400 mb-1">{t.api_health.total_tokens}</p>
                    <p className="text-xl font-black text-zinc-300">{(stats?.totalTokensUsed || 0).toLocaleString()} <span className="text-sm font-medium text-zinc-600">tokens used life-time</span></p>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '45%' }}
                    className="h-full bg-blue-500 rounded-full opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Generative Quota */}
          <div className="glass-zinc p-8 rounded-3xl border border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="text-gold" size={20} />
              <h3 className="font-bold">{lang === 'mm' ? 'အဆင့်မြင့် ဖန်တီးမှု ကန့်သတ်ချက်များ' : 'Generative Tools Quota'}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="p-4 bg-zinc-950/50 border border-white/5 rounded-2xl group hover:border-gold/20 transition-colors">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t.api_health.video_quota}</p>
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-black text-white">{lang === 'mm' ? 'နေ့စဉ်ကန့်သတ်ချက်' : 'Daily Limit'}</span>
                     <span className="text-xs text-gold font-bold">{stats ? 'Pro Account Required' : t.api_health.checking}</span>
                  </div>
                  <div className="mt-3 flex gap-1">
                     {[1,2,3,4,5].map(i => (
                       <div key={i} className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
                          <div className={cn("h-full", i <= (stats?.videoUsage || 0) ? "bg-red-500" : "bg-gold/20")} />
                       </div>
                     ))}
                  </div>
               </div>

               <div className="p-4 bg-zinc-950/50 border border-white/5 rounded-2xl group hover:border-blue-500/20 transition-colors">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{t.api_health.music_quota}</p>
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-black text-white">30s Tracks</span>
                     <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded text-[9px] font-bold">{stats ? t.api_health.available : t.api_health.checking}</span>
                  </div>
                  <div className="mt-3 h-1 w-full bg-blue-500/20 rounded-full overflow-hidden" />
               </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Optimization Tips */}
          <div className="glass-zinc p-6 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="text-amber-500" size={20} />
              <h3 className="font-bold text-sm tracking-tight">{t.api_health.optimization_tips}</h3>
            </div>
            <ul className="space-y-4">
              {[
                lang === 'mm' ? 'စနစ်လမ်းညွှန်ချက်များကို လိုရင်းတိုရှင်း ထားပါ' : 'Keep system instructions concise',
                lang === 'mm' ? 'ရိုးရှင်းသော မေးခွန်းများအတွက် Flash model များကို သုံးပါ' : 'Use Flash models for simple queries',
                lang === 'mm' ? 'Static context များအတွက် prompt caching သုံးပါ' : 'Implement prompt caching for static context',
                lang === 'mm' ? 'ကြီးမားသော ပုံတင်မှုများကို စောင့်ကြည့်ပါ' : 'Monitor large image uploads'
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-zinc-950 border border-white/5 rounded flex items-center justify-center text-[10px] font-bold text-zinc-600 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{tip}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-zinc p-6 rounded-3xl">
            <h3 className="font-bold text-sm mb-4">{t.api_health.session_activity}</h3>
            <div className="space-y-3">
              {[
                { label: 'Chat Engine', type: 'Text', time: '2m ago' },
                { label: 'Vision AI', type: 'Image', time: '15m ago' },
                { label: '2D Predictor', type: 'Neural', time: '1h ago' }
              ].map((act, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-zinc-950/30 rounded-xl border border-white/5">
                   <div className="flex flex-col">
                      <span className="text-[10px] text-white font-bold">{act.label}</span>
                      <span className="text-[8px] text-zinc-600 uppercase">{act.type}</span>
                   </div>
                   <span className="text-[8px] text-zinc-500">{act.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
