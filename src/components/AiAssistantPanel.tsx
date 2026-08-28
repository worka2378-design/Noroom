import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ChevronLeft,
  FilePlus,
  KeyRound,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  WandSparkles,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { ChatMessage, Note } from '../types';
import { extractPlainSnippet } from '../utils/storage';
import { AnimatedAiIcon, AnimatedCopyIcon } from './AnimatedIcons';
import { GEMINI_KEY_CHANGED_EVENT, GEMINI_KEY_STORAGE_KEY } from './ApiKeyModal';

interface AiAssistantPanelProps {
  activeNote: Note | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onClose: () => void;
  onInsertIntoActiveNote?: (text: string) => void;
  onCreateNoteWithContent?: (title: string, content: string) => void;
  onOpenApiKeyModal?: () => void;
}

const NOTE_ACTIONS = [
  {
    label: 'Стисло підсумуй',
    prompt: 'Стисло підсумуй поточну нотатку. Збережи ключові факти й висновки.',
    icon: Sparkles,
  },
  {
    label: 'Наведи лад у тексті',
    prompt: 'Перебудуй поточну нотатку в чітку структуру із заголовками та списками. Не втрачай зміст.',
    icon: WandSparkles,
  },
  {
    label: 'Виділи наступні кроки',
    prompt: 'Знайди в поточній нотатці конкретні наступні кроки та подай їх коротким списком.',
    icon: ListChecks,
  },
];

const GENERAL_ACTIONS = [
  {
    label: 'Допоможи скласти план',
    prompt: 'Допоможи скласти короткий практичний план. Спочатку запитай, для якої мети він потрібен.',
    icon: ListChecks,
  },
  {
    label: 'Розвинути ідею',
    prompt: 'Допоможи розвинути ідею. Спочатку постав одне уточнювальне запитання.',
    icon: Sparkles,
  },
];

function copyText(text: string): void {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}

function responseTitle(text: string): string {
  const firstMeaningfulLine = text
    .split('\n')
    .map((line) => line.replace(/^[#>*\s-]+/, '').replace(/[*_`]/g, '').trim())
    .find(Boolean);

  return (firstMeaningfulLine || 'Відповідь Gemini').slice(0, 60);
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  activeNote,
  messages,
  setMessages,
  onClose,
  onInsertIntoActiveNote,
  onCreateNoteWithContent,
  onOpenApiKeyModal,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [insertedMessageId, setInsertedMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '');
  const [serverHasApiKey, setServerHasApiKey] = useState<boolean | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeResponseIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const syncStoredKey = useCallback(() => {
    setApiKey(localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '');
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setServerHasApiKey(Boolean(data?.hasGeminiKey)))
      .catch((error) => {
        if (error?.name !== 'AbortError') setServerHasApiKey(false);
      });

    window.addEventListener('storage', syncStoredKey);
    window.addEventListener(GEMINI_KEY_CHANGED_EVENT, syncStoredKey);

    return () => {
      controller.abort();
      window.removeEventListener('storage', syncStoredKey);
      window.removeEventListener(GEMINI_KEY_CHANGED_EVENT, syncStoredKey);
    };
  }, [syncStoredKey]);

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
  }, [messages, isLoading, errorMessage]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = '40px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [input]);

  const handleCopy = (text: string, id: string) => {
    copyText(text);
    setCopiedMessageId(id);
    window.setTimeout(() => {
      setCopiedMessageId((previous) => (previous === id ? null : previous));
    }, 1600);
  };

  const handleInsert = (text: string, id: string) => {
    if (!onInsertIntoActiveNote) return;
    onInsertIntoActiveNote(text);
    setInsertedMessageId(id);
    window.setTimeout(() => {
      setInsertedMessageId((previous) => (previous === id ? null : previous));
    }, 1600);
  };

  const handleCreateNewNote = (text: string) => {
    onCreateNoteWithContent?.(responseTitle(text), text);
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const activeResponseId = activeResponseIdRef.current;
    if (activeResponseId) {
      setMessages((previous) =>
        previous.filter((message) => message.id !== activeResponseId || message.content.trim())
      );
    }

    activeResponseIdRef.current = null;
    setIsLoading(false);
  };

  const handleClearChat = () => {
    handleStop();
    setMessages([]);
    setErrorMessage(null);
    setLastQuery('');
  };

  const checkServerKey = async (): Promise<boolean> => {
    if (serverHasApiKey !== null) return serverHasApiKey;

    try {
      const response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
      const data = response.ok ? await response.json() : null;
      const hasKey = Boolean(data?.hasGeminiKey);
      setServerHasApiKey(hasKey);
      return hasKey;
    } catch {
      setServerHasApiKey(false);
      return false;
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim().slice(0, 6000);
    if (!query || isLoading) return;

    const currentKey = localStorage.getItem(GEMINI_KEY_STORAGE_KEY)?.trim() || apiKey.trim();
    const canUseServerKey = currentKey ? true : await checkServerKey();

    if (!currentKey && !canUseServerKey) {
      setErrorMessage('Підключіть API-ключ Gemini, щоб почати розмову.');
      onOpenApiKeyModal?.();
      return;
    }

    setErrorMessage(null);
    setInput('');
    setLastQuery(query);

    const timestamp = Date.now();
    const userMessage: ChatMessage = {
      id: `msg-${timestamp}-user`,
      role: 'user',
      content: query,
      timestamp,
    };
    const assistantMessage: ChatMessage = {
      id: `msg-${timestamp}-assistant`,
      role: 'assistant',
      content: '',
      timestamp: timestamp + 1,
    };

    const history = messages
      .filter((message) => message.content.trim() && !message.content.startsWith('⚠️'))
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        content: message.content,
      }));
    history.push({ role: 'user', content: query });

    setMessages((previous) => [...previous, userMessage, assistantMessage]);
    setIsLoading(true);
    activeResponseIdRef.current = assistantMessage.id;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const activeNoteContext = activeNote
        ? {
            title: activeNote.title,
            contentSnippet: extractPlainSnippet(activeNote.content, 12000),
          }
        : undefined;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentKey) headers['x-gemini-api-key'] = currentKey;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: history, activeNoteContext }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Не вдалося виконати запит (${response.status}).`);
      }
      if (!response.body) throw new Error('Gemini повернув порожню відповідь.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';

      const consumeLine = (line: string) => {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith('data:')) return;
        const payload = trimmedLine.replace(/^data:\s*/, '').trim();
        if (!payload || payload === '[DONE]') return;

        let parsed: { text?: string; error?: string };
        try {
          parsed = JSON.parse(payload);
        } catch {
          return;
        }

        if (parsed.error) throw new Error(parsed.error);
        if (!parsed.text) return;

        accumulatedText += parsed.text;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: accumulatedText }
              : message
          )
        );
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(consumeLine);
        if (done) break;
      }
      if (buffer.trim()) consumeLine(buffer);
      if (!accumulatedText.trim()) throw new Error('Gemini повернув порожню відповідь. Спробуйте ще раз.');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setMessages((previous) =>
          previous.filter(
            (message) => message.id !== assistantMessage.id || message.content.trim()
          )
        );
        return;
      }

      const message = error?.message || 'Не вдалося отримати відповідь Gemini.';
      setErrorMessage(message);
      setMessages((previous) =>
        previous.filter(
          (item) => item.id !== assistantMessage.id || item.content.trim()
        )
      );

      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.includes('ключ') ||
        normalizedMessage.includes('api_key') ||
        normalizedMessage.includes('api key') ||
        normalizedMessage.includes('401')
      ) {
        onOpenApiKeyModal?.();
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      activeResponseIdRef.current = null;
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const quickActions = activeNote ? NOTE_ACTIONS : GENERAL_ACTIONS;
  const hasCredentials = Boolean(apiKey) || serverHasApiKey === true;

  return (
    <div id="ai-assistant-panel" className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-neutral-900">
      <header className="flex min-h-14 shrink-0 items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          title="Повернутися до бібліотеки"
          aria-label="Повернутися до бібліотеки"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
            <AnimatedAiIcon isThinking={isLoading} className="h-3.5 w-3.5" />
            <span>Gemini</span>
          </div>
          <p className="truncate text-[10px] text-neutral-400">
            {activeNote ? activeNote.title || 'Поточна нотатка без назви' : 'Помічник для ваших нотаток'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenApiKeyModal}
          title={hasCredentials ? 'Налаштувати Gemini' : 'Підключити Gemini'}
          aria-label={hasCredentials ? 'Налаштувати Gemini' : 'Підключити Gemini'}
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {hasCredentials && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />}
        </button>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            title="Очистити розмову"
            aria-label="Очистити розмову"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1 scrollbar-none select-text" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col justify-center px-2 pb-10 select-none">
            <AnimatedAiIcon isThinking={false} className="mb-4 h-5 w-5 text-neutral-900" />
            <h2 className="text-sm font-semibold text-neutral-900">
              {activeNote ? 'Що зробити з нотаткою?' : 'Чим допомогти?'}
            </h2>
            <p className="mt-1 max-w-[250px] text-xs leading-relaxed text-neutral-400">
              {activeNote
                ? 'Gemini бачить текст відкритої нотатки й може працювати з ним у контексті.'
                : 'Поставте запитання або почніть із готової дії.'}
            </p>

            <div className="mt-5 space-y-0.5">
              {quickActions.map(({ label, prompt, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-1 py-2 text-left text-xs text-neutral-500 transition-colors hover:text-neutral-950"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-colors group-hover:text-neutral-800" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {!hasCredentials && serverHasApiKey === false && (
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="mt-4 w-fit rounded-full border border-neutral-300/80 bg-neutral-100 px-3 py-1.5 text-[11px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
              >
                Підключити Gemini
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <article key={message.id} className={isUser ? 'flex justify-end' : 'flex items-start gap-2'}>
                  {!isUser && (
                    <AnimatedAiIcon
                      isThinking={isLoading && !message.content}
                      className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-500"
                    />
                  )}

                  <div className={isUser ? 'max-w-[88%] rounded-2xl rounded-br-md bg-neutral-100 px-3 py-2' : 'min-w-0 flex-1'}>
                    {isUser ? (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-800">{message.content}</p>
                    ) : message.content ? (
                      <>
                        <div className="noroom-ai-markdown text-xs leading-relaxed text-neutral-800">
                          <Markdown>{message.content}</Markdown>
                        </div>
                        <div className="mt-2 flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(message.content, message.id)}
                            title="Скопіювати"
                            aria-label="Скопіювати відповідь"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                          >
                            <AnimatedCopyIcon isCopied={copiedMessageId === message.id} className="h-3 w-3" />
                          </button>

                          {onInsertIntoActiveNote && activeNote && (
                            <button
                              type="button"
                              onClick={() => handleInsert(message.content, message.id)}
                              title="Вставити в нотатку"
                              aria-label="Вставити відповідь у нотатку"
                              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                            >
                              {insertedMessageId === message.id ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <ArrowDownToLine className="h-3 w-3" />
                              )}
                            </button>
                          )}

                          {onCreateNoteWithContent && (
                            <button
                              type="button"
                              onClick={() => handleCreateNewNote(message.content)}
                              title="Створити нову нотатку"
                              aria-label="Створити нотатку з відповіді"
                              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                            >
                              <FilePlus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-6 items-center gap-1.5 text-neutral-400" aria-label="Gemini формує відповідь">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:240ms]" />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2 py-3 text-[11px] leading-relaxed text-red-600" role="alert">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="min-w-0 flex-1">{errorMessage}</p>
            {lastQuery && (
              <button
                type="button"
                onClick={() => void sendMessage(lastQuery)}
                disabled={isLoading}
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Ще раз</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 p-3 pt-1">
        <div className="relative rounded-[18px] border border-neutral-200 bg-neutral-50 transition-colors focus-within:border-neutral-400 focus-within:bg-white">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            maxLength={6000}
            rows={1}
            placeholder={activeNote ? 'Запитайте про цю нотатку…' : 'Повідомлення для Gemini…'}
            className="block min-h-10 max-h-28 w-full resize-none overflow-y-auto bg-transparent px-3.5 pb-10 pt-3 text-xs leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 disabled:opacity-50"
          />

          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              title="Зупинити відповідь"
              aria-label="Зупинити відповідь"
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300/80 bg-neutral-100 text-neutral-900 transition-colors hover:bg-neutral-200"
            >
              <Square className="h-2.5 w-2.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!input.trim()}
              title="Надіслати"
              aria-label="Надіслати повідомлення"
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300/80 bg-neutral-100 text-neutral-900 transition-colors hover:bg-neutral-200 disabled:cursor-default disabled:opacity-35"
            >
              <Send className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
