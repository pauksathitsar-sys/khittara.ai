import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Upload, Sparkles, AlertCircle, CheckCircle2, Loader2, Table as TableIcon, FileDown, Search, Database, Calculator } from 'lucide-react';
import { Settings } from '../types';
import { GeminiService } from '../lib/gemini';
import { translations, TranslationKeys } from '../lib/i18n';
import Markdown from 'react-markdown';

interface DataExtractorProps {
  settings: Settings;
}

const DataExtractor: React.FC<DataExtractorProps> = ({ settings }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[settings.language] as TranslationKeys;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError('File size too large (max 20MB)');
        return;
      }
      setSelectedFile(file);
      setError(null);
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      setError(t.data_extractor.select_file_first);
      return;
    }

    setIsExtracting(true);
    setError(null);
    setResult('');

    try {
      const gemini = new GeminiService(settings);
      
      const extractionPrompt = `
# ROLE
You are the "Data Extraction Engine" for Khittara AI. Your primary specialty is converting complex Thai Stock Market PDF documents and images into structured 2D lottery datasets for Excel export.

# OBJECTIVE
To accurately extract 2D lottery-related data from uploaded files (PDFs/Images) and format them into a clean, downloadable Excel-compatible structure.

# EXTRACTION LOGIC (TARGET DATA)
For every single date identified in the files, you MUST extract:
1. Date (YYYY-MM-DD format)
2. Day of the week
3. Morning Session (12:01 PM):
   - SET Index
   - Value
   - 2D Result Calculation:
     * Head: Last digit of Morning SET decimal.
     * Tail: Last digit of Morning Value whole number.
     * Result: [Head][Tail]
4. Evening Session (04:30 PM):
   - SET Index
   - Value
   - 2D Result Calculation:
     * Head: Last digit of Evening SET decimal.
     * Tail: Last digit of Evening Value whole number.
     * Result: [Head][Tail]

# RULES FOR ACCURACY
- DIGIT CALCULATION: Never round. Take the raw last digit of the decimal for SET, and the raw last digit of the whole part for Value.
- MARKET CLOSED: If a date is a weekend or Thai holiday, mark all data cells as "CLOSE".
- NO SUMMARIES: Do not provide descriptions. Provide ONLY the data table in Markdown format, AND a CSV-formatted code block below it for easy export.
- CHRONOLOGICAL ORDER: Sort all data from the earliest date to the latest date.
- DATA INTEGRITY: Ensure the "Value" and "SET" are mapped correctly to their respective session (Morning vs Evening).

# OUTPUT FORMAT (MANDATORY 8 COLUMNS)
Columns: [Date | Day | Morning_SET | Morning_Value | Morning_Result | Evening_SET | Evening_Value | Evening_Result]

# INTEGRATION REQUIREMENT
Provide the Markdown table first, then a separate CSV code block starting with \`\`\`csv.
`;

      const response = await gemini.analyzeImageAndPrompt(
        selectedFile,
        extractionPrompt,
        settings.preferredModel
      );

      if (!response) {
        throw new Error("Neural link failed to extract data. Please try a clearer file.");
      }

      setResult(response.trim());

      // Auto-sync to Knowledge Base
      const tableMatch = response.match(/(\| Date \|[\s\S]+?)(?=\n\n|\n```|$)/);
      if (tableMatch) {
        try {
          await fetch('/api/khittara/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableData: tableMatch[1].trim() })
          });
        } catch (syncErr) {
          console.error("Knowledge Base sync failed:", syncErr);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Khittara Extraction Link Interrupted');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExportXLSX = async () => {
    if (!result) return;
    setIsExporting(true);
    try {
      // Extract CSV part from the result
      const csvMatch = result.match(/```(?:csv)?\n([\s\S]*?)\n```/);
      const csvData = csvMatch ? csvMatch[1] : result;

      const response = await fetch('/api/vision/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: csvData,
          format: 'xlsx',
          filename: `Khittara_2D_Extract_${Date.now()}.xlsx`
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Khittara_2D_Extract_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Export service failed');
      }
    } catch (err: any) {
      console.error("Export failed:", err);
      setError(`Export Error: ${err.message || 'Connection lost'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto p-4 sm:p-8"
    >
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 ring-1 ring-cyan-500/20 relative">
            <Database size={24} />
            <motion.div 
              className="absolute -top-1 -right-1 w-3 h-3 bg-gold rounded-full border-2 border-black"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {t.data_extractor.title}
              <span className="text-[10px] uppercase tracking-widest bg-gold/20 text-gold px-2 py-0.5 rounded-full border border-gold/30">
                Extraction Engine v1.0
              </span>
            </h1>
            <p className="text-zinc-500 text-sm">{t.data_extractor.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="glass-zinc p-6 rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileSelect({ target: { files: [file] } } as any);
              }}
              className={`relative aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden ${
                selectedFile 
                  ? 'border-cyan-500/50 bg-cyan-500/5' 
                  : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-600 hover:bg-zinc-900/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,.pdf"
                className="hidden"
              />
              
              {filePreview ? (
                <img 
                  src={filePreview} 
                  alt="Preview" 
                  className="absolute inset-0 w-full h-full object-contain p-2" 
                />
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-3 text-cyan-400">
                  <FileText size={48} />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-600">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-400">{t.data_extractor.upload_zone}</p>
                    <p className="text-[10px] text-zinc-600 mt-1 uppercase">Supports PDF & Images (Max 20MB)</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-8 space-y-4">
              <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl">
                <div className="flex items-start gap-3">
                  <Calculator size={18} className="text-gold mt-1" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Extraction Protocol</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      {t.data_extractor.logic_note}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleExtract}
                disabled={isExtracting || !selectedFile}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all ${
                  isExtracting || !selectedFile
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-cyan-500 text-black hover:bg-white hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]'
                }`}
              >
                {isExtracting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{t.data_extractor.extracting}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>{t.data_extractor.extract_btn}</span>
                  </>
                )}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-[11px] text-red-500"
                >
                  <AlertCircle size={14} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-zinc flex-1 flex flex-col min-h-[500px] rounded-3xl border border-zinc-800 shadow-xl overflow-hidden relative">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${result ? 'bg-gold' : 'bg-zinc-700'} animate-pulse`} />
                <h3 className="font-bold text-sm text-zinc-300">Extraction Result</h3>
              </div>
              {result && (
                <button
                  onClick={handleExportXLSX}
                  disabled={isExporting}
                  className="flex items-center gap-2 text-[10px] font-bold text-gold bg-gold/10 px-3 py-1.5 rounded-lg border border-gold/30 hover:bg-gold hover:text-black transition-all"
                >
                  {isExporting ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                  Excel Export (.xlsx)
                </button>
              )}
            </div>

            <div className="flex-1 p-6 relative overflow-y-auto max-h-[600px] custom-scrollbar">
              <AnimatePresence mode="wait">
                {result ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-2xl"
                  >
                    <Markdown>{result}</Markdown>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 p-8 text-center"
                  >
                    <TableIcon size={48} className="mb-4 opacity-10" />
                    <p className="text-sm italic font-mono opacity-40 uppercase tracking-widest">Waiting for Data Stream</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {isExtracting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center z-10"
                >
                  <div className="relative">
                    <Loader2 size={40} className="text-gold animate-spin" />
                    <Sparkles size={16} className="absolute -top-1 -right-1 text-cyan-400 animate-pulse" />
                  </div>
                  <p className="mt-4 text-xs font-bold text-gold/80 tracking-widest uppercase animate-pulse">
                    Khittara Logic Core Processing...
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DataExtractor;
