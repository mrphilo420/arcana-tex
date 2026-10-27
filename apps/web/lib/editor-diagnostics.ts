import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

export interface EditorDiagnosticMark {
  line: number;
  severity: "error" | "warning";
}

export const setEditorDiagnostics =
  StateEffect.define<EditorDiagnosticMark[]>();

const diagnosticsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (!effect.is(setEditorDiagnostics)) continue;

      const marks = [...effect.value]
        .filter(
          (mark) => mark.line >= 1 && mark.line <= transaction.state.doc.lines,
        )
        .sort((a, b) => a.line - b.line);
      const seen = new Set<string>();
      const builder = new RangeSetBuilder<Decoration>();

      for (const mark of marks) {
        const key = `${mark.line}:${mark.severity}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const line = transaction.state.doc.line(mark.line);
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            class:
              mark.severity === "error"
                ? "cm-diagnostic-error"
                : "cm-diagnostic-warning",
            attributes: {
              title:
                mark.severity === "error"
                  ? "Compile error on this line"
                  : "Compile warning on this line",
            },
          }),
        );
      }

      next = builder.finish();
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const diagnosticHighlightExtension = diagnosticsField;
