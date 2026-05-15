import { Settings, ChatSession, ApiStatus } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'khittara_v2_settings',
  CHATS: 'khittara_v2_sessions',
  API_STATUS: 'khittara_v2_api_status',
};

const DEFAULT_SETTINGS: Settings = {
  apiKey: 'AIzaSyCO2xO2lGUmhbjUZ479RiSeW7HYwcrvN0M',
  language: 'en',
  theme: 'dark',
  preferredModel: 'gemini-3-flash-preview',
  availableModels: ['gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-2.0-flash-exp'],
  tone: 'friendly',
};

const DEFAULT_API_STATUS: ApiStatus = {
  tier: 'Free',
  status: 'Active',
  totalTokensUsed: 0,
  tokensToday: 0,
  requestsToday: 0,
  remainingRequests: 1500,
  avgLatency: 0,
  videoUsage: 0,
  musicUsage: 0,
};

export const storage = {
  getSettings: (): Settings => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  },
  saveSettings: (settings: Settings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },
  getSessions: (): ChatSession[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  },
  saveSessions: (sessions: ChatSession[]) => {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(sessions));
  },
  getApiStatus: (): ApiStatus => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.API_STATUS);
      const stats = saved ? { ...DEFAULT_API_STATUS, ...JSON.parse(saved) } : DEFAULT_API_STATUS;
      
      // Check for daily reset
      const lastReset = localStorage.getItem('khittara_v2_last_reset');
      const today = new Date().toDateString();
      if (lastReset !== today) {
        stats.tokensToday = 0;
        stats.requestsToday = 0;
        stats.remainingRequests = 1500;
        localStorage.setItem('khittara_v2_last_reset', today);
        localStorage.setItem(STORAGE_KEYS.API_STATUS, JSON.stringify(stats));
      }
      
      return stats;
    } catch { return DEFAULT_API_STATUS; }
  },
  saveApiStatus: (status: ApiStatus) => {
    localStorage.setItem(STORAGE_KEYS.API_STATUS, JSON.stringify(status));
  },
};
