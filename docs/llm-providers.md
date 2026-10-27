# LLM providers

arcanaTeX can call OpenAI-compatible chat endpoints, OpenAI Responses endpoints,
the native Anthropic Messages API, native Google Gemini, and OpenCode's
multi-API inference gateway. Providers are added in the developer control panel
and used by chat, AI compile fixes, subagents, and the mathematical prover.

## Add a provider

1. Open the developer panel with `Cmd/Ctrl + Shift + D`.
2. Open the **Models** tab.
3. Choose a preset or fill in the form:
   - **Label** - display name.
   - **Base URL** - the API base URL, including `/v1` when the provider
     requires it. For OpenCode, use the inference root.
   - **API type** - OpenAI chat, OpenAI responses, Anthropic messages, Google
     Gemini, or OpenCode auto-route.
   - **API key** - optional for local servers such as Ollama.
   - **Models** - one model ID per line or comma-separated.
   - **Default model** - the model selected when the provider is first used.
   - **Extra headers** - optional JSON for gateways that need custom headers.
4. Click **Discover models** to call the provider's model endpoint and import
   the returned IDs, or enter model IDs manually.
5. Click **Save provider**.

The provider appears in the model picker, grouped by provider label. Selecting
a provider-qualified model sends `providerId::modelId` to the server.

## API types

- **OpenAI chat completions** - the default. Calls
  `POST {baseUrl}/chat/completions`. Use it for OpenAI, Groq, OpenRouter,
  Meta AI, Nous Portal, DeepSeek, xAI, and most gateways.
- **OpenAI responses** - calls `POST {baseUrl}/responses`. Use it for providers
  and models that expose the Responses API.
- **Anthropic messages** - calls `POST {baseUrl}/messages` with the native
  Anthropic Messages API.
- **Google Gemini** - calls the native Generative AI API with
  `x-goog-api-key`. Base URL is normally
  `https://generativelanguage.googleapis.com/v1beta`.
- **OpenCode auto-route** - one OpenCode key and inference root. arcanaTeX
  chooses the correct endpoint for every model.

## Presets

| Preset | Base URL | API type |
| --- | --- | --- |
| Meta AI | `https://api.meta.ai/v1` | OpenAI chat |
| OpenCode Zen / Go | `https://opencode.ai/inference` | OpenCode auto-route |
| Anthropic | `https://api.anthropic.com/v1` | Anthropic messages |
| Nous Portal / Hermes | `https://inference-api.nousresearch.com/v1` | OpenAI chat |
| OpenAI | `https://api.openai.com/v1` | OpenAI chat |
| Groq | `https://api.groq.com/openai/v1` | OpenAI chat |
| OpenRouter | `https://openrouter.ai/api/v1` | OpenAI chat |
| Hugging Face | `https://router.huggingface.co/v1` | OpenAI chat |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | Google Gemini |
| DeepSeek | `https://api.deepseek.com/v1` | OpenAI chat |
| xAI | `https://api.x.ai/v1` | OpenAI chat |
| Ollama | `http://localhost:11434/v1` | OpenAI chat |

## OpenCode Zen and Go

OpenCode Zen and OpenCode Go share the OpenCode inference gateway. Use an
OpenCode API key from <https://opencode.ai/auth>.

Use one **OpenCode Zen / Go** provider with:

- Base URL: `https://opencode.ai/inference`
- API type: **OpenCode auto-route**
- Key: your OpenCode personal or service-account key

Discovery calls `GET https://opencode.ai/inference/v1/models` and imports the
paid/Go models. Each model is routed to the API family that serves it:

- **Chat Completions** - DeepSeek, Kimi, GLM, MiniMax, Mistral, Qwen3.8 Max,
  and the open models.
- **OpenAI Responses** - GPT, Grok, and Muse models.
- **Anthropic messages** - Claude, Qwen3.8 Flash, Qwen3.6 Plus, and Qwen3.5
  Plus.
- **Gemini** - Gemini models.

Free-tier OpenCode models are listed in the picker as **Free · Unavailable**
because they only work inside the OpenCode client. Jev/SystemOne and non-chat
models are also marked unavailable. You can add a supported model ID manually
if it is missing.

The model picker shows the family next to each OpenCode model, so you can see
how it will be routed.

## Hugging Face

The Hugging Face preset uses the OpenAI-compatible Inference Providers router:

- Base URL: `https://router.huggingface.co/v1`
- API type: OpenAI chat
- Token permission: **Make calls to Inference Providers**
- Example models: `meta-llama/Llama-3.3-70B-Instruct`,
  `Qwen/Qwen2.5-72B-Instruct`, `deepseek-ai/DeepSeek-V3-0324`

Click **Discover models** to query the router, or enter a model ID manually.
The router selects a serving provider for each request.

## Google Gemini

The Google preset uses the native Gemini API:

- Base URL: `https://generativelanguage.googleapis.com/v1beta`
- API type: Google Gemini
- Example models: `gemini-3.5-flash`, `gemini-3.1-pro`

Discovery uses `x-goog-api-key` and parses the Google `models` response. For an
OpenCode Gemini model, use the OpenCode auto-route provider instead.

## Anthropic

The Anthropic preset uses the native Messages API:

- Base URL: `https://api.anthropic.com/v1`
- API type: Anthropic messages
- Example models: `claude-sonnet-4-6`, `claude-opus-4-6`,
  `claude-haiku-4-5`

Discovery uses `x-api-key` and `anthropic-version: 2023-06-01` rather than a
Bearer token. The chat route uses the same native provider.

## Nous Portal and Hermes

The Nous Portal preset uses:

- Base URL: `https://inference-api.nousresearch.com/v1`
- API type: OpenAI chat
- Example models: `anthropic/claude-sonnet-4.6`, `openai/gpt-5.5-pro`,
  `deepseek/deepseek-v4-pro`, and the Hermes 4 family.

Nous Portal normally authenticates through OAuth in Hermes. If you have a
Portal API key, paste it into the provider form; otherwise use the Portal's
subscription proxy or an OpenAI-compatible gateway that exposes the same
models.

## Meta AI Muse Spark

The Meta AI preset uses the values from the official Muse Spark OpenCode
installer:

- Base URL: `https://api.meta.ai/v1`
- Model: `muse-spark-1.1`
- Label: `Muse Spark 1.1`

Paste the Meta API key into the provider form. Do not put it in `NEXT_PUBLIC_*`
variables or commit it.

Discovery imports every model the Meta endpoint returns, including image, voice,
and transcription models. Choose a chat model such as `muse-spark-1.3`,
`muse-spark-1.2`, or `muse-spark-1.1` for the assistant. If a model requires the
Responses API instead of chat completions, add a second Meta provider with base
URL `https://api.meta.ai/v1` and API type **OpenAI responses**.

## Storage and secrets

Provider settings are written to:

```
apps/web/.llm-providers.local.json
```

The file is git-ignored, written with mode `0600`, and never exposed through a
client API. The browser receives only:

- provider label, base URL, and API type;
- model IDs and default model;
- a masked key preview such as `••••7890`;
- header names, not header values.

The chat, fix, and subagent routes read the file on the server and construct the
provider client there. The API key never enters browser storage or the chat
transcript.

If a key is pasted into chat or a shared log, rotate it.

## Environment fallback

If no provider is configured, the existing environment fallback still works:

- `GROQ_API_KEY` with the curated Groq models;
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` with `OPENAI_MODEL` (default `gpt-4o`);
- `HUGGINGFACE_API_KEY` or `HF_TOKEN` with `HUGGINGFACE_MODEL` (default
  `meta-llama/Llama-3.3-70B-Instruct`) and optional
  `HUGGINGFACE_BASE_URL` (default `https://router.huggingface.co/v1`).

Configured providers take precedence. A provider-qualified model that no longer
exists returns an error instead of silently switching to another provider.

## Model refresh and free models

Configured providers refresh their model catalogs when stale. The default TTL
is **168 hours (weekly)**. Set `LLM_MODEL_REFRESH_HOURS=24` for a daily refresh.

- `/api/ai/models` checks the TTL in the background; the picker updates on the
  next fetch.
- The developer **Models** tab has **Refresh all** and per-provider **Refresh**
  buttons, plus an "updated" timestamp.
- A refresh preserves your existing curated model list. It updates availability
  and free flags, but does not silently add every new model. Use **Discover
  models** to expand the list.
- Free detection uses OpenAI/OpenRouter zero pricing, Hugging Face provider
  `is_free` metadata, and OpenCode free-tier model names.
- Free models are sorted first in the picker and labeled **Free**. OpenCode
  free-tier models remain disabled because external clients cannot use them.

## Cost reporting

OpenCode returns the request cost and billing source in the API usage metadata:
`usage.cost` and `usage.opencode.billing_source` (for example `balance`, `go`,
or `free`). arcanaTeX forwards the provider response but does not display a cost
panel yet.

## Limitations

- Discovery accepts OpenAI-style `{ "data": [...] }`, plain arrays,
  `{ "models": [...] }`, and Google's `models` response. Anthropic uses native
  headers; OpenCode uses `/v1/models`.
- OpenCode free-tier models are shown as disabled because external clients
  receive HTTP 403. Jev/SystemOne is not a chat-completions model and is also
  disabled.
- Refreshes run on access and on a six-hour client check. The server TTL
  controls when a provider is actually re-queried.
- Amazon Bedrock, Azure-specific authentication, and other non-OpenAI,
  non-Anthropic, non-Google protocols are not wired as native adapters. Use an
  OpenAI-compatible gateway or add an AI SDK adapter.
- The dev panel is development-only. The saved provider file is still read by
  the server in production builds.
