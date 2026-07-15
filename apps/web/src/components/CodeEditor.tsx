'use client';

import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism-tomorrow.css';

function grammarFor(path: string): { grammar: Prism.Grammar; lang: string } {
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (ext === 'json') return { grammar: Prism.languages.json, lang: 'json' };
  if (ext === 'sh' || ext === 'bash') return { grammar: Prism.languages.bash, lang: 'bash' };
  if (ext === 'html' || ext === 'xml') return { grammar: Prism.languages.markup, lang: 'markup' };
  // default to JavaScript for js/mjs/cjs/ts and unknown
  return { grammar: Prism.languages.javascript, lang: 'javascript' };
}

export function CodeEditor({
  value,
  onChange,
  path,
}: {
  value: string;
  onChange: (v: string) => void;
  path: string;
}) {
  const { grammar, lang } = grammarFor(path);
  return (
    <div className="min-h-[50vh] flex-1 overflow-auto rounded-lg bg-[#0b0f14]">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => {
          try {
            return Prism.highlight(code, grammar, lang);
          } catch {
            return code;
          }
        }}
        padding={12}
        textareaClassName="focus:outline-none"
        style={{
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 12.5,
          lineHeight: 1.6,
          minHeight: '50vh',
          color: '#e6edf3',
        }}
      />
    </div>
  );
}
