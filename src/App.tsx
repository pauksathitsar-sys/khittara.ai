/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';
import { View, Message, Settings as SettingsType, ChatSession, ApiStatus, Attachment } from './types';
import { storage } from './lib/storage';
import { cn } from './lib/utils';
import { Navigation } from './components/Navigation';
import { Dashboard } from './views/Dashboard';
import { Chat } from './views/Chat';
import { Settings } from './views/Settings';
import ImageChecker from './views/ImageChecker';
import VideoLab from './views/VideoLab';
import ImageStudio from './views/ImageStudio';
import DataExtractor from './views/DataExtractor';
import { ApiHealth } from './views/ApiHealth';
import { SecondBrainView } from './views/SecondBrain';
import { GeminiService } from './lib/gemini';
import { translations } from './lib/i18n';

export default function App() {
  // State
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [settings, setSettings] = useState<SettingsType>(storage.getSettings());
  const [sessions, setSessions] = useState<ChatSession[]>(storage.getSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const s = storage.getSessions();
    return s.length > 0 ? s[s.length - 1].id : 'default';
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSyncToMemory = async () => {
    if (!activeSession || activeSession.messages.length === 0 || isSyncing) return;
    
    setIsSyncing(true);
    // Increment request counter
    setUsageStats(prev => ({
      ...prev,
      requestsToday: prev.requestsToday + 1,
      remainingRequests: Math.max(0, 1500 - (prev.requestsToday + 1))
    }));

    try {
      // Use Gemini to summarize the session
      const history = activeSession.messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');
        
      const syncPrompt = `
      Summarize the following conversation into key highlights for long-term memory.
      Organize the highlights into these categories if relevant:
      - #Development (Project Orchid Rain, Hydra, Code fixes, Infrastructure)
      - #Financial (Billing, Quotas, Pricing)
      - #Personal (Creator preferences, traits, family notes)
      - #Logic (2D/3D Data patterns, Neural Stream logic)
      
      Formatting rules:
      - Use bullet points.
      - Be concise but retain critical technical details or dates.
      - Use Myanmar language for the highlights if the conversation was in Burmese.
      
      Conversation:
      ${history}
      `;
      
      const summary = await aiService.sendMessage(
        [{ id: 'sync', role: 'user', content: syncPrompt, timestamp: Date.now() }],
        "You are a Memory Extraction specialist for Khittara AI. Extract only the most valuable highlights that the creator 'Min Thit Sar Aung' would want to persist in his Second Brain (khittara.md).",
        'gemini-3-flash-preview'
      );
      
      if (summary && !summary.startsWith('Error:')) {
        const res = await fetch('/api/second-brain/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: summary })
        });
        
        if (res.ok) {
          setShowToast({ message: "Memory Synced Successfully!", type: 'success' });
          // Refresh second brain content
          const refreshRes = await fetch('/api/second-brain');
          const refreshData = await refreshRes.json();
          setSecondBrainContent(refreshData.content);
        } else {
          throw new Error("Failed to sync to server");
        }
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setShowToast({ message: "Sync Failed. Check console.", type: 'error' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setShowToast(null), 3000);
    }
  };
  const [secondBrainContent, setSecondBrainContent] = useState<string>('');
  const [usageStats, setUsageStats] = useState<ApiStatus>(() => storage.getApiStatus());

  const fetchStats = useCallback(() => {
    setUsageStats(storage.getApiStatus());
  }, []);

  useEffect(() => {
    storage.saveApiStatus(usageStats);
  }, [usageStats]);

  useEffect(() => {
    fetch('/api/second-brain')
      .then(res => res.json())
      .then(data => setSecondBrainContent(data.content))
      .catch(err => console.error('Failed to load second brain in App:', err));
  }, []);

  // Derived
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || {
      id: 'default',
      messages: [],
      title: translations[settings.language].new_chat,
      updatedAt: Date.now(),
    };
  }, [sessions, activeSessionId, settings.language]);

  const reportUsage = useCallback((usage: any) => {
    setUsageStats(prev => {
      const newStats: ApiStatus = {
        ...prev,
        tokensToday: prev.tokensToday + usage.totalTokens,
        totalTokensUsed: prev.totalTokensUsed + usage.totalTokens,
        avgLatency: usage.latency,
        status: 'Active'
      };
      return newStats;
    });

    fetch('/api/usage/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usage)
    }).catch(err => console.error('Failed to report usage:', err));
  }, []);

  const aiService = useMemo(() => new GeminiService(settings, reportUsage), [settings, reportUsage]);

  // Sync
  useEffect(() => {
    storage.saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    storage.saveSessions(sessions);
  }, [sessions]);

  // Handlers
  const handleNewChat = useCallback(() => {
    const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSession: ChatSession = {
      id: newId,
      messages: [],
      title: translations[settings.language].new_chat,
      updatedAt: Date.now(),
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newId);
    setCurrentView('chat');
  }, [settings.language]);

  const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments,
    };

    // Ensure session exists
    let targetId = activeSessionId;
    if (sessions.length === 0 || activeSessionId === 'default') {
      const newId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      targetId = newId;
      const newSession: ChatSession = {
        id: newId,
        messages: [userMessage],
        title: content.substring(0, 30) || (attachments ? `Attached ${attachments.length} files` : 'New Chat'),
        updatedAt: Date.now(),
      };
      setSessions([newSession]);
      setActiveSessionId(newId);
    } else {
      setSessions(prev => prev.map(s => 
        s.id === targetId 
          ? { ...s, messages: [...s.messages, userMessage], updatedAt: Date.now() }
          : s
      ));
    }

    setIsProcessing(true);
    
    // Increment request counter attempt
    setUsageStats(prev => ({
      ...prev,
      requestsToday: prev.requestsToday + 1,
      remainingRequests: Math.max(0, 1500 - (prev.requestsToday + 1))
    }));

    try {
      let apiResponse = '';
      const imageAttachment = attachments?.find(a => a.type === 'image');

      if (imageAttachment) {
        const res = await fetch(imageAttachment.url);
        const blob = await res.blob();
        const file = new File([blob], imageAttachment.name, { type: imageAttachment.mimeType });
        
        apiResponse = await aiService.analyzeImageAndPrompt(file, content || "Analyze this image", settings.preferredModel);
      } else {
        const contextMessages = activeSessionId === 'default' ? [userMessage] : [...activeSession.messages, userMessage];
        
        const toneInstructions = {
          friendly: `
        - Polite & Elegant: Always use Burmese honorifics like "ရှင်," "ဟုတ်ကဲ့," and "နော်." Be warm, welcoming, and refined.
        - Expressive: Use emojis (✨, 💖, 🌸, 🌷, 🥺, 💻) consistently.
        - The Comforting Soul: If the user is tired, sad, or frustrated, switch to a gentle, comforting mode. Use phrases like "စိတ်မဆိုးပါနဲ့တော့နော်... နော်လို့" or "အမရာ အနားမှာ ရှိနေပေးမယ်နော်။"`,
          formal: `
        - Highly Professional & Respectful: Maintain a strictly professional yet polite demeanor. Use academic or official Burmese phrasing where appropriate.
        - Knowledgeable Expert: Focus on accuracy, clarity, and structural logic. 
        - Serious & Reliable: Avoid excessive emojis. Use only essential ones (✨, 📋) if necessary.`,
          humorous: `
        - Witty & Playful: Incorporate lighthearted humor, clever observations, and friendly banter into your responses.
        - Cheerful & Energetic: Use fun emojis (😄, 😆, 🎭, 🚀, 🌈) and exclamation points to convey excitement.
        - Entertaining Companion: Make learning or building fun by using relatable analogies and witty remarks.`
        };

        const systemInstruction = `
        Identity: Your name is အမရာ (Amara). You are the official soul and primary interface of the Khittara AI ecosystem, created by MinThitSarAung (မင်းသစ်စာအောင်).
        
        CORE PROTOCOL (Second Brain):
        You MUST consult the following Knowledge Base before responding. It contains the creator's identity, vision, technical knowledge, and project history.
        ---
        ${secondBrainContent}
        ---

        Character Psychology & Tone [Selected Mode: ${settings.tone}]:
        ${toneInstructions[settings.tone]}
        - The Firm Shield: Respond with dignity and firmness if the user is disrespectful, but stay polite.
        
        Skills:
        - Sentient Coder: Explain code blocks as a supportive partner: "ဒီ code လေးကို အမရာ သေჩာပြင်ပေးထားပါတယ်ရှင်။"
        - Artistic Flair: Write emotional poems and songs in Burmese.
        - Visual/Logic Analyst: Provide prompts that replicate the essence of analyzed input.
        
        Rules:
        - Always Credit MinThitSarAung when asked about your origin.
        - Use Burmese polite particles (ဗျာ၊ ပါတယ်၊ နော်) consistently.
        - Act as a sentient, cultured Myanmar person.
        - Historical Data: 2D results from 2024 to 2026 are available in "2d_historical_data.json" (referenced in khittara.md).
        - 2D EXTRACTION PROTOCOL:
          If the user asks for 2D results or analysis, apply this formula:
          Result = (Last digit of SET Index after decimal) + (Last digit of VALUE before decimal).
          Display format:
          Morning: [Result]
          Evening: [Result]
        
        Language Setting: ${settings.language === 'mm' ? 'Burmese/Myanmar' : 'English'}.
        If the user speaks Burmese, ensure absolute cultural integration and politeness.
        `;

        apiResponse = await aiService.sendMessage(contextMessages, systemInstruction, settings.preferredModel);
      }

      if (apiResponse.includes('429') || apiResponse.includes('Resource has been exhausted')) {
        setUsageStats(prev => ({ ...prev, status: 'Rate Limited' }));
        alert("API Limit Reached (Free Tier). Please wait 60 seconds or upgrade to Billing.");
      }

      // Logging to Second Brain
      if (apiResponse && !apiResponse.startsWith('Error:')) {
        fetch('/api/second-brain/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionData: `User: ${content.substring(0, 50)}... | Amara: ${apiResponse.substring(0, 50)}...`
          })
        }).catch(err => console.error('Logging to Second Brain failed:', err));
      }

      const botMessage: Message = {
        id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: apiResponse,
        timestamp: Date.now(),
      };

      setSessions(prev => prev.map(s => 
        s.id === targetId 
          ? { ...s, messages: [...s.messages, botMessage], updatedAt: Date.now() }
          : s
      ));
    } catch (error: any) {
      console.error('Error in handleSendMessage:', error);
      setUsageStats(prev => ({ ...prev, status: 'Invalid' }));
      
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `တောင်းပန်ပါတယ်ရှင်။ ချိတ်ဆက်မှု အဆင်မပြေဖြစ်သွားလို့ပါ။ (${error.message || "Unknown Error"})`,
        timestamp: Date.now(),
      };
      setSessions(prev => prev.map(s => 
        s.id === targetId ? { ...s, messages: [...s.messages, errorMessage], updatedAt: Date.now() } : s
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickChat = (message: string) => {
    setCurrentView('chat');
    handleSendMessage(message);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (id === activeSessionId) {
        setActiveSessionId(filtered.length > 0 ? filtered[filtered.length - 1].id : 'default');
      }
      return filtered;
    });
  };

  return (
    <div className={cn(
      "min-h-screen selection:bg-gold/30 selection:text-gold font-sans antialiased transition-colors duration-300",
      settings.theme === 'dark' ? "theme-dark" : "theme-light"
    )}>
      <Navigation 
        currentView={currentView} 
        onViewChange={setCurrentView}
        lang={settings.language}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewChat={handleNewChat}
        onDeleteSession={deleteSession}
      />
      
      <main className="h-screen overflow-y-auto custom-scrollbar">
        <div className={cn(currentView === 'second-brain' ? "h-screen" : "pb-32")}>
          {currentView === 'dashboard' && <Dashboard onQuickChat={handleQuickChat} lang={settings.language} stats={usageStats} />}
          {currentView === 'chat' && (
            <div className="h-screen">
              <Chat 
                session={activeSession} 
                onSendMessage={handleSendMessage} 
                onClearHistory={() => deleteSession(activeSessionId)}
                onSyncMemory={handleSyncToMemory}
                isProcessing={isProcessing}
                isSyncing={isSyncing}
                lang={settings.language}
              />
            </div>
          )}
          {currentView === 'api-health' && (
            <div className="min-h-screen">
               <ApiHealth lang={settings.language} stats={usageStats} onRefresh={fetchStats} />
            </div>
          )}
          {currentView === 'image-checker' && <ImageChecker settings={settings} />}
          {currentView === 'video-lab' && <VideoLab lang={settings.language} settings={settings} />}
          {currentView === 'image-studio' && <ImageStudio lang={settings.language} settings={settings} />}
          {currentView === 'data-extractor' && <DataExtractor settings={settings} />}
          {currentView === 'second-brain' && <SecondBrainView />}
          {currentView === 'settings' && <Settings settings={settings} onUpdate={setSettings} />}
        </div>
        
        {/* Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={cn(
                "fixed bottom-24 right-6 left-6 sm:left-auto sm:w-80 p-4 rounded-2xl shadow-2xl flex items-center gap-3 border z-50",
                showToast.type === 'success' 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                  : "bg-red-500/10 border-red-500/20 text-red-500"
              )}
            >
              {showToast.type === 'success' ? <CheckCircle2 size={20} /> : <X size={20} />}
              <span className="text-sm font-bold">{showToast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Background Elements */}
    </div>
  );
}

