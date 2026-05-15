export type View = 'dashboard' | 'chat' | 'settings' | 'image-checker' | 'second-brain' | 'api-discovery' | 'api-health' | 'video-lab' | 'image-studio' | 'data-extractor';

export interface Usage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  timestamp: number;
  model: string;
  latency: number;
}

export interface ApiStatus {
  tier: 'Free' | 'Pay-as-you-go' | 'Unknown';
  status: 'Active' | 'Invalid' | 'Rate Limited';
  totalTokensUsed: number;
  tokensToday: number;
  requestsToday: number;
  remainingRequests: number;
  avgLatency: number;
  videoUsage: number;
  musicUsage: number;
}

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  mimeType: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
}

export type AIModel = string;
export type ChatTone = 'friendly' | 'formal' | 'humorous';

export interface Settings {
  apiKey: string;
  language: 'en' | 'mm';
  theme: 'dark' | 'light';
  preferredModel: AIModel;
  availableModels: string[];
  tone: ChatTone;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  title: string;
  updatedAt: number;
}
