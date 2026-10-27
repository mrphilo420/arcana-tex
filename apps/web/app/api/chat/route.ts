import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type ToolSet,
} from "ai";
import { NextResponse } from "next/server";
import { chatRatelimit, getIP } from "@/lib/ratelimit";

export const maxDuration = 60;

const modelProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "local",
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const chatModel = process.env.OPENAI_MODEL || "gpt-4o";

const SYSTEM_PROMPT = `You are a helpful LaTeX assistant. You help users write and edit LaTeX documents.

When providing LaTeX code:
- Use proper LaTeX syntax
- Explain what each part does
- Suggest best practices
- Use code blocks with \`\`\`latex for LaTeX code

You have access to the user's whole project structure and the contents of the current and main documents in the context.

When the user asks you to help with their document:
- Reference specific parts of their document
- Suggest improvements and fixes
- Provide complete code snippets they can use

You have tools available to inspect and modify the project:
- list_project_files: list every file in the project
- read_project_file: read a text file by its relative path
- search_project: search text across the project's files
- write_project_file: create a file or overwrite a text file by path
- set_main_document: change which .tex file is compiled as the main document
- insert_latex: insert code at the cursor position in the active file
- replace_selection: replace the current selection (only when text is selected)
- find_and_replace: find and replace text in the active file

When the user asks you to add, insert, or write LaTeX code to their active document, use insert_latex.
When the user asks you to replace or modify selected text, use replace_selection.
When the user asks you to change specific text in the active document, use find_and_replace.
When editing the active file, prefer insert_latex or find_and_replace over overwriting the whole file with write_project_file.
When the user asks about another file, a chapter, or the whole project, use list_project_files, read_project_file, or search_project first.
When the user asks you to create a new section, chapter, or bibliography file, use write_project_file.

Common tasks you help with:
- Writing mathematical equations
- Document structure (sections, chapters)
- Tables and figures
- Bibliography and citations
- Formatting and styling
- Package recommendations
- Debugging LaTeX errors`;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_BASE_URL) {
    return NextResponse.json(
      {
        error:
          "No chat model is configured. Set OPENAI_API_KEY (and optionally OPENAI_MODEL / OPENAI_BASE_URL) in apps/web/.env.local, then restart the dev server.",
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

  const { messages, system, tools } = await req.json();

  const fullSystemPrompt = system
    ? `${SYSTEM_PROMPT}\n\n${system}`
    : SYSTEM_PROMPT;

  const result = streamText({
    model: modelProvider.chat(chatModel),
    system: fullSystemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: tools ? (frontendTools(tools) as unknown as ToolSet) : undefined,
  });

  return result.toUIMessageStreamResponse();
}
