'use client';

import { useEffect, useRef, useState } from 'react';
import { authApi } from '@/lib/api';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME: Msg = {
  role: 'assistant',
  content: 'Olá! Sou o assistente do HostAgente. Pergunta-me sobre bots, terminal, QR/pairing, automação de pagamentos ou pacotes. 🤖',
};

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...msgs, { role: 'user' as const, content: text }];
    setMsgs(next);
    setInput('');
    setSending(true);
    try {
      const res = await authApi.post('/assistant/chat', {
        messages: next.filter((m) => m !== WELCOME).map((m) => ({ role: m.role, content: m.content })),
      });
      setMsgs((m) => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Não consegui responder agora. Tenta novamente.' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Assistente"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-teal text-white shadow-lg shadow-teal/30 transition hover:scale-105"
      >
        <i className={`fa-solid ${open ? 'fa-xmark' : 'fa-headset'} text-lg`} />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[70vh] max-h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center gap-3 border-b border-line bg-surface2 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-teal/10 text-teal"><i className="fa-solid fa-robot" /></span>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold">Assistente HostAgente</p>
              <p className="truncate text-xs text-muted">Bots & automação</p>
            </div>
          </div>

          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === 'user' ? 'bg-teal text-white' : 'bg-hover text-ink'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div className="text-xs text-muted">A escrever…</div>}
          </div>

          <div className="flex items-center gap-2 border-t border-line p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Escreve a tua dúvida…"
              className="field flex-1 !py-2"
            />
            <button onClick={send} disabled={sending} className="btn-primary !px-3 !py-2" aria-label="Enviar">
              <i className="fa-solid fa-paper-plane" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
