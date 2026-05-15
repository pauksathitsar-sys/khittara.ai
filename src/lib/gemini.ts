import { GoogleGenAI } from "@google/genai";
import { Message, AIModel, Settings } from "../types";

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private settings: Settings | null = null;
  private onUsageReport?: (usage: any) => void;

  constructor(settings: Settings, onUsageReport?: (usage: any) => void) {
    this.settings = settings;
    this.onUsageReport = onUsageReport;

    if (settings.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: settings.apiKey });
    }
  }

  async sendMessage(
    messages: Message[],
    systemInstruction?: string,
    model: AIModel = "gemini-3-flash-preview"
  ): Promise<string> {
    if (!this.ai) {
      return "Critical failure: AI Core not initialized. Check your API key in Settings.";
    }

    const contents = messages.map(m => {
      // In @google/genai, roles are 'user' and 'model' (or just text strings in some cases)
      // The SDK handles content conversion usually, but let's be explicit
      return {
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      };
    });

    try {
      return await this.executeCall(model, contents, systemInstruction);
    } catch (error: any) {
      console.error(`❌ Primary model (${model}) failed:`, error);
      
      const fallbackModel = "gemini-3-flash-preview";
      if (model !== fallbackModel) {
        try {
          console.log(`⚡ Falling back to ${fallbackModel}...`);
          return await this.executeCall(fallbackModel, contents, systemInstruction);
        } catch (fallbackError: any) {
          console.error("❌ Fallback failed:", fallbackError);
          return `Error: ${fallbackError.message || "Request failed."}`;
        }
      }
      return `Error: ${error.message || "Request failed."}`;
    }
  }

  private async executeCall(modelName: string, contents: any[], systemInstruction?: string): Promise<string> {
    if (!this.ai) throw new Error("AI not initialized");

    const startTime = Date.now();
    try {
      const response = await this.ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.9,
          topP: 1,
          topK: 1,
        }
      });

      const latency = Date.now() - startTime;
      
      if (this.onUsageReport && response.usageMetadata) {
        this.onUsageReport({
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
          timestamp: Date.now(),
          model: modelName,
          latency: latency,
        });
      }

      return response.text || "No response received.";
    } catch (error) {
      // Report failure latency even on error if possible
      const latency = Date.now() - startTime;
      throw error;
    }
  }

  async analyzeImageAndPrompt(
    imageFile: File,
    promptText: string,
    model: AIModel = "gemini-3-flash-preview"
  ): Promise<string> {
    if (!this.ai) {
      return "Critical failure: AI Core not initialized.";
    }

    const startTime = Date.now();
    try {
      const b64 = await fileToBase64(imageFile);
      
      const response = await this.ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { text: promptText },
            { inlineData: { data: b64, mimeType: imageFile.type } }
          ]
        }
      });
      
      const latency = Date.now() - startTime;
      if (this.onUsageReport && response.usageMetadata) {
        this.onUsageReport({
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
          timestamp: Date.now(),
          model: model,
          latency: latency,
        });
      }

      return response.text || "No analysis generated.";
    } catch (error: any) {
      console.error("❌ Image analysis failed:", error);
      return `Error: ${error.message || "Failed to analyze image."}`;
    }
  }
}


async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
