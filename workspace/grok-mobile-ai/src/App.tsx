import { useEffect, useMemo, useRef, useState } from 'react';

type Role = 'system' | 'user' | 'assistant';
type Message = { role: Role; content: string };

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [provider, setProvider] = useLocalStorage<'openai' | 'ollama'>('provider', 'openai');
  const [model, setModel] = useLocalStorage<string>('model', 'gpt-4o-mini');
  const [apiKey, setApiKey] = useLocalStorage<string>('openai_key', '');
  const [useWiki, setUseWiki] = useLocalStorage<boolean>('use_wiki', true);

  const apiBase = useMemo(() => {
    const env = (import.meta as any).env?.VITE_API_URL as string | undefined;
    return env || 'http://localhost:8787';
  }, []);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isLoading]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const newMessages = [...messages, { role: 'user' as const, content: input.trim() }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(provider === 'openai' && apiKey ? { 'x-openai-api-key': apiKey } : {}),
        },
        body: JSON.stringify({ provider, model, messages: newMessages, include_wiki: useWiki }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: String(data.content || '') }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err?.message || String(err)}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-neutral-200/70 bg-white/70 px-3 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <div className="text-base font-semibold">Grok Mobile AI</div>
          <div className="flex items-center gap-2">
            <select value={provider} onChange={(e) => setProvider(e.target.value as any)} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900">
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama</option>
            </select>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'llama3.1'} className="w-28 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
            {provider === 'openai' && (
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="w-32 truncate rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
            )}
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={useWiki} onChange={(e) => setUseWiki(e.target.checked)} />
              <span>Wiki</span>
            </label>
          </div>
        </div>
      </header>

      <div ref={listRef} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="mt-10 text-center text-sm text-neutral-500">Ask me anything. Wikipedia context is {useWiki ? 'on' : 'off'}.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'ml-auto max-w-[85%] rounded-2xl bg-blue-600 px-4 py-2 text-white' : 'mr-auto max-w-[85%] rounded-2xl bg-neutral-200 px-4 py-2 dark:bg-neutral-800'}>
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="mr-auto max-w-[85%] rounded-2xl bg-neutral-200 px-4 py-2 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Thinking…</div>
        )}
        <div className="h-24" />
      </div>

      <form onSubmit={sendMessage} className="sticky bottom-0 w-full border-t border-neutral-200/70 bg-white/80 px-3 py-3 backdrop-blur supports-[padding:max(0px)]:[padding-bottom:max(theme(spacing.3),env(safe-area-inset-bottom))] dark:border-neutral-800 dark:bg-neutral-950/70">
        <div className="mx-auto flex max-w-xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-[15px] leading-6 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button disabled={isLoading || input.trim().length === 0} className="h-[44px] rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
