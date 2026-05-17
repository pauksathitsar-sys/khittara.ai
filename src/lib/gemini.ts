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

    // ==========================================
    // 2D HISTORICAL DATA FETCH LOGIC FOR GITHUB PAGES
    // ==========================================
    let historicalDataString = "[]";
    try {
      // GitHub Pages ရဲ့ root (သို့မဟုတ် public folder) ထဲက json ဖိုင်ကို လှမ်းဖတ်ခြင်း
      const dataResponse = await fetch('/2d_historical_data.json');
      if (dataResponse.ok) {
        const jsonData = await dataResponse.json();
        historicalDataString = JSON.stringify(jsonData);
      }
    } catch (fetchError) {
      console.warn("⚠️ Could not load 2d_historical_data.json automatically:", fetchError);
    }

    // Khittara AI ရဲ့ ပင်ကိုယ် Character နှင့် 2D ဒေတာများကို ပေါင်းစပ်ပြီး Master Instruction တည်ဆောက်ခြင်း
    const masterInstruction = `
      မင်းရဲ့အမည်က Khittara AI (ခေတ္တရာ အိုင်အေ) ဖြစ်သည်။ မင်းက မြန်မာနိုင်ငံမှ လူငယ်ဆော့ဖ်ဝဲလ်တီထွင်သူ မင်းသစ်စာအောင် (Min Thit Sar Aung) ဖန်တီးတည်ဆောက်ထားသော ခေတ်မီဆန်းသစ်သည့် AI Digital Assistant ဖြစ်သည်။
      
      [အရေးကြီးသော တာဝန်]
      အသုံးပြုသူက ၂D (သို့မဟုတ်) ထိုင်းစတော့အိတ်ချိန်း (SET Index) သမိုင်းကြောင်းဆိုင်ရာ အချက်အလက်များကို မေးမြန်းလာပါက အောက်တွင် ပေးထားသော JSON ဒေတာစုကိုသာ သေချာစွာ ကြည့်ရှုပြီး အမှန်ကန်ဆုံးနှင့် အတိကျဆုံး ပြန်လည်ဖြေကြားပေးပါ။
      ဂဏန်းအချက်အလက်များကို မသိပါက မှန်းဆပြီး ဉာဏ်ဆင်လိမ်လည်ဖြေကြားခြင်း လုံးဝ (လုံးဝ) မပြုလုပ်ရ။ ဒေတာထဲတွင် မပါရှိသောနေ့များ (ဥပမာ စနေ၊ တနင်္ဂနွေ နှင့် ရုံးပိတ်ရက်များ) မေးလာပါက 'CLOSE' သို့မဟုတ် ဒေတာမရှိကြောင်း သာ သေသပ်စွာ ဖြေကြားပါ။

      [၂D သမိုင်းကြောင်း ဒေတာစု (2D HISTORICAL DATASET)]
      ${historicalDataString}

      ${systemInstruction || ""}
    `.trim();

    const contents = messages.map(m => {
      return {
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      };
    });

    try {
      // ပြင်ဆင်ပြီးသား masterInstruction ကို ထည့်သွင်းခေါ်ယူခြင်း
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
          temperature: 0.7, // တိကျတဲ့ ဒေတာတွေဖြေရမှာမို့ temperature ကို 0.9 ကနေ 0.7 သို့ အနည်းငယ်လျှော့ချထားပါတယ်
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
