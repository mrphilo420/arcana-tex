import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type ToolSet,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import {
  getPaperReviewInvocation,
  LEAN_SYSTEM_GUIDE,
  PAPER_REVIEW_SKILL,
} from "@/lib/chat-skills/paper-review";
import { createServerTools } from "@/lib/ai/server-tools";
import { DEFAULT_GROQ_MODEL_ID, isGroqModelId } from "@/lib/chat-models";
import { chatRatelimit, getIP } from "@/lib/ratelimit";

export const maxDuration = 120;

const groqApiKey = process.env.GROQ_API_KEY?.trim();
const useGroq = Boolean(groqApiKey);

const modelProvider = createOpenAI({
  apiKey: useGroq ? groqApiKey : process.env.OPENAI_API_KEY || "local",
  baseURL: useGroq
    ? process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
    : process.env.OPENAI_BASE_URL || undefined,
});

const configuredEnvModel = process.env.GROQ_MODEL?.trim();
const chatModel = useGroq
  ? isGroqModelId(configuredEnvModel)
    ? configuredEnvModel
    : DEFAULT_GROQ_MODEL_ID
  : process.env.OPENAI_MODEL || "gpt-4o";

const SYSTEM_PROMPT = `You are a helpful research-writing and formalization assistant working in arcanaTeX, a local-first LaTeX and Lean 4 workspace.

You help users write, edit, review, and reason about LaTeX documents, research papers, presentations, and Lean 4 developments.

When providing LaTeX code:
- Use proper LaTeX syntax
- Explain what each part does
- Suggest best practices
- Use code blocks with \`\`\`latex for LaTeX code

When providing Lean code:
- Use Lean 4 syntax and preserve declaration names and universe/implicit arguments
- Use code blocks with \`\`\`lean
- Explain theorem statements, proof structure, tactics, and proof obligations
- Treat sorry/admit as incomplete proofs and axioms/native_decide/unsafe/partial as trust or soundness risks
- Never claim code compiles or a theorem is verified unless build output or explicit evidence is provided

You have access to the user's whole project structure and the contents of the current and main documents in the context. Lean sources are also surfaced with declaration summaries.

When the user asks you to help with their document:
- Reference specific parts of their document
- Suggest improvements and fixes
- Provide complete code snippets they can use

You have tools available to inspect and modify the project:
- list_project_files: list every file in the project
- read_project_file: read a text file by its relative path (including .lean)
- search_project: search text across the project's files
- inspect_lean_sources: summarize Lean declarations, imports, axioms, and incomplete proofs
- build_lean_project: run lake build in the configured local Lean Lake project
- load_review_context: load the manuscript and Lean summaries for a paper review
- write_project_file: create a file or overwrite a text file by path
- set_main_document: change which .tex file is compiled as the main document
- insert_latex: insert code at the cursor position in the active file
- replace_selection: replace the current selection (only when text is selected)
- find_and_replace: find and replace text in the active file
- run_python: run a Python script for computation and TikZ/PGF generation
- run_r: run an R script for computation and TikZ/PGF generation
- spawn_subagents: delegate independent planning, Python, R, or review work to parallel subagents

When the user asks you to add, insert, or write LaTeX code to their active document, use insert_latex.
When the user asks you to replace or modify selected text, use replace_selection.
When the user asks you to change specific text in the active document, use find_and_replace.
When editing the active file, prefer insert_latex or find_and_replace over overwriting the whole file with write_project_file.
When the user asks about another file, a chapter, or the whole project, use list_project_files, read_project_file, or search_project first.
When the user asks you to create a new section, chapter, bibliography file, Lean file, or Markdown note, use write_project_file.

Paper reviews:
- The built-in /paper-review skill runs a structured, read-only editorial review.
- Use load_review_context before a full review; read missing files as needed.
- In review mode, never modify the manuscript or Lean files. Return the review in chat.
- If the user types /paper-review, follow the skill instructions appended below.

Common tasks you help with:
- Writing and reviewing mathematical equations
- Document structure (sections, chapters)
- Tables and figures
- Bibliography and citations
- Formatting and styling
- Package recommendations
- Debugging LaTeX errors
- Paper reviews and referee reports
- Understanding Lean 4 statements, proofs, and formalization gaps`;

const REVIEW_EDIT_TOOLS = new Set([
  "insert_latex",
  "replace_selection",
  "find_and_replace",
  "write_project_file",
  "set_main_document",
]);

interface ChatMessageLike {
  role?: string;
  content?: unknown;
  parts?: Array<{ type?: string; text?: string }>;
  [key: string]: unknown;
}

const MAX_HISTORY_CHARS = 6500;
const MAX_MESSAGE_PART_CHARS = 3500;
const MAX_SYSTEM_CHARS = 7000;

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = Math.ceil(limit * 0.7);
  const tail = limit - head;
  return `${text.slice(0, head)}\n… truncated …\n${text.slice(-tail)}`;
}

function truncateDeep(value: unknown, limit: number): unknown {
  if (typeof value === "string") return truncateText(value, limit);
  if (Array.isArray(value))
    return value.map((item) => truncateDeep(item, limit));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        truncateDeep(item, limit),
      ]),
    );
  }
  return value;
}

function compactChatMessages(input: unknown): ChatMessageLike[] {
  if (!Array.isArray(input)) return [];
  const messages = input.map((message) =>
    truncateDeep(message, MAX_MESSAGE_PART_CHARS),
  ) as ChatMessageLike[];

  let start = messages.length;
  let used = 0;
  for (let index = messages.length - 1; index >= 0; index--) {
    const size = JSON.stringify(messages[index]).length;
    if (used + size > MAX_HISTORY_CHARS && used > 0) break;
    used += size;
    start = index;
  }

  // Keep a complete turn boundary when possible so tool results stay paired
  // with the assistant call that produced them.
  while (start > 0 && messages[start]?.role !== "user") start--;
  return messages.slice(start);
}

function messageText(message: ChatMessageLike): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return typeof part.text === "string" ? part.text : "";
        }
        return "";
      })
      .join("\n");
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n");
  }
  return "";
}

function latestUserText(messages: ChatMessageLike[]): string {
  const latest = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  return latest ? messageText(latest) : "";
}

function readOnlyTools(tools: unknown): unknown {
  if (!tools || typeof tools !== "object") return tools;
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => !REVIEW_EDIT_TOOLS.has(name)),
  );
}

export async function POST(req: Request) {
  if (!useGroq && !process.env.OPENAI_API_KEY && !process.env.OPENAI_BASE_URL) {
    return NextResponse.json(
      {
        error:
          "No chat model is configured. Set GROQ_API_KEY (or OPENAI_API_KEY / OPENAI_BASE_URL) in apps/web/.env.local, then restart the dev server.",
      },
      { status: 500 },
    );
  }

  if (chatRatelimit) {
    const ip = getIP(req);
    const { success, limit, remaining, reset } = await chatRatelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }
  }

  const payload = await req.json();
  const messages = compactChatMessages(payload.messages);
  const system =
    typeof payload.system === "string"
      ? truncateText(payload.system, MAX_SYSTEM_CHARS)
      : undefined;
  const tools = payload.tools;
  const requestedModel = payload.model;
  const selectedModel =
    useGroq && isGroqModelId(requestedModel) ? requestedModel : chatModel;
  const latestText = latestUserText(messages);
  const review = getPaperReviewInvocation(latestText);
  const activeTools = review ? readOnlyTools(tools) : tools;

  const systemParts = [SYSTEM_PROMPT, LEAN_SYSTEM_GUIDE];
  if (system) systemParts.push(system);
  if (review) {
    systemParts.push(
      PAPER_REVIEW_SKILL,
      `Review invocation: mode=${review.mode}; explicit=${
        review.explicit ? "true" : "false"
      }; focus=${review.focus || "none"}. ${
        review.explicit
          ? "The user invoked /paper-review."
          : "The user asked for a paper review in natural language."
      } Edit tools are disabled for this turn; the review is read-only.`,
    );
  }

  const selectedModelInstance = modelProvider.chat(selectedModel);
  const serverTools = createServerTools(selectedModelInstance);
  const clientTools = activeTools
    ? (frontendTools(activeTools) as unknown as ToolSet)
    : {};
  const allTools = { ...serverTools, ...clientTools } as ToolSet;

  const result = streamText({
    model: selectedModelInstance,
    system: systemParts.join("\n\n"),
    messages: await convertToModelMessages(messages as unknown as UIMessage[]),
    maxOutputTokens: 2048,
    stopWhen: stepCountIs(review ? 16 : 10),
    tools: allTools,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;
      if (statusCode === 413) {
        return "Groq rejected this request as too large for the current token limit. The editor context was compacted automatically; try sending the message again or choose the Fast model.";
      }
      console.error("Chat stream error", error);
      return "Chat failed while contacting the model. Check the server logs and your Groq configuration.";
    },
  });
}
