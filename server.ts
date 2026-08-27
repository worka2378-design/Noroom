import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to resolve and clean API Key
function resolveApiKey(customApiKey?: string, headerKey?: string): string {
  const rawKey =
    customApiKey ||
    headerKey ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    '';
  return typeof rawKey === 'string' ? rawKey.trim() : '';
}

// Helper to sanitize message history for Gemini multiturn requirements
function sanitizeMessages(rawMessages: any[]): Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> {
  if (!Array.isArray(rawMessages)) return [];

  const cleanList: Array<{ role: 'user' | 'model'; text: string }> = [];

  for (const m of rawMessages) {
    if (!m) continue;
    const role: 'user' | 'model' = m.role === 'model' || m.role === 'assistant' ? 'model' : 'user';
    const rawText = typeof m.content === 'string' ? m.content.trim() : typeof m.text === 'string' ? m.text.trim() : '';
    
    // Skip empty or error markers
    if (!rawText || rawText.startsWith('⚠️') || rawText.startsWith('Помилка')) continue;

    if (cleanList.length > 0 && cleanList[cleanList.length - 1].role === role) {
      // Merge consecutive same-role messages
      cleanList[cleanList.length - 1].text += '\n\n' + rawText;
    } else {
      cleanList.push({ role, text: rawText });
    }
  }

  // Gemini requires the first turn to be 'user'
  while (cleanList.length > 0 && cleanList[0].role !== 'user') {
    cleanList.shift();
  }

  return cleanList.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }],
  }));
}

// Format errors into user-friendly Ukrainian message
function formatGeminiError(err: any): { status: number; message: string } {
  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err?.message) {
    raw = typeof err.message === 'string' ? err.message : JSON.stringify(err.message);
  } else {
    raw = JSON.stringify(err || '');
  }

  // Try unnesting if raw is JSON string
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      raw = typeof parsed.error.message === 'string' ? parsed.error.message : JSON.stringify(parsed.error.message);
      // Double unnest if needed
      try {
        const doubleParsed = JSON.parse(raw);
        if (doubleParsed?.error?.message) {
          raw = doubleParsed.error.message;
        }
      } catch {}
    }
  } catch {}

  console.error('[Gemini API Error Cleaned]:', raw);

  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid') || raw.includes('401') || raw.includes('403')) {
    return {
      status: 401,
      message: 'API-ключ Gemini недійсний. Будь ласка, перевірте або оновіть ключ у налаштуваннях.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429') || raw.includes('Quota exceeded')) {
    return {
      status: 429,
      message: 'Перевищено ліміт запитів Gemini API. Будь ласка, зачекайте хвилинку.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand') || raw.includes('overloaded')) {
    return {
      status: 503,
      message: 'Сервери Gemini наразі мають тимчасове навантаження. Спробуйте повторити запит ще раз.',
    };
  }
  if (raw.includes('SAFETY') || raw.includes('HARM')) {
    return {
      status: 400,
      message: 'Запит або відповідь заблоковано фільтрами безпеки Gemini.',
    };
  }

  return {
    status: 500,
    message: raw && raw.length < 120 ? raw : 'Помилка зв’язку з моделлю. Спробуйте повторити запит.',
  };
}

// Available high-capacity models
const MODELS_PRIORITY = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
];

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
  res.json({ status: 'ok', hasGeminiKey: hasKey });
});

// Single text transform endpoint
app.post('/api/ai/transform', async (req, res) => {
  try {
    const { prompt, text, customApiKey } = req.body;
    const apiKey = resolveApiKey(customApiKey, req.headers['x-gemini-api-key'] as string);

    if (!apiKey) {
      return res.status(401).json({
        error: 'Потрібен API-ключ Gemini. Введіть його у вікні налаштування.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const fullPrompt = `${prompt || 'Опрацюй цей текст'}:\n\n${text || ''}`;

    let resultText = '';
    let lastError: any = null;

    for (const model of MODELS_PRIORITY) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: fullPrompt,
        });
        resultText = response.text || '';
        if (resultText) break;
      } catch (err: any) {
        console.warn(`[Transform with ${model} failed]:`, err?.message || err);
        lastError = err;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!resultText && lastError) {
      throw lastError;
    }

    res.json({ result: resultText });
  } catch (error: any) {
    const formatted = formatGeminiError(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// AI Chat endpoint with robust streaming & fallback
app.post('/api/chat', async (req, res) => {
  const { messages, activeNoteContext, customApiKey } = req.body;
  const apiKey = resolveApiKey(customApiKey, req.headers['x-gemini-api-key'] as string);

  if (!apiKey) {
    return res.status(401).json({
      error: 'Ключ Gemini API не знайдено. Будь ласка, введіть ваш API-ключ у налаштуваннях ШІ.',
    });
  }

  const formattedContents = sanitizeMessages(messages);
  if (formattedContents.length === 0) {
    return res.status(400).json({ error: 'Повідомлення не може бути порожнім.' });
  }

  let systemInstruction =
    'Ти — розумний, точний та лаконічний ШІ-асистент, інтегрований у мінімалістичний застосунок "Нотатки". ' +
    'Твоє завдання — допомагати користувачеві працювати з нотатками, планами, структуризацією думок, ' +
    'текстами, редагуванням та генерацією ідей. ' +
    'Відповідай мовою запиту користувача (за замовчуванням українською). ' +
    'Використовуй красивий та чіткий Markdown без зайвої "води", привітності чи шаблонних вступів — одразу до суті.';

  if (activeNoteContext && (activeNoteContext.title || activeNoteContext.contentSnippet || activeNoteContext.content)) {
    const snippet = activeNoteContext.contentSnippet || activeNoteContext.content || '';
    systemInstruction += `\n\n[Контекст поточної активної нотатки]:
Заголовок: "${activeNoteContext.title || 'Без назви'}"
Зміст:
"""
${snippet}
"""`;
  }

  const ai = new GoogleGenAI({ apiKey });

  let streamWorking = false;
  let lastError: any = null;

  // 1. Try streaming models
  for (const model of MODELS_PRIORITY) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const iterator = responseStream[Symbol.asyncIterator]();
      const firstResult = await iterator.next();

      // If we received the first chunk successfully, model works!
      streamWorking = true;

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      if (!firstResult.done && firstResult.value) {
        const firstText = firstResult.value.text || '';
        if (firstText) {
          res.write(`data: ${JSON.stringify({ text: firstText })}\n\n`);
        }
      }

      while (true) {
        const nextResult = await iterator.next();
        if (nextResult.done) break;
        const text = nextResult.value?.text || '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (err: any) {
      console.warn(`[Stream with model ${model} failed]:`, err?.message || err);
      lastError = err;
      if (streamWorking) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: 'Помилка під час отримання відповіді.' })}\n\n`);
          res.end();
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // 2. Fallback: try non-streaming generateContent if streaming had issues
  for (const model of MODELS_PRIORITY) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
      const text = response.text || '';
      if (text) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    } catch (err: any) {
      console.warn(`[Fallback generateContent with ${model} failed]:`, err?.message || err);
      lastError = err;
    }
  }

  // If everything failed
  const formatted = formatGeminiError(lastError);
  if (!res.headersSent) {
    return res.status(formatted.status).json({ error: formatted.message });
  }
  res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
  res.end();
});

// Vite middleware in dev vs static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
