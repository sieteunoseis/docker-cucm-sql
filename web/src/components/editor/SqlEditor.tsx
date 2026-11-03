import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { Schema } from "@shared/types";
import { monaco } from "@/lib/monaco";
import { tableForQualifier } from "@/lib/completions";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  value: string;
  onChange: (value: string) => void;
  schema: Schema | null;
  readOnly?: boolean;
  /** latest handlers; read through a ref so Monaco commands never go stale */
  onRun: () => void;
  onSave: () => void;
}

type Monaco = typeof monaco;

// One provider for the whole app; it reads the current schema from this ref.
const schemaRef: { current: Schema | null } = { current: null };
let providerRegistered = false;

function registerCompletions(m: Monaco) {
  if (providerRegistered) return;
  providerRegistered = true;
  m.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: ["."],
    provideCompletionItems(model, position) {
      const schema = schemaRef.current;
      if (!schema) return { suggestions: [] };
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const before = model.getLineContent(position.lineNumber).substring(0, word.startColumn - 1);
      const qualifier = /(\w+)\.\s*$/.exec(before)?.[1];
      if (qualifier) {
        const table = tableForQualifier(qualifier, model.getValue(), schema);
        return {
          suggestions: (table ? schema[table] : []).map((col) => ({
            label: col.name,
            kind: m.languages.CompletionItemKind.Field,
            detail: col.type,
            insertText: col.name,
            range,
          })),
        };
      }
      return {
        suggestions: Object.entries(schema).map(([table, cols]) => ({
          label: table,
          kind: m.languages.CompletionItemKind.Struct,
          detail: `${cols.length} columns`,
          insertText: table,
          range,
        })),
      };
    },
  });
}

export function SqlEditor({ value, onChange, schema, readOnly, onRun, onSave }: Props) {
  const { theme } = useTheme();
  const handlers = useRef({ onRun, onSave });

  useEffect(() => {
    handlers.current = { onRun, onSave };
  }, [onRun, onSave]);

  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  const handleMount: OnMount = (editor, m) => {
    registerCompletions(m);
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => handlers.current.onRun());
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => handlers.current.onSave());
    editor.focus();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Editor
        height="280px"
        language="sql"
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 12 },
          folding: false,
          renderLineHighlight: "none",
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          readOnly,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
