# LLM providers

arcanaTeX can call any OpenAI-compatible LLM endpoint. Providers are added in
the developer control panel and used by chat, AI compile fixes, subagents, and
the mathematical prover.

## Add a provider

1. Open the developer panel with `Cmd/Ctrl + Shift + D`.
2. Open the **Models** tab.
3. Choose a preset or fill in the form:
   - **Label** - display name.
   - **Base URL** - the OpenAI-compatible base URL, including `/v1` when the
     provider requires it.
   - **API key** - optional for local servers such as Ollama.
   - **Models** - one model ID per line or comma-separated.
   - **Default model** - the model selected when the provider is first used.
   - **Extra headers** - optional JSON for gateways that need custom headers.
4. Click **Discover models** to call `GET {baseUrl}/models` and import the
   returned IDs, or enter model IDs manually.
5. Click **Save provider**.

The provider appears in the model picker, grouped by provider label. Selecting
a provider-qualified model sends `providerId::modelId` to the server.

## Meta AI Muse Spark

The Meta AI preset uses the values from the official Muse Spark OpenCode
installer:

- Base URL: `https://api.meta.ai/v1`
- Model: `muse-spark-1.1`
- Label: `Muse Spark 1.1`

Paste the Meta API key into the provider form. Do not put it in `NEXT_PUBLIC_*`
variables or commit it.

## Storage and secrets

Provider settings are written to:

```
apps/web/.llm-providers.local.json
```

The file is git-ignored, written with mode `0600`, and never exposed through a
client API. The browser receives only:

- provider label and base URL;
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

- Only OpenAI-compatible chat endpoints are supported.
- Discovery expects `GET {baseUrl}/models` to return an OpenAI-style
  `{ "data": [...] }` payload; plain arrays and `{ "models": [...] }` are also
  accepted.
- The dev panel is development-only. The saved provider file is still read by
  the server in production builds.
