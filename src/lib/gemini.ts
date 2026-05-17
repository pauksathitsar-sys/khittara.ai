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

    // ========================================================
    // ၁။ KHITTARA.MD (BRAIN) နှင့် 2D DATA ဖိုင်နှစ်ခုလုံးကို GitHub Raw CDN မှ Fetch လုပ်ခြင်း
    // ========================================================
    let khittaraBrainContent = "";
    let historicalDataString = "[]";

    // (က) khittara.md ကို ဖွင့်ဖတ်ပြီး AI Core Memory ထဲ ထည့်ရန် ဆွဲယူခြင်း
    try {
      const brainResponse = await fetch('https://raw.githubusercontent.com/pauksathitsar-sys/khittara.ai/main/khittara.md');
      if (brainResponse.ok) {
        khittaraBrainContent = await brainResponse.text();
      }
    } catch (brainError) {
      console.warn("⚠️ Could not load khittara.md automatically:", brainError);
    }

    // (ခ) ၂D JSON သမိုင်းကြောင်းဒေတာကို ဆွဲယူခြင်း
    try {
      const dataResponse = await fetch('https://raw.githubusercontent.com/pauksathitsar-sys/khittara.ai/main/2d_historical_data.json');
      if (dataResponse.ok) {
        const jsonData = await dataResponse.json();
        historicalDataString = JSON.stringify(jsonData);
      }
    } catch (fetchError) {
      console.warn("⚠️ Could not load 2d_historical_data.json automatically:", fetchError);
    }

    // ========================================================
    // ၂။ MASTER INSTRUCTION တည်ဆောက်ခြင်း (khittara.md ကို ထိပ်ဆုံးမှ ဦးစားပေးဖတ်ခိုင်းမည်)
    // ========================================================
    const masterInstruction = `
      [CORE SYSTEM PROTOCOL & USER GUIDELINES]
      မင်းသည် အောက်တွင် ပေးထားသော "khittara.md" ဖိုင်ထဲမှ လမ်းညွှန်ချက်များ၊ စည်းကမ်းချက်များနှင့် ဇာတ်ကောင်စရိုက် (Character Specs) များကို အဓိက အခြေခံ ဦးစားပေး (Priority No.1) အနေဖြင့် သေချာစွာ ဖတ်ရှုပြီး ၎င်းအတိုင်း တသွေမတိမ်း လိုက်နာရမည်။

      --- khittara.md START ---
      ${khittaraBrainContent}
      --- khittara.md END ---

      [၂D သမိုင်းကြောင်း ဒေတာစု (2D HISTORICAL DATASET)]
      မင်းရဲ့ "khittara.md" စည်းကမ်းချက်များအတိုင်း ၂D နှင့် ပတ်သက်၍ အချက်အလက်များ ဖြေကြားရန်အတွက် အောက်ပါ တရားဝင် JSON ဒေတာစုကိုသာ အခြေခံရမည်။ စိစစ်၍ မတွေ့ရှိပါက 'CLOSE' သို့မဟုတ် ဒေတာမရှိကြောင်းသာ ဖြေပါ။
      \`\`\`json
      ${historicalDataString}
      \`\`\`

      ${systemInstruction || ""}
    `.trim();

    const contents = messages.map(m => {
      return {
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      };
    });

    try {
      // ပြင်ဆင်ပြီးသား masterInstruction (Brain Content + 2D Data) ကို ထည့်သွင်းခေါ်ယူခြင်း
      return await this.executeCall(model, contents, masterInstruction);
    } catch (error: any) {
      console.error(`❌ Primary model (${model}) failed:`, error);
      
      const fallbackModel = "gemini-3-flash-preview";
      if (model !== fallbackModel) {
        try {
          console.log(`⚡ Falling back to ${fallbackModel}...`);
          return await this.executeCall(fallbackModel, contents, masterInstruction);
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
          temperature: 0.7,
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
