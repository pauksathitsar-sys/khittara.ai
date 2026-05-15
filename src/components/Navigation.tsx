import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LayoutDashboard, MessageSquare, BarChart3, Settings as SettingsIcon, LogOut, Plus, Trash2, Clock, Key, Eye, Brain, Globe, Activity, ShieldAlert, Video, Palette, Database } from 'lucide-react';
import { View, ChatSession } from '../types';
import { cn } from '../lib/utils';
import { translations, Language } from '../lib/i18n';

interface NavigationProps {
  currentView: View;
  onViewChange: (view: View) => void;
  lang: Language;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ 
  currentView, 
  onViewChange, 
  lang, 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onNewChat,
  onDeleteSession
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[lang];

  const menuItems: { id: View; label: string; icon: any; badge?: string }[] = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'chat', label: t.chat, icon: MessageSquare },
    { id: 'image-studio', label: t.image_studio_nav || 'Image Studio', icon: Palette, badge: 'Pro' },
    { id: 'video-lab', label: t.video_lab_nav || 'Video Lab', icon: Video, badge: 'Premium' },
    { id: 'data-extractor', label: t.data_extractor_nav || 'Data Extractor', icon: Database, badge: 'Logic' },
    { id: 'second-brain', label: t.second_brain, icon: Brain, badge: 'Brain' },
    { id: 'image-checker', label: t.image_checker.title, icon: Eye, badge: 'New' },
    { id: 'api-health', label: 'API Health', icon: Activity, badge: 'Live' },
    {id: 'settings', label: t.settings, icon: SettingsIcon },
  ];

  return (
    <>
      {/* Draggable Menu Button */}
      <motion.button
        drag
        dragMomentum={false}
        dragConstraints={{ left: 0, right: window.innerWidth - 80, top: 0, bottom: window.innerHeight - 80 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-6 left-6 z-50 w-12 h-12 bg-gold rounded-full flex items-center justify-center shadow-lg shadow-gold/25 cursor-pointer active:scale-95 transition-transform"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        style={{ touchAction: 'none' }}
      >
        {isOpen ? <X className="text-zinc-950" /> : <Menu className="text-zinc-950" />}
      </motion.button>

      {/* Sidebar Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-80 bg-zinc-950 dark:bg-zinc-950 theme-light:bg-white theme-dark:bg-zinc-950 border-r border-zinc-900 theme-light:border-zinc-200 theme-dark:border-zinc-900 z-40 sidebar-shadow p-6 flex flex-col"
            >
              <div className="mb-8 mt-16 px-4">
                <h1 className="text-2xl font-display font-bold tracking-tight theme-light:text-zinc-950 theme-dark:text-white">
                  {t.hero_title} <span className="text-gold">.</span>
                </h1>
                <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest font-bold opacity-60">{t.digital_hub}</p>
              </div>

              {/* Main Navigation */}
              <div className="space-y-1 mb-8">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onViewChange(item.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-bold",
                      currentView === item.id
                        ? "bg-gold text-zinc-950 shadow-lg shadow-gold/20"
                        : "text-zinc-400 theme-light:text-zinc-500 theme-dark:text-zinc-400 hover:bg-zinc-900 theme-light:hover:bg-zinc-100 theme-dark:hover:bg-zinc-900 theme-light:hover:text-zinc-950 theme-dark:hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <item.icon size={18} className={cn(
                        currentView === item.id ? "text-zinc-950" : "text-zinc-500 group-hover:text-gold"
                      )} />
                      {item.label}
                    </div>
                    {item.badge && (
                      <span className={cn(
                        "text-[8px] uppercase tracking-tighter px-1.5 py-0.5 rounded-md font-black",
                        currentView === item.id ? "bg-zinc-950/20 text-zinc-950" : "bg-gold/10 text-gold"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Chat Sessions History */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 mb-4">
                  <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{t.sessions}</h3>
                  <button 
                    onClick={onNewChat}
                    className="p-1.5 bg-zinc-900 theme-light:bg-zinc-100 theme-dark:bg-zinc-900 rounded-lg text-gold hover:bg-zinc-800 theme-light:hover:bg-zinc-200 theme-dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                  {sessions.slice().reverse().map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "group flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer",
                        activeSessionId === session.id 
                          ? "bg-zinc-900 theme-light:bg-zinc-50 theme-dark:bg-zinc-900 border border-zinc-800 theme-light:border-zinc-200 theme-dark:border-zinc-800" 
                          : "hover:bg-zinc-900/50 theme-light:hover:bg-zinc-100/50 theme-dark:hover:bg-zinc-900/50 border border-transparent"
                      )}
                      onClick={() => {
                        onSelectSession(session.id);
                        onViewChange('chat');
                        setIsOpen(false);
                      }}
                    >
                      <Clock size={14} className={activeSessionId === session.id ? "text-gold" : "text-zinc-700"} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs truncate font-medium",
                          activeSessionId === session.id ? "theme-light:text-zinc-950 theme-dark:text-white" : "text-zinc-500"
                        )}>
                          {session.messages[0]?.content.substring(0, 30) || t.new_chat}
                        </p>
                        <p className="text-[9px] text-zinc-700/60 mt-0.5">
                          {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-900 theme-light:border-zinc-200 theme-dark:border-zinc-900 mt-6 space-y-2">
                <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-900/50 theme-light:hover:bg-zinc-50 theme-dark:hover:bg-zinc-900/50 transition-colors text-sm font-bold">
                  <LogOut size={18} />
                  {t.sign_out}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
