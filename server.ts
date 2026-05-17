import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import { GoogleGenerativeAI } from "@google/generative-ai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const BRAIN_FILE = path.join(process.cwd(), 'khittara.md');
  const VIDEO_LOG_FILE = path.join(process.cwd(), 'video_logs.md');
  const IMAGE_LOG_FILE = path.join(process.cwd(), 'image_logs.md');
  // ၂ဒီ သမိုင်းကြောင်း JSON ဖိုင်လမ်းကြောင်း သတ်မှတ်ခြင်း
  const HISTORICAL_2D_FILE = path.join(process.cwd(), '2d_historical_data.json');

  // Initialize video_logs.md if not exists
  try {
    await fs.access(VIDEO_LOG_FILE);
  } catch {
    await fs.writeFile(VIDEO_LOG_FILE, "# Khittara Video Generation Logs\n\n| Date | Prompt | Result URL | Metadata |\n| --- | --- | --- | --- |\n", 'utf-8');
  }

  // Initialize image_logs.md if not exists
  try {
    await fs.access(IMAGE_LOG_FILE);
  } catch {
    await fs.writeFile(IMAGE_LOG_FILE, "# Khittara Image Generation Logs\n\n| Date | Prompt | Aspect Ratio | Metadata |\n| --- | --- | --- | --- |\n", 'utf-8');
  }

  app.use(cors());
  app.use(express.json());

  // Helper for Markdown table or CSV parsing
  const parseDataForExcel = (data: string) => {
    const lines = data.trim().split('\n');
    if (lines.some(l => l.includes('|'))) {
      return lines
        .filter(line => line.includes('|') && !line.includes('---'))
        .map(line => 
          line.split('|')
              .map(cell => cell.trim())
              .filter(cell => cell !== '')
        );
    }
    return lines.map(line => line.split(',').map(cell => cell.trim()));
  };

  // Global health tracker
  let apiStats = {
    totalTokens: 0,
    dailyTokens: 0,
    requestCount: 0,
    dailyRequests: 0,
    totalLatency: 0,
    tier: 'Unknown' as 'Free' | 'Pay-as-you-go' | 'Unknown',
    lastReset: new Date().toISOString().split('T')[0],
    videoUsage: 0,
    musicUsage: 0
  };

  app.post('/api/usage/report', (req, res) => {
    const { totalTokens, latency, type } = req.body;
    const today = new Date().toISOString().split('T')[0];

    if (apiStats.lastReset !== today) {
      apiStats.dailyTokens = 0;
      apiStats.dailyRequests = 0;
      apiStats.videoUsage = 0;
      apiStats.musicUsage = 0;
      apiStats.lastReset = today;
    }

    apiStats.totalTokens += totalTokens || 0;
    apiStats.dailyTokens += totalTokens || 0;
    apiStats.requestCount += 1;
    apiStats.dailyRequests += 1;
    apiStats.totalLatency += latency || 0;

    if (type === 'video') apiStats.videoUsage += 1;
    if (type === 'music') apiStats.musicUsage += 1;

    res.json({ success: true });
  });

  app.get('/api/usage/stats', (req, res) => {
    const LIMIT_RPM = apiStats.tier === 'Pay-as-you-go' ? Infinity : 1500;
    res.json({
      tier: apiStats.tier,
      totalTokensUsed: apiStats.totalTokens,
      tokensToday: apiStats.dailyTokens,
      requestsToday: apiStats.dailyRequests,
      remainingRequests: Math.max(0, LIMIT_RPM - apiStats.dailyRequests),
      avgLatency: apiStats.requestCount > 0 ? Math.round(apiStats.totalLatency / apiStats.requestCount) : 0,
      status: 'Active',
      videoUsage: apiStats.videoUsage,
      musicUsage: apiStats.musicUsage
    });
  });

  app.post('/api/usage/check-key', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'No key provided' });

    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview?key=${apiKey}`;
      const response = await axios.get(testUrl);
      apiStats.tier = 'Free';
      res.json({ tier: apiStats.tier, status: 'Active' });
    } catch (err: any) {
      res.json({ tier: 'Unknown', status: 'Invalid', error: err.message });
    }
  });

  // ==========================================
  // အသစ်ထည့်သွင်းထားသော GEMINI CHAT ENDPOINT (ဒေတာအမှန်ဖြေနိုင်ရန်)
  // ==========================================
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, apiKey } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });
      if (!apiKey) return res.status(400).json({ error: "API Key is required" });

      // ၁။ 2d_historical_data.json ဖိုင်ကို Backend ကနေ လှမ်းဖတ်ပါမယ်
      let historical2dData = "[]";
      try {
        historical2dData = await fs.readFile(HISTORICAL_2D_FILE, 'utf-8');
      } catch (e) {
        console.log("Historical 2D file not found, using empty array.");
      }

      // ၂။ Gemini API ကို ချိတ်ဆက်ပါတယ်
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      // ၃။ System Prompt ထဲမှာ 2D Dataset ကို ထည့်သွင်းပြီး Content မျိုးဆက်ပေးပါတယ်
      const systemInstruction = `
        မင်းရဲ့အမည်က Khittara AI (ခေတ္တရာ အိုင်အေ) ဖြစ်သည်။ မင်းက မြန်မာနိုင်ငံက တီထွင်သူ Min Thit Sar Aung ဖန်တီးထားတဲ့ AI Assistant ဖြစ်သည်။
        အသုံးပြုသူက ၂D (သို့မဟုတ်) ထိုင်းစတော့အိတ်ချိန်း (SET Index) သမိုင်းကြောင်းဆိုင်ရာ အချက်အလက်များကို မေးမြန်းပါက 
        အောက်တွင် ပေးထားသော JSON ဒေတာစုကို သေချာစွာ ကြည့်ရှုပြီး အမှန်ကန်ဆုံးနှင့် အတိကျဆုံး ပြန်လည်ဖြေကြားပေးပါ။
        ဂဏန်းအချက်အလက်များကို မှန်းဆပြီး လိမ်မဖြေပါနှင့်။

        [၂D သမိုင်းကြောင်း ဒေတာစု (2D HISTORICAL DATASET)]
        ${historical2dData}
      `;

      const startTime = Date.now();
      
      // AI ထံ မက်ဆေ့ခ်ျ ပို့ခြင်း
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemInstruction }] },
          { role: 'model', parts: [{ text: "ဟုတ်ကဲ့ပါဗျာ။ ကျွန်တော် ခေတ္တရာ AI ဖြစ်ပါတယ်။ ပေးထားတဲ့ ၂D သမိုင်းကြောင်း ဒေတာစုကို အခြေခံပြီး တိကျမှန်ကန်စွာ ဖြေကြားပေးသွားပါ့မယ်။" }] }
        ]
      });

      const response = await chat.sendMessage(message);
      const replyText = response.response.text();
      const latency = Date.now() - startTime;

      // ၄။ Usage Report ကိုလည်း အလိုအလျောက် သွားပေါင်းထည့်ပေးပါတယ်
      // Free Tier အတွက် Token ခန့်မှန်းခြေ တွက်ချက်ခြင်း (စာလုံးအရှည်အလိုက်)
      const inputTokens = Math.ceil((systemInstruction.length + message.length) / 4);
      const outputTokens = Math.ceil(replyText.length / 4);
      const totalTokens = inputTokens + outputTokens;

      apiStats.totalTokens += totalTokens;
      apiStats.dailyTokens += totalTokens;
      apiStats.requestCount += 1;
      apiStats.dailyRequests += 1;
      apiStats.totalLatency += latency;

      res.json({ reply: replyText });

    } catch (error: any) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: "AI တုံ့ပြန်မှု ယူရာတွင် အမှားအယွင်းရှိနေပါသည်", details: error.message });
    }
  });

  // API Routes
  app.post('/api/vision/export', async (req, res) => {
    try {
      const { data, format, filename } = req.body;
      if (!data) return res.status(400).json({ error: 'No data provided for export' });
      const cleanData = String(data).replace(/```[a-z]*\n|```/g, '').trim();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalFilename = filename || `VisionCore_Export_${timestamp}.${format}`;

      if (format === 'csv' || format === 'xlsx') {
        const tableData = parseDataForExcel(cleanData);
        const ws = XLSX.utils.aoa_to_sheet(tableData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vision_Extract");

        if (format === 'csv') {
          const csv = XLSX.utils.sheet_to_csv(ws);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=${finalFilename}`);
          return res.send(csv);
        } else {
          const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=${finalFilename}`);
          res.send(buffer);
          return;
        }
      }

      if (format === 'pdf') {
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${finalFilename}`);
        doc.pipe(res);
        doc.fontSize(16).text('Vision Core Extraction Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
        doc.moveDown();
        doc.fontSize(12).text(cleanData);
        doc.end();
        return;
      }

      if (format === 'md') {
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename=${finalFilename}`);
        res.send(cleanData);
        return;
      }

      if (format === 'html') {
        const tableData = parseDataForExcel(cleanData);
        let htmlRows = tableData.map(row => `<tr>${row.map(cell => `<td style="border:1px solid #ddd;padding:8px">${cell}</td>`).join('')}</tr>`).join('');
        const html = `
          <html>
            <body style="font-family:sans-serif;padding:20px">
              <h2 style="color:#22d3ee">Vision Core Export</h2>
              <table style="border-collapse:collapse;width:100%">${htmlRows}</table>
              <p style="font-size:10px;color:#888;margin-top:20px">Generated by Khittara AI</p>
            </body>
          </html>
        `;
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename=${finalFilename}`);
        res.send(html);
        return;
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=${finalFilename}`);
      res.send(cleanData);

    } catch (error: any) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to generate export file', errorMsg: error.message || 'Unknown export error' });
    }
  });

  app.get('/api/second-brain', async (req, res) => {
    try {
      const content = await fs.readFile(BRAIN_FILE, 'utf-8');
      res.json({ content });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to read Second Brain', errorMsg: error.message || 'IO error' });
    }
  });

  app.post('/api/second-brain/log', async (req, res) => {
    try {
      const { sessionData } = req.body;
      const content = await fs.readFile(BRAIN_FILE, 'utf-8');
      const logEntry = `\n* **Session (${new Date().toLocaleString()}):** ${sessionData}\n`;
      const targetSection = '## ၉။ Live Neural Streams (Real-time Feeds)';
      const parts = content.split(targetSection);
      
      if (parts.length === 2) {
        const newContent = parts[0] + targetSection + logEntry + parts[1];
        await fs.writeFile(BRAIN_FILE, newContent, 'utf-8');
        res.json({ success: true });
      } else {
        await fs.appendFile(BRAIN_FILE, logEntry, 'utf-8');
        res.json({ success: true });
      }
    } catch (error: any) {
      console.error('Logging error:', error);
      res.status(500).json({ error: 'Failed to log to Second Brain', errorMsg: error.message || 'Log write error' });
    }
  });

  app.post('/api/second-brain/sync', async (req, res) => {
    try {
      const { content: newEntry } = req.body;
      if (!newEntry) return res.status(400).json({ error: 'No content provided for sync' });
      let content = '';
      try {
        content = await fs.readFile(BRAIN_FILE, 'utf-8');
      } catch (e) {
        content = '# Khittara AI Second Brain\n';
      }
      
      const timestamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const formattedEntry = `\n### [${timestamp}] - Memory Sync\n${String(newEntry)}\n\n---\n`;
      const targetHeader = '## ၁၁။ Memory Stream (Daily Logs & Highlights)';
      
      if (content.includes(targetHeader)) {
        const parts = content.split(targetHeader);
        const updatedContent = parts[0] + targetHeader + formattedEntry + parts[1];
        await fs.writeFile(BRAIN_FILE, updatedContent, 'utf-8');
      } else {
        const archiveMark = '**ARCHIVE STATUS:**';
        if (content.includes(archiveMark)) {
          const parts = content.split(archiveMark);
          const updatedContent = parts[0] + '\n---\n\n' + targetHeader + formattedEntry + '\n' + archiveMark + parts[1];
          await fs.writeFile(BRAIN_FILE, updatedContent, 'utf-8');
        } else {
          await fs.appendFile(BRAIN_FILE, '\n---\n\n' + targetHeader + formattedEntry, 'utf-8');
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Sync error:', error);
      res.status(500).json({ error: 'Failed to sync to Second Brain', errorMsg: error.message || 'Sync write error' });
    }
  });
  
  app.post('/api/khittara/sync', async (req, res) => {
    try {
      const { tableData } = req.body;
      if (!tableData) return res.status(400).json({ error: 'No table data provided for sync' });
      let content = await fs.readFile(BRAIN_FILE, 'utf-8');
      const targetHeader = '## 2D Historical Logs';
      const cleanTable = String(tableData).replace(/```markdown\n|```/g, '').trim();
      const logEntry = `\n\n### Batch Sync: ${new Date().toLocaleDateString()}\n${cleanTable}\n`;

      if (content.includes(targetHeader)) {
        const parts = content.split(targetHeader);
        const updatedContent = parts[0] + targetHeader + logEntry + parts[1];
        await fs.writeFile(BRAIN_FILE, updatedContent, 'utf-8');
      } else {
        await fs.appendFile(BRAIN_FILE, `\n\n--- \n\n${targetHeader}${logEntry}`, 'utf-8');
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Khittara Sync error:', error);
      res.status(500).json({ error: 'Failed to sync to Khittara Knowledge Base', errorMsg: error.message || 'Sync write error' });
    }
  });

  app.post('/api/video/log', async (req, res) => {
    try {
      const { prompt, resultUrl, metadata } = req.body;
      const logEntry = `| ${new Date().toLocaleString()} | ${prompt.replace(/\|/g, '\\|')} | ${resultUrl} | ${JSON.stringify(metadata)} |\n`;
      await fs.appendFile(VIDEO_LOG_FILE, logEntry, 'utf-8');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Video log error:', error);
      res.status(500).json({ error: 'Failed to log video metadata' });
    }
  });

  app.post('/api/image/log', async (req, res) => {
    try {
      const { prompt, aspectRatio, metadata } = req.body;
      const logEntry = `| ${new Date().toLocaleString()} | ${prompt.replace(/\|/g, '\\|')} | ${aspectRatio} | ${JSON.stringify(metadata)} |\n`;
      await fs.appendFile(IMAGE_LOG_FILE, logEntry, 'utf-8');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Image log error:', error);
      res.status(500).json({ error: 'Failed to log image metadata' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
      logLevel: 'error',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
