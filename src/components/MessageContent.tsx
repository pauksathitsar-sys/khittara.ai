import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, FileIcon, ImageIcon } from 'lucide-react';
import { Attachment } from '../types';
import { cn } from '../lib/utils';

interface MessageContentProps {
  content: string;
  attachments?: Attachment[];
  role: 'user' | 'assistant';
}

export const MessageContent: React.FC<MessageContentProps> = ({ content, attachments, role }) => {
  return (
    <div className="space-y-4">
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att, i) => (
            <AttachmentPreview key={i} attachment={att} />
          ))}
        </div>
      )}
      
      <div className={cn(
        "prose prose-sm max-w-none transition-all",
        role === 'user' ? "text-zinc-950 font-bold" : "text-zinc-200 theme-light:text-zinc-800 theme-dark:text-zinc-200 theme-dark:prose-invert"
      )}>
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const lang = match ? match[1] : '';
              
              if (!inline && lang) {
                return <CodeBlock language={lang} value={String(children).replace(/\n$/, '')} />;
              }
              
              return (
                <code className={cn("bg-zinc-800/50 theme-light:bg-zinc-200/50 theme-dark:bg-zinc-800/50 px-1.5 py-0.5 rounded text-gold font-mono", className)} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

const AttachmentPreview: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-zinc-800/50 bg-zinc-900/50 theme-light:bg-zinc-100 theme-dark:bg-zinc-900/50">
      {attachment.type === 'image' ? (
        <div className="flex flex-col">
          <img src={attachment.url} alt={attachment.name} className="max-w-[200px] max-h-[150px] object-cover" />
          <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] text-zinc-500 truncate max-w-[200px]">
             <ImageIcon size={10} />
             {attachment.name}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2 min-w-[140px]">
          <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center text-gold">
            <FileIcon size={16} />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium truncate max-w-[120px]">{attachment.name}</span>
            <span className="text-[10px] text-zinc-500 uppercase">{attachment.mimeType.split('/')[1]}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-zinc-800 theme-light:border-zinc-200 theme-dark:border-zinc-800 bg-zinc-950 theme-light:bg-zinc-50 theme-dark:bg-zinc-950 shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 theme-light:bg-zinc-100 theme-dark:bg-zinc-900/50 border-b border-zinc-800 theme-light:border-zinc-200 theme-dark:border-zinc-800">
        <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-zinc-800 theme-light:hover:bg-zinc-200 theme-dark:hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-gold"
          title="Copy to clipboard"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <pre className="m-0 font-mono text-xs leading-relaxed">
          <code className={cn("language-" + language, "text-zinc-300 theme-light:text-zinc-700 theme-dark:text-zinc-300")}>
            {value}
          </code>
        </pre>
      </div>
    </div>
  );
};
