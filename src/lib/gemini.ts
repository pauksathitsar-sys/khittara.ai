import { GoogleGenAI } from "@google/genai";
import { Message, AIModel, Settings } from "../types";

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private settings: Settings | null = null;
  private onUsageReport?: (usage: any) => void;
  
  // 2D ဒေတာကို Request တိုင်း Fetch မလုပ်ရအောင် Memory ထဲတွင် ကြိုသိမ်းထားရန် Cache
  private cached2dData: any[] = [];

  constructor(settings: Settings, onUsageReport?: (usage: any) => void) {
    this.settings = settings;
    this.onUsageReport = onUsageReport;

    if (settings.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: settings.apiKey });
    }
    
    // Service စတင်ချိန်ကတည်းက ဒေတာကို နောက်ကွယ်ကနေ ကြိုဆွဲထားမည်
    this.preload2dData();
  }

  // GitHub မှ 2D Database ကို ကြိုတင်ဆွဲယူသိမ်းဆည်းပေးသည့် function
  private async preload2dData() {
    try {
      const response = await fetch('https://raw.githubusercontent.com/pauksathitsar-sys/khittara.ai/main/2d_historical_data.json');
      if (response.ok) {
        this.cached2dData = await response.json();
        console.log(`✅ Khittara Engine: 2D Historical Data preloaded successfully. (${this.cached2dData.length} records)`);
      }
    } catch (error) {
      console.warn("⚠️ Khittara Engine Warning: Could not preload 2D data:", error);
    }
  }

  // 503 Error ကြုံရပါက ခေတ္တစောင့်ဆိုင်းရန် Helper Function
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

    // (က) khittara.md (Core Brain) ဖိုင်ကို Fetch လုပ်ခြင်း
    let khittaraBrainContent = "";
    try {
      const brainResponse = await fetch('https://raw.githubusercontent.com/pauksathitsar-sys/khittara.ai/main/khittara.md');
      if (brainResponse.ok) {
        khittaraBrainContent = await brainResponse.text();
      }
    } catch (brainError) {
      console.warn("⚠️ Could not load khittara.md automatically:", brainError);
    }

    // ၂D ဒေတာကြီး မပါဝင်တော့သဖြင့် Token သက်သာပြီး ပေါ့ပါးသွားသော Master Instruction
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
      // ပင်မ Model ဖြင့် အရင်ခေါ်ယူကြည့်မည်
      return await this.executeCall(model, contents, masterInstruction);
    } catch (error: any) {
      console.error(`❌ Primary model (${model}) failed:`, error);
      
      // တကယ်လို့ 503 သို့မဟုတ် တခြား error တက်ရင် အလုပ်ဖြစ်နှုန်းအလွန်မြင့်သော ဗားရှင်းသို့ ပြောင်းမည်
      const fallbackModel = "gemini-1.5-flash";
      
      if (model !== fallbackModel) {
        try {
          console.log("⚡ Server busy or error encountered. Waiting 1.5 seconds before fallback...");
          await this.sleep(1500); // Server အား အနားပေးရန် ခေတ္တစောင့်ခြင်း
          
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
          // ========================================================
          // 💡 FUNCTION CALLING (TOOLS) DEFINITION
          // ========================================================
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

      // AI က ဒေတာရှာဖို့ Tool ခေါ်ရန် ဆုံးဖြတ်ခြင်း ရှိ၊ မရှိ စစ်ဆေးသည်
      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        
        if (call.name === "get_2d_historical_data") {
          const args = call.args as { search_query: string };
          console.log(`🤖 Khittara AI Called Tool: Searching 2D data for -> "${args.search_query}"`);
          
          // Local JSON Cache ထဲတွင် သွားရောက်ရှာဖွေသည်
          const functionResult = this.handle2dSearch(args.search_query);

          // ဒေတာရလဒ်အား SDK v2.2.0 စံနှုန်းအတိုင်း 'tool' role ဖြင့် AI ထံ ပြန်လည်ပေးပို့ခြင်း
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

  // ========================================================
  // 💡 LOCAL SEARCH LOGIC (JSON Cache ထဲတွင် လိုက်ရှာပေးသည့်အပိုင်း)
  // ========================================================
  private handle2dSearch(query: string): any {
    if (this.cached2dData.length === 0) {
      return { status: "error", message: "2D Historical Database is empty or not loaded yet." };
    }

    const lowerQuery = query.toLowerCase().trim();
    
    // JSON Dataset ထဲမှ ကိုက်ညီသော စာသား သို့မဟုတ် နေ့စွဲပါဝင်သည့် ရလဒ်များကို စစ်ထုတ်ခြင်း
    const filteredResults = this.cached2dData.filter((row: any) => {
      const rowString = JSON.stringify(row).toLowerCase();
      return rowString.includes(lowerQuery);
    });

    // Token Limits မကျော်စေရန်အတွက် အများဆုံး အပုဒ်ရေ ၃၀ သာ ကန့်သတ်၍ AI ထံ ပြန်ပေးမည်
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
