import { NextResponse } from "next/server";
import { compileRatelimit, getIP } from "@/lib/ratelimit";

export const maxDuration = 60;

interface CompileResource {
  path: string;
  content?: string;
  file?: string;
  main?: boolean;
}

export async function POST(req: Request) {
  if (compileRatelimit) {
    const ip = getIP(req);
    const { success, limit, remaining, reset } =
      await compileRatelimit.limit(ip);

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

  try {
    const {
      resources,
      compiler,
      includeLog = false,
    } = (await req.json()) as {
      resources: CompileResource[];
      compiler?: string;
      includeLog?: boolean;
    };

    if (!resources || resources.length === 0) {
      return NextResponse.json(
        { error: "No resources provided" },
        { status: 400 },
      );
    }

    const latexCompiler =
      compiler === "xelatex" || compiler === "lualatex" ? compiler : "pdflatex";

    const apiResources = resources.map((r) => {
      const resource: Record<string, unknown> = {
        path: r.path,
      };

      const isBase64Image =
        r.content &&
        !r.file &&
        (r.content.startsWith("/9j/") || r.content.startsWith("iVBOR"));

      if (isBase64Image) {
        const cleanBase64 = r.content?.replace(/\s/g, "");
        resource.file = cleanBase64;
      } else if (r.content) {
        resource.content = r.content;
      }

      if (r.file) {
        const cleanBase64 = r.file.replace(/\s/g, "");
        resource.file = cleanBase64;
      }
      if (r.main) resource.main = r.main;
      return resource;
    });

    const latexApiUrl = process.env.LATEX_API_URL || "http://localhost:3001";
    const response = await fetch(`${latexApiUrl}/builds/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        compiler: latexCompiler,
        resources: apiResources,
        includeLog,
      }),
    });

    const contentType = response.headers.get("content-type") ?? "";

    if (
      !response.ok ||
      (includeLog && !contentType.includes("application/json"))
    ) {
      const errorData = contentType.includes("application/json")
        ? await response.json()
        : { error: "Compilation failed" };
      const logContent =
        errorData.log_files?.["__main_document__.log"] ?? errorData.log ?? "";
      const errorLines = logContent
        .split("\n")
        .filter(
          (line: string) =>
            line.includes("Error") ||
            line.includes("!") ||
            line.includes("Missing"),
        )
        .slice(0, 10)
        .join("\n");
      return NextResponse.json(
        {
          error: `Compilation failed: ${errorData.error || "Unknown error"}`,
          details: errorLines || logContent.slice(-1000),
          log: logContent.slice(-200_000),
        },
        { status: 500 },
      );
    }

    if (includeLog) {
      const result = (await response.json()) as {
        pdf?: string;
        log?: string;
      };

      if (!result.pdf) {
        return NextResponse.json(
          { error: "Compilation returned no PDF", log: result.log ?? "" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        pdf: result.pdf,
        log: result.log ?? "",
      });
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=document.pdf",
      },
    });
  } catch (error) {
    console.error("Compilation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown compilation error",
      },
      { status: 500 },
    );
  }
}
