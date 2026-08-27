import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  RotateCcw,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink,
  Check,
  FilePlus,
  ArrowDownToLine,
  RefreshCw,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { Note, ChatMessage } from '../types';
import { extractPlainSnippet } from '../utils/storage';
import { AnimatedAiIcon, AnimatedCopyIcon } from './AnimatedIcons';
import { GEMINI_KEY_STORAGE_KEY } from './ApiKeyModal';

interface AiAssistantPanelProps {
  activeNote: Note | null;
  onClose: () => void;
  onInsertIntoActiveNote?: (text: string) => void;
  onCreateNoteWithContent?: (title: string, content: string) => void;
  onOpenApiKeyModal?: () => void;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  activeNote,
  onClose,
  onInsertIntoActiveNote,
  onCreateNoteWithContent,
  onOpenApiKeyModal,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [insertedMessageId, setInsertedMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>('');

  // Local API Key state
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '';
  });
  const [isInlineKeyBoxOpen, setIsInlineKeyBoxOpen] = useState(false);
  const [inlineKeyInput, setInlineKeyInput] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, errorMessage]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync API key changes
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '';
      setApiKey(stored);
      if (stored) {
        setIsInlineKeyBoxOpen(false);
        setErrorMessage(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleCopy = (text: string, id: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedMessageId(id);
    setTimeout(() => {
      setCopiedMessageId((prev) => (prev === id ? null : prev));
    }, 1600);
  };

  const handleInsert = (text: string, id: string) => {
    if (onInsertIntoActiveNote) {
      onInsertIntoActiveNote(text);
      setInsertedMessageId(id);
      setTimeout(() => {
        setInsertedMessageId((prev) => (prev === id ? null : prev));
      }, 1600);
    }
  };

  const handleCreateNewNote = (text: string) => {
    if (onCreateNoteWithContent) {
      const lines = text.trim().split('\n');
      let title = 'ШІ Відповідь';
      if (lines.length > 0 && lines[0].replace(/^[#*\s-]+/, '').trim().length > 0) {
        title = lines[0].replace(/^[#*\s-]+/, '').trim().slice(0, 40);
      }
      onCreateNoteWithContent(title, text);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleClearChat = () => {
    handleStop();
    setMessages([]);
    setErrorMessage(null);
    setLastQuery('');
  };

  const handleSaveInlineKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inlineKeyInput.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem(GEMINI_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
    }
    setIsInlineKeyBoxOpen(false);
    setErrorMessage(null);
  };

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : input).trim();
    if (!query || isLoading) return;

    const currentKey = localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || apiKey || '';
    if (!currentKey) {
      setIsInlineKeyBoxOpen(true);
      setErrorMessage('Будь ласка, збережіть ваш API-ключ Gemini для початку роботи.');
      return;
    }

    setErrorMessage(null);
    setInput('');
    setLastQuery(query);

    const userMsgId = 'msg-' + Date.now() + '-user';
    const aiMsgId = 'msg-' + (Date.now() + 1) + '-ai';

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    const initialAiMessage: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
    };

    // Filter valid completed message history (exclude broken/empty ones)
    const validHistory = messages
      .filter((m) => m.content && m.content.trim().length > 0 && !m.content.startsWith('⚠️'))
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        content: m.content,
      }));

    validHistory.push({
      role: 'user',
      content: query,
    });

    setMessages((prev) => [...prev, userMessage, initialAiMessage]);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const activeNoteContext = activeNote
        ? {
            title: activeNote.title,
            contentSnippet: extractPlainSnippet(activeNote.content, 4000),
          }
        : undefined;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': currentKey,
        },
        body: JSON.stringify({
          messages: validHistory,
          activeNoteContext,
          customApiKey: currentKey,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          // ignore
        }
        let msg = errorData.error || `Помилка (${response.status}): ${response.statusText}`;
        try {
          const parsed = JSON.parse(msg);
          if (parsed?.error?.message) {
            msg = parsed.error.message;
          }
        } catch {}
        throw new Error(msg);
      }

      if (!response.body) {
        throw new Error('Отримано порожню відповідь від сервера.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;

          const dataStr = trimmedLine.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') {
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              accumulatedText += parsed.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMsgId ? { ...msg, content: accumulatedText } : msg
                )
              );
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (pErr: any) {
            if (pErr.message && !pErr.message.includes('JSON')) {
              throw pErr;
            }
          }
        }
      }

      // If finished with empty content
      if (!accumulatedText.trim()) {
        throw new Error('Отримано порожню відповідь від моделі. Спробуйте повторити.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.error('Chat error:', err);
      let errText = err?.message || 'Помилка генерації.';
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) {
          errText = parsed.error.message;
        }
      } catch {}

      setErrorMessage(errText);

      if (
        errText.toLowerCase().includes('ключ') ||
        errText.toLowerCase().includes('api_key') ||
        errText.toLowerCase().includes('api key') ||
        errText.toLowerCase().includes('401')
      ) {
        setIsInlineKeyBoxOpen(true);
      }

      // Remove the incomplete assistant bubble on error
      setMessages((prev) => prev.filter((msg) => msg.id !== aiMsgId));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="h-9 px-3 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-1.5 min-w-0 text-neutral-800">
          <AnimatedAiIcon isThinking={isLoading} className="w-3.5 h-3.5 text-neutral-800" />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Key Button */}
          <button
            type="button"
            onClick={() => {
              setInlineKeyInput(apiKey);
              setIsInlineKeyBoxOpen(!isInlineKeyBoxOpen);
            }}
            title={apiKey ? 'Змінити API-ключ Gemini' : 'Ввести API-ключ Gemini'}
            className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors cursor-pointer relative ${
              apiKey
                ? 'text-neutral-700 bg-neutral-100 hover:bg-neutral-200'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            {apiKey && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
            )}
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              title="Очистити історію"
              className="w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-600 hover:bg-red-50/60 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Key Setup */}
      {(isInlineKeyBoxOpen || !apiKey) && (
        <div className="p-2.5 bg-neutral-50 border-b border-neutral-200/80 animate-in fade-in slide-in-from-top-1 duration-150 shrink-0 space-y-2">
          <form onSubmit={handleSaveInlineKey} className="space-y-2">
            <div className="relative">
              <input
                type={showKeyText ? 'text' : 'password'}
                value={inlineKeyInput}
                onChange={(e) => setInlineKeyInput(e.target.value)}
                placeholder="Введіть API ключ (AIzaSy...)"
                autoFocus={!apiKey}
                className="w-full h-7 pl-3 pr-8 bg-white text-xs text-neutral-900 placeholder:text-neutral-400 border border-neutral-200 focus:border-neutral-900 rounded-full outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKeyText(!showKeyText)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                {showKeyText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 underline underline-offset-2"
              >
                <span>Отримати ключ</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>

              <div className="flex items-center gap-1.5">
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setInlineKeyInput('');
                      setApiKey('');
                      localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
                    }}
                    className="px-2 py-0.5 text-[11px] text-neutral-500 hover:text-red-600 rounded-full transition-colors cursor-pointer"
                  >
                    Видалити
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!inlineKeyInput.trim()}
                  className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white rounded-full text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  Зберегти
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 scrollbar-none select-text text-neutral-900">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-4 select-none opacity-25">
            <AnimatedAiIcon isThinking={false} className="w-5 h-5 text-neutral-400" />
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
              >
                <div
                  className={`max-w-[92%] px-3 py-2 text-xs leading-relaxed transition-all ${
                    isUser
                      ? 'bg-neutral-900 text-white rounded-2xl rounded-br-xs shadow-2xs'
                      : 'bg-neutral-50 border border-neutral-200/80 text-neutral-900 rounded-2xl rounded-tl-xs shadow-2xs'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.content ? (
                    <div className="prose prose-xs max-w-none text-neutral-900 text-xs space-y-1.5 leading-relaxed overflow-x-auto">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-neutral-400 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse delay-75" />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse delay-150" />
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
                {!isUser && msg.content && (
                  <div className="flex items-center gap-1 mt-1 px-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, msg.id)}
                      title="Скопіювати"
                      className="p-1 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      <AnimatedCopyIcon
                        isCopied={copiedMessageId === msg.id}
                        className="w-3 h-3"
                      />
                    </button>

                    {onInsertIntoActiveNote && activeNote && (
                      <button
                        type="button"
                        onClick={() => handleInsert(msg.content, msg.id)}
                        title="Вставити в нотатку"
                        className="p-1 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        {insertedMessageId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <ArrowDownToLine className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    {onCreateNoteWithContent && (
                      <button
                        type="button"
                        onClick={() => handleCreateNewNote(msg.content)}
                        title="Створити нову нотатку"
                        className="p-1 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <FilePlus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {errorMessage && (
          <div className="p-2.5 bg-red-50/90 border border-red-200/80 rounded-2xl flex items-start justify-between gap-2 text-xs text-red-700 animate-in fade-in duration-150">
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-snug break-words">{errorMessage}</p>
            </div>
            {lastQuery && (
              <button
                type="button"
                onClick={() => sendMessage(lastQuery)}
                disabled={isLoading}
                title="Повторити запит"
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-red-100/50 border border-red-200 rounded-full text-[10px] font-semibold text-red-700 transition-colors cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Повторити</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input */}
      <div className="p-2 border-t border-neutral-100 bg-white shrink-0">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Повідомлення..."
            className="w-full h-7 pl-3 pr-8 bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white text-xs text-neutral-900 placeholder:text-neutral-400 border border-neutral-200 focus:border-neutral-900 rounded-full outline-none transition-colors disabled:opacity-50"
          />

          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              title="Зупинити генерацію"
              className="absolute right-1 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer shadow-2xs"
            >
              <Square className="w-2 h-2 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              title="Надіслати"
              className="absolute right-1 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 transition-all cursor-pointer shadow-2xs"
            >
              <Send className="w-2.5 h-2.5 stroke-[2.2]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
