// Bundle Monaco instead of letting @monaco-editor/react fetch it from a CDN at runtime.
import { loader } from "@monaco-editor/react";
import type * as MonacoApi from "monaco-editor";
// editor.main = editor + built-in features + language tokenizers (no TS/JSON/CSS services are started)
import * as monacoMain from "monaco-editor/editor/editor.main";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";

const monaco = monacoMain as unknown as typeof MonacoApi;

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export { monaco };
