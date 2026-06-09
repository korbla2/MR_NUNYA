import React, { useState } from "react";
import { AISettings } from "../types";

interface SettingsProps {
  settings: AISettings;
  onSaveSettings: (settings: AISettings) => void;
  setBusy: (busy: boolean, notice?: string) => void;
}

export default function Settings({ settings, onSaveSettings, setBusy }: SettingsProps) {
  const [provider, setProvider] = useState<AISettings["provider"]>(settings.provider || "gemini");
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl || "http://localhost:11434");
  const [model, setModel] = useState(settings.model || "qwen2.5:7b");
  const [apiBase, setApiBase] = useState(settings.apiBase || "");
  const [apiKey, setApiKey] = useState(settings.apiKey || "");
  const [paidModel, setPaidModel] = useState(settings.paidModel || "");

  const handleSave = () => {
    onSaveSettings({
      provider,
      ollamaUrl,
      model,
      apiBase,
      apiKey,
      paidModel,
    });
    alert("AI settings saved successfully!");
  };

  const handleTestConnection = async () => {
    onSaveSettings({
      provider,
      ollamaUrl,
      model,
      apiBase,
      apiKey,
      paidModel,
    });

    setBusy(true, "Testing communication with selected AI model...");

    try {
      const payload: any = { prompt: "Return exactly: Communication test passed." };
      let endpoint = "/api/ai/gemini";

      if (provider === "ollama") {
        endpoint = "/api/ai/ollama";
        payload.ollamaUrl = ollamaUrl;
        payload.model = model;
      } else if (provider === "openai-compatible") {
        endpoint = "/api/ai/openai-compatible";
        payload.apiBase = apiBase;
        payload.apiKey = apiKey;
        payload.model = paidModel || model;
      } else if (provider === "demo") {
        setBusy(false);
        alert("Demo offline mode is active. No external connection is required to study!");
        return;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Integration Success!\nResponse feedback: "${data.text.trim()}"`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Connection Failed!\nDetail: ${err.error || "Bad response from server endpoint"}`);
      }
    } catch (err: any) {
      alert(`Network communication error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="settings-view">
      <div className="topbar">
        <div>
          <h2>AI Settings</h2>
          <p>
            Choose between Google Gemini, or connect to your local Ollama node, or integrate third-party OpenAI-compatible providers.
          </p>
        </div>
      </div>

      <section className="card max-w-3xl flex flex-col gap-4" id="settings-form">
        <div className="field">
          <label htmlFor="set-provider">AI Model Provider</label>
          <select
            id="set-provider"
            value={provider}
            onChange={e => setProvider(e.target.value as AISettings["provider"])}
          >
            <option value="gemini">Google Gemini (Recommended - Preconfigured)</option>
            <option value="demo">Free Demo fallback (Offline / Mock)</option>
            <option value="ollama">Free Local Ollama (qwen2.5:7b, llama3...)</option>
            <option value="openai-compatible">OpenAI-compatible Endpoint (OpenRouter, Groq, etc.)</option>
          </select>
        </div>

        {provider === "ollama" && (
          <div className="grid two gap-3" id="ollama-options">
            <div className="field">
              <label htmlFor="set-ollama">Ollama URL Host</label>
              <input
                id="set-ollama"
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>

            <div className="field">
              <label htmlFor="set-model">Local Model Family</label>
              <input
                id="set-model"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="qwen2.5:7b"
              />
            </div>
          </div>
        )}

        {provider === "openai-compatible" && (
          <div className="flex flex-col gap-3" id="openai-options">
            <div className="grid two gap-3">
              <div className="field">
                <label htmlFor="set-base">API Base URL</label>
                <input
                  id="set-base"
                  value={apiBase}
                  onChange={e => setApiBase(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div className="field">
                <label htmlFor="set-key">API Key Secret</label>
                <input
                  id="set-key"
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="set-paid-model">Model Name</label>
              <input
                id="set-paid-model"
                value={paidModel}
                onChange={e => setPaidModel(e.target.value)}
                placeholder="gpt-4o-mini, mixtral-8x7b, etc..."
              />
            </div>
          </div>
        )}

        <div className="row gap-3 mt-4">
          <button className="btn pr-6" type="button" onClick={handleSave}>
            Save Configuration
          </button>
          <button className="btn ghost" type="button" onClick={handleTestConnection}>
            Test Connection
          </button>
        </div>

        <hr className="border-gray-100 my-4" />

        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-700 leading-relaxed font-semibold">
          <b className="block text-indigo-800 font-black mb-1">Integration Recommendations:</b>
          <p className="mb-2">
            <b>Google Gemini (Default):</b> Fully preconfigured and handled natively inside the server backend! Great speed, reasoning, and no installation step needed.
          </p>
          <p className="mb-2">
            <b>Free Local Ollama:</b> Runs entirely on your computer! Make sure to start Ollama and pull your favorite concept model (e.g. <i>ollama pull qwen2.5:7b</i>) before using.
          </p>
          <p>
            <b>Demo Mode:</b> Generates syllabus components using quick text patterns in your browser. Perfect for testing layout flows offline.
          </p>
        </div>
      </section>
    </div>
  );
}
