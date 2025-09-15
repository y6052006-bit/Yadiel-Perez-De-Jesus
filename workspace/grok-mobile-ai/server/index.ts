import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  provider: z.enum(['openai', 'ollama']).default('openai'),
  model: z.string().default('gpt-4o-mini'),
  messages: z.array(ChatMessageSchema),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  include_wiki: z.boolean().optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

async function fetchWikiSummary(query: string): Promise<{ summary: string; url?: string } | null> {
  if (!query || query.trim().length === 0) return null;
  try {
    const title = encodeURIComponent(query.trim());
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
    const res = await fetch(summaryUrl);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data && data.extract) {
      return { summary: String(data.extract), url: typeof data.content_urls?.desktop?.page === 'string' ? data.content_urls.desktop.page : undefined };
    }
    return null;
  } catch {
    return null;
  }
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/api/wiki', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').slice(0, 200);
  if (!q) return res.status(400).json({ error: 'Missing q' });
  const info = await fetchWikiSummary(q);
  if (!info) return res.status(404).json({ error: 'Not found' });
  res.json(info);
});

app.post('/api/chat', async (req: Request, res: Response) => {
  let parsed: ChatRequest;
  try {
    parsed = ChatRequestSchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: 'Invalid request', details: err?.message });
  }

  const { provider, model } = parsed;
  let messages = parsed.messages;
  const temperature = parsed.temperature ?? 0.7;
  const top_p = parsed.top_p;

  if (parsed.include_wiki) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser?.content) {
      const wiki = await fetchWikiSummary(lastUser.content);
      if (wiki?.summary) {
        messages = [
          { role: 'system' as const, content: `You may use this Wikipedia context if helpful. Be concise.\n\n${wiki.summary}` },
          ...messages,
        ];
      }
    }
  }

  try {
    if (provider === 'openai') {
      const apiKey = (req.header('x-openai-api-key') || process.env.OPENAI_API_KEY || '').trim();
      if (!apiKey) return res.status(400).json({ error: 'Missing OpenAI API key' });
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        top_p,
      });
      const content = completion.choices?.[0]?.message?.content ?? '';
      return res.json({ role: 'assistant', content });
    }

    // Ollama local inference
    if (provider === 'ollama') {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false, options: { temperature } }),
      });
      if (!response.ok) {
        const text = await response.text();
        return res.status(502).json({ error: 'Ollama error', details: text });
      }
      const data: any = await response.json();
      const content = data?.message?.content ?? '';
      return res.json({ role: 'assistant', content });
    }

    return res.status(400).json({ error: 'Unsupported provider' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Chat error', details: err?.message || String(err) });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${port}`);
});

