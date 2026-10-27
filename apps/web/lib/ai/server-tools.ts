import { tool, type LanguageModel, type ToolSet } from "ai";
import { z } from "zod";
import { runLocalCode } from "@/lib/code-runner";
import { runSubagents, subagentTaskSchema } from "@/lib/ai/subagents";

const codeFileSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(240)
    .describe("Relative path for an input file, for example data.csv"),
  content: z.string().max(20_000).describe("Complete UTF-8 file content"),
});

const codeInputSchema = z.object({
  code: z.string().min(1).max(60_000).describe("The complete script to run"),
  timeoutMs: z
    .number()
    .int()
    .min(1_000)
    .max(30_000)
    .optional()
    .describe("Optional timeout in milliseconds; default 20000"),
  files: z
    .array(codeFileSchema)
    .max(8)
    .optional()
    .describe("Optional input files written beside the script"),
});

const subagentInputSchema = z.object({
  context: z
    .string()
    .max(24_000)
    .optional()
    .describe("Shared project or task context for every subagent"),
  tasks: z.array(subagentTaskSchema).min(1).max(4),
});

function codeTool(language: "python" | "r", modelLabel: string) {
  return tool({
    description: `${modelLabel} execution for computational figures: run a complete script in an isolated temporary directory and return stdout, stderr, and text artifacts. Use it to compute geometry, process data, or write a complete TikZ/PGF artifact (for example figure.tex). Prefer direct TikZ for simple figures. Never claim the script ran before this tool returns.`,
    inputSchema: codeInputSchema,
    execute: async (input) => {
      try {
        return await runLocalCode({
          language,
          code: input.code,
          timeoutMs: input.timeoutMs,
          files: input.files,
        });
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : `${modelLabel} failed.`,
        };
      }
    },
  });
}

export function createServerTools(model: LanguageModel): ToolSet {
  return {
    run_python: codeTool("python", "Python"),
    run_r: codeTool("r", "R"),
    spawn_subagents: tool({
      description:
        "Delegate independent parts of a task to up to four parallel subagents. Use this for complex TikZ figure requests, for example one Python geometry agent, one R/statistics agent, and one TikZ reviewer. Each subagent has no project tools and cannot execute code; give it focused context. Verify and synthesize its answer before inserting anything.",
      inputSchema: subagentInputSchema,
      execute: async (input) => {
        try {
          const results = await runSubagents({
            model,
            context: input.context,
            tasks: input.tasks,
          });
          return {
            success: results.every((result) => !result.error),
            results,
            succeeded: results.filter((result) => !result.error).length,
            failed: results.filter((result) => result.error).length,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Subagents failed.",
          };
        }
      },
    }),
  };
}
