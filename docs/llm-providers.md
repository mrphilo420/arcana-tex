# LLM providers

arcanaTeX can call OpenAI-compatible chat endpoints, OpenAI Responses endpoints,
and the native Anthropic Messages API. Providers are added in the developer
control panel and used by chat, AI compile fixes, subagents, and the
mathematical prover.

## Add a provider

1. Open the developer panel with `Cmd/Ctrl + Shift + D`.
2. Open the **Models** tab.
3. Choose a preset or fill in the form:
   - **Label** - display name.
   - **Base URL** - the API base URL, including `/v1` when the provider
     requires it.
   - **API type** - OpenAI chat completions, OpenAI responses, or Anthropic
     messages.
   - **API key** - optional for local servers such as Ollama.
   - **Models** - one model ID per line or comma-separated.
   - **Default model** - the model selected when the provider is first used.
   - **Extra headers** - optional JSON for gateways that need custom headers.
4. Click **Discover models** to call `GET {baseUrl}/models` and import the
   returned IDs, or enter model IDs manually.
5. Click **Save provider**.

The provider appears in the model picker, grouped by provider label. Selecting
a provider-qualified model sends `providerId::modelId` to the server.

## API types

- **OpenAI chat completions** - the default. Calls
  `POST {baseUrl}/chat/completions`. Use it for OpenAI, Groq, OpenRouter,
  Meta AI, Nous Portal, DeepSeek, xAI, Google's OpenAI-compatible endpoint,
  and most gateways.
- **OpenAI responses** - calls `POST {baseUrl}/responses`. Use it for providers
  and models that expose the Responses API, such as OpenCode Zen GPT, Grok, and
  Muse Spark models.
- **Anthropic messages** - calls `POST {baseUrl}/messages` with the native
  Anthropic Messages API. Use it for `https://api.anthropic.com/v1` or an
  Anthropic-compatible proxy such as OpenCode Zen's Anthropic endpoint.

## Presets

| Preset | Base URL | API type |
| --- | --- | --- |
| Meta AI | `https://api.meta.ai/v1` | OpenAI chat |
| OpenCode Zen / Go | `https://opencode.ai/inference/openai/v1` | OpenAI chat |
| OpenCode Responses | `https://opencode.ai/inference/openai/v1` | OpenAI responses |
| Anthropic | `https://api.anthropic.com/v1` | Anthropic messages |
| Nous Portal / Hermes | `https://inference-api.nousresearch.com/v1` | OpenAI chat |
| OpenAI | `https://api.openai.com/v1` | OpenAI chat |
| Groq | `https://api.groq.com/openai/v1` | OpenAI chat |
| OpenRouter | `https://openrouter.ai/api/v1` | OpenAI chat |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | OpenAI chat |
| DeepSeek | `https://api.deepseek.com/v1` | OpenAI chat |
| xAI | `https://api.x.ai/v1` | OpenAI chat |
| Ollama | `http://localhost:11434/v1` | OpenAI chat |

## OpenCode Zen and Go

OpenCode Zen and OpenCode Go share the OpenCode inference gateway. Use an
OpenCode API key from <https://opencode.ai/auth>.

- **Chat-completions models** (DeepSeek V4.1 Flash, Qwen3.8 Max, GLM 5.3,
  Kimi K2.6, MiniMax M3): use the **OpenCode Zen / Go** preset with base URL
  `https://opencode.ai/inference/openai/v1`.
- **Responses models** (GPT 6.1 Sol, Muse Spark 1.2, Grok 4.7): use the
  **OpenCode Responses** preset with the same base URL and API type
  **OpenAI responses**.
- **Anthropic-routed models** (Claude, Qwen Flash on the Anthropic endpoint):
  add a provider with base URL
  `https://opencode.ai/inference/anthropic/v1` and API type
  **Anthropic messages**.

If a model is not in the preset, click **Discover models** or enter its ID from
the OpenCode model list. Discovery imports every ID the provider returns,
including image, voice, and embedding models; choose a chat/text model for the
assistant.

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
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` with `OPENAI_MODEL` (default `gpt-4o`).

Configured providers take precedence. A provider-qualified model that no longer
exists returns an error instead of silently switching to another provider.

## Limitations

- Discovery expects `GET {baseUrl}/models` to return an OpenAI-style
  `{ "data": [...] }` payload; plain arrays and `{ "models": [...] }` are also
  accepted. Anthropic is handled through its native headers.
- Native Google Gemini API, Amazon Bedrock, and other non-OpenAI/non-Anthropic
  protocols are not wired as native adapters. Use an OpenAI-compatible gateway
  for those models, or add an AI SDK adapter in a follow-up.
- The dev panel is development-only. The saved provider file is still read by
  the server in production builds.
