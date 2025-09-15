## Grok Mobile AI

Mobile-first chat app with a provider-agnostic backend (OpenAI or local Ollama) and optional Wikipedia augmentation.

### Quickstart

1. Copy env and set your OpenAI key if using OpenAI:
```bash
cp .env.example .env
```

2. Install and run both client and server:
```bash
npm install
npm run dev
```

3. Open http://localhost:5173. Set provider, model, and paste your OpenAI key in the header if using OpenAI. For local inference, run Ollama and choose provider Ollama with a local model (e.g., `llama3.1`).

### API
- POST /api/chat: { provider, model, messages[], include_wiki }
- GET /api/wiki?q=QUERY: Wikipedia summary

### Config
- `.env` supports: OPENAI_API_KEY, PORT, VITE_API_URL
