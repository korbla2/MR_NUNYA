import { AISettings } from "../types";

export async function callAIApi(settings: AISettings, prompt: string, json: boolean = false): Promise<string> {
  let endpoint = "/api/ai/gemini";
  const payload: any = { prompt, json };

  if (settings.provider === "ollama") {
    endpoint = "/api/ai/ollama";
    payload.ollamaUrl = settings.ollamaUrl;
    payload.model = settings.model || "qwen2.5:7b";
  } else if (settings.provider === "openai-compatible") {
    endpoint = "/api/ai/openai-compatible";
    payload.apiBase = settings.apiBase;
    payload.apiKey = settings.apiKey;
    payload.model = settings.paidModel || settings.model;
  } else if (settings.provider === "openrouter") {
    endpoint = "/api/ai/openrouter";
    payload.apiKey = settings.apiKey;
    payload.model = settings.paidModel || settings.model || "google/gemini-2.5-flash";
  } else if (settings.provider === "demo") {
    throw new Error("Demo mode requested. Client should handle heuristic fallback.");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `AI endpoint returned status ${res.status}`);
  }

  const data = await res.json();
  return data.text || "";
}
