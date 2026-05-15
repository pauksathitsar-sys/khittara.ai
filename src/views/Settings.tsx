import React from 'react';
import { motion } from 'motion/react';
import { Shield, Languages, Zap, Heart, Info, Globe, Cpu, Sun, Moon, Sparkles, Smile, Briefcase, Laugh } from 'lucide-react';
import { Settings as SettingsType } from '../types';
import { translations } from '../lib/i18n';

interface SettingsProps {
  settings: SettingsType;
  onUpdate: (settings: SettingsType) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  const t = translations[settings.language];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto pt-24 px-6 md:pt-32"
    >
      <div className="mb-12">
        <h1 className="text-4xl font-display font-bold tracking-tight mb-2">
          {t.sys_settings} <span className="text-gold">.</span>
        </h1>
        <p className="text-zinc-500 text-sm">{t.sys_desc}</p>
      </div>

      <div className="space-y-6">
        {/* Gemini API Section */}
        <div className="glass-zinc p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="font-bold">{t.intelligence_core}</h3>
                <p className="text-xs text-zinc-500">{t.api_desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               {settings.apiKey.startsWith('AIza') ? (
                 <div className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Status: Connected
                 </div>
               ) : (
                 <div className="px-3 py-1 bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Status: No Key
                 </div>
               )}
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="group">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2 block ml-1">
                {t.api_key}
              </label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-gold transition-colors" size={18} />
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => onUpdate({ ...settings, apiKey: e.target.value })}
                  placeholder="Paste your Gemini API Key here..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all font-mono text-sm"
                />
              </div>
            </div>

            <p className="text-[10px] text-zinc-600 leading-relaxed italic px-2">
              {t.api_note}
            </p>
          </div>
        </div>

        {/* Model Selection */}
        <div className="glass-zinc p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="font-bold">AI Heartbeat</h3>
              <p className="text-xs text-zinc-500">Choose Amara's cognitive engine</p>
            </div>
          </div>

          <div className="space-y-3">
            {settings.availableModels.map((modelId) => (
              <button
                key={modelId}
                onClick={() => onUpdate({ ...settings, preferredModel: modelId })}
                className={`w-full p-4 rounded-xl border transition-all text-left flex items-center justify-between group ${
                  settings.preferredModel === modelId
                    ? 'bg-gold/10 border-gold/50 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div>
                  <p className={`font-bold text-sm ${settings.preferredModel === modelId ? 'text-gold' : ''}`}>
                    {modelId.replace('models/', '')}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Amara's Intelligence Core</p>
                </div>
                {settings.preferredModel === modelId && (
                  <div className="w-2 h-2 bg-gold rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Language Section */}
        <div className="glass-zinc p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
              <Sun size={20} className={settings.theme === 'light' ? 'block' : 'hidden'} />
              <Moon size={20} className={settings.theme === 'dark' ? 'block' : 'hidden'} />
            </div>
            <div>
              <h3 className="font-bold">{t.theme_selection}</h3>
              <p className="text-xs text-zinc-500">{t.theme_desc}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'dark', label: t.theme_dark, icon: Moon },
              { id: 'light', label: t.theme_light, icon: Sun },
            ].map((theme) => (
              <button
                key={theme.id}
                onClick={() => onUpdate({ ...settings, theme: theme.id as any })}
                className={`p-6 rounded-2xl border transition-all text-left group ${
                  settings.theme === theme.id
                    ? 'bg-gold border-gold text-zinc-950 ring-4 ring-gold/10'
                    : 'bg-zinc-950 border-zinc-800 text-white hover:border-zinc-600'
                }`}
              >
                <theme.icon size={20} className={settings.theme === theme.id ? 'text-zinc-950' : 'text-zinc-500 group-hover:text-gold transition-colors'} />
                <p className="font-bold mt-4">{theme.label}</p>
                <p className={`text-[10px] mt-1 ${settings.theme === theme.id ? 'text-zinc-800' : 'text-zinc-500'}`}>
                  {theme.id === 'dark' ? 'Classic Deep' : 'Crisp Clean'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Conversational Tone */}
        <div className="glass-zinc p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold">{t.tone_selection}</h3>
              <p className="text-xs text-zinc-500">{t.tone_desc}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
            {[
              { id: 'friendly', label: t.tone_friendly, desc: t.tone_friendly_desc, icon: Smile },
              { id: 'formal', label: t.tone_formal, desc: t.tone_formal_desc, icon: Briefcase },
              { id: 'humorous', label: t.tone_humorous, desc: t.tone_humorous_desc, icon: Laugh },
            ].map((tone) => (
              <button
                key={tone.id}
                onClick={() => onUpdate({ ...settings, tone: tone.id as any })}
                className={`p-5 rounded-2xl border transition-all text-left group flex items-start gap-4 ${
                  settings.tone === tone.id
                    ? 'bg-gold border-gold text-zinc-950 ring-4 ring-gold/10 shadow-lg shadow-gold/20'
                    : 'bg-zinc-950 border-zinc-800 text-white hover:border-zinc-700'
                }`}
              >
                <div className={`mt-1 flex-shrink-0 ${settings.tone === tone.id ? 'text-zinc-950' : 'text-zinc-500 group-hover:text-gold transition-colors'}`}>
                  <tone.icon size={22} />
                </div>
                <div>
                  <p className="font-bold text-sm">{tone.label}</p>
                  <p className={`text-[11px] leading-relaxed mt-1 ${settings.tone === tone.id ? 'text-zinc-800' : 'text-zinc-500'}`}>
                    {tone.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Real Language Section */}
        <div className="glass-zinc p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
              <Languages size={20} />
            </div>
            <div>
              <h3 className="font-bold">{t.locale_interface}</h3>
              <p className="text-xs text-zinc-500">{t.locale_desc}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'en', label: 'English', sub: 'Amara (EN)', icon: Globe },
              { id: 'mm', label: 'ဗမာစာ', sub: 'အမရာ (MM)', icon: Globe },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => onUpdate({ ...settings, language: lang.id as any })}
                className={`p-6 rounded-2xl border transition-all text-left group ${
                  settings.language === lang.id
                    ? 'bg-gold border-gold text-zinc-950 ring-4 ring-gold/10'
                    : 'bg-zinc-950 border-zinc-800 text-white hover:border-zinc-600'
                }`}
              >
                <lang.icon size={20} className={settings.language === lang.id ? 'text-zinc-950' : 'text-zinc-500 group-hover:text-gold transition-colors'} />
                <p className="font-bold mt-4">{lang.label}</p>
                <p className={`text-[10px] mt-1 ${settings.language === lang.id ? 'text-zinc-800' : 'text-zinc-500'}`}>
                  {lang.sub}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center pt-8 space-y-4">
          <div className="flex items-center justify-center gap-6 text-zinc-600">
            <button className="flex items-center gap-2 text-xs hover:text-white transition-colors">
              <Heart size={14} className="text-red-500/50" />
              Sponsor MinThitSarAung
            </button>
            <button className="flex items-center gap-2 text-xs hover:text-white transition-colors">
              <Info size={14} />
              About Amara v1.0.5
            </button>
          </div>
          <p className="text-[10px] text-zinc-700 font-mono">
            &copy; 2026 KHITTARA TECH x MinThitSarAung.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

