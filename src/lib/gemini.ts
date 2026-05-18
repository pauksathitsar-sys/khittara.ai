import { GoogleGenAI } from "@google/genai";
import { Message, AIModel, Settings } from "../types";

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private settings: Settings | null = null;
  private onUsageReport?: (usage: any) => void;
  
  // 2D ဒေတာကို တစ်ခါပဲ ဆွဲရန်နှင့် သိမ်းထားရန် Cache
  private cached2dData: any[] = [];
  private isDataLoading: boolean = false;

  constructor(settings: Settings, onUsageReport?: (usage: any) => void) {
    this.settings = settings;
    this.onUsageReport = onUsageReport;

    if (settings.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: settings.apiKey });
    }
    // 💡 UI အဖြူရောင် မဖြစ်စေရန် Constructor ထဲတွင် fetch ခေါ်ခြင်းကို လုံးဝ ဖြုတ်လိုက်ပါပြီ။
  }

  // လိုအပ်မှသာ နောက်ကွယ်ကနေ ဝင်ဆွဲပေးမည့် ဘေးကင်းသော Function
  private async ensure2dDataLoaded() {
    if (this.cached2dData.length > 0 || this.isDataLoading) return;
    
    this.isDataLoading = true;
    try {
      const response = await fetch('https://raw.githubusercontent.com/pauksathitsar-sys/khittara.ai/main/2d_historical_data.json', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });
      if (response.ok) {
        this.cached2dData = await response.json();
        console.log(`✅ 2D Data Loaded: ${this.cached2dData.length} records.`);
      }
    } catch (error) {
      console.warn("⚠️ 2D Data prefetch failed safely:", error);
    } finally {
      this.isDataLoading = false;
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendMessage(
    messages: Message[],
    systemInstruction?: string,
    model: AIModel = "gemini-3-flash-preview"
  ): Promise<string> {
    if (!this.ai) {
      return "Critical failure: AI Core not initialized. Check your API key in Settings.";
    }

    // မက်ဆေ့ခ်ျ ပို့ခါနီးမှ နောက်ကွယ်ကနေ 2D ဒေတာကို လှမ်းဆွဲခိုင်းခြင်း (App မပိတ်စေရန်)
    this.ensure2dDataLoaded().catch(() => {});

    // khittara.md (Core Brain) ကို Fetch လုပ်ခြင်း
    let khittaraBrainContent = "";
    try {
      const brainResponse = await fetch('https://raw.githubusercontent.com/pauksathitsar-sys/khittara.ai/main/khittara.md');
      if (brainResponse.ok) {
        khittaraBrainContent = await brainResponse.text();
      }
    } catch (brainError) {
      console.warn("⚠️ Could not load khittara.md automatically:", brainError);
    }

    const masterInstruction = `
      [CORE SYSTEM PROTOCOL]
      မင်းသည် အောက်တွင် ပေးထားသော "khittara.md" ဖိုင်ထဲမှ လမ်းညွှန်ချက်များ၊ စည်းကမ်းချက်များနှင့် ဇာတ်ကောင်စရိုက် (Character Specs) များကို အဓိက အခြေခံ ဦးစားပေး (Priority No.1) အနေဖြင့် သေချာစွာ ဖတ်ရှုပြီး ၎င်းအတိုင်း တသွေမတိမ်း လိုက်နာရမည်။

      --- khittara.md START ---
      ${khittaraBrainContent}
      --- khittara.md END ---

      ${systemInstruction || ""}
    `.trim();

    const contents = messages.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));

    try {
      return await this.executeCall(model, contents, masterInstruction);
    } catch (error: any) {
      console.error(`❌ Primary model (${model}) failed:`, error);
      
      const fallbackModel = "gemini-1.5-flash";
      if (model !== fallbackModel) {
        try {
          console.log("⚡ Server busy. Waiting 1.5 seconds before fallback...");
          await this.sleep(1500);
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
          tools: [{
            functionDeclarations: [
              {
                name: "get_2d_historical_data",
                description: "အသုံးပြုသူမှ ၂D သမိုင်းကြောင်း၊ ကိန်းဂဏန်းများ သို့မဟုတ် ရက်စွဲအလိုက် ထွက်ဂဏန်းများကို မေးမြန်းလာပါက ဤ database tool ကို သုံး၍ ရှာဖွေရမည်။",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    search_query: {
                      type: "STRING",
                      description: "ရှာဖွေလိုသော နေ့စွဲ၊ နေ့ရက် သို့မဟုတ် လအမည် (ဥပမာ- '2026-05-18', '2025-12', 'Monday')"
                    }
                  },
                  required: ["search_query"]
                }
              }
            ]
          }]
        }
      });

      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        
        if (call.name === "get_2d_historical_data") {
          const args = call.args as { search_query: string };
          console.log(`🤖 Tool Called: "${args.search_query}"`);
          
          // အကယ်၍ ဒေတာမရှိသေးရင် ချက်ချင်း ဝင်ဆွဲခိုင်းပြီးမှ ရှာမည်
          if (this.cached2dData.length === 0) {
            await this.ensure2dDataLoaded().catch(() => {});
          }

          const functionResult = this.handle2dSearch(args.search_query);

          const secondResponse = await this.ai.models.generateContent({
            model: modelName,
            contents: [
              ...contents,
              { role: "model", parts: [{ functionCall: call }] },
              {
                role: "tool", 
                parts: [{
                  functionResponse: {
                    name: call.name,
                    response: functionResult
                  }
                }]
              }
            ],
            config: { systemInstruction }
          });

          this.trackUsage(modelName, secondResponse, startTime);
          return secondResponse.text || "No response generated after database lookup.";
        }
      }

      this.trackUsage(modelName, response, startTime);
      return response.text || "No response received.";
    } catch (error) {
      throw error;
    }
  }

  private handle2dSearch(query: string): any {
    if (this.cached2dData.length === 0) {
      return { status: "error", message: "2D Historical Database is currently empty or loading. Please ask again in a moment." };
    }

    const lowerQuery = query.toLowerCase().trim();
    const filteredResults = this.cached2dData.filter((row: any) => {
      const rowString = JSON.stringify(row).toLowerCase();
      return rowString.includes(lowerQuery);
    });

    return {
      status: "success",
      search_query: query,
      total_matches_found: filteredResults.length,
      results: filteredResults.slice(0, 30) 
    };
  }

  private trackUsage(modelName: string, response: any, startTime: number) {
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
  }

  async analyzeImageAndPrompt(
    imageFile: File,
    promptText: string,
    model: AIModel = "gemini-3-flash-preview"
  ): Promise<string> {
    if (!this.ai) return "Critical failure: AI Core not initialized.";
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
      this.trackUsage(model, response, startTime);
      return response.text || "No analysis generated.";
    } catch (error: any) {
      return `Error: ${error.message || "Failed to analyze image."}`;
    }
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
