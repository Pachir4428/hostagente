'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';

interface Guide {
  cat: string;
  icon: string;
  title: string;
  steps: string[];
  tips?: string[];
}

const GUIDES: Guide[] = [
  {
    cat: 'Primeiros passos',
    icon: 'fa-rocket',
    title: 'Começar em 3 passos',
    steps: [
      'Cria o teu 1º pacote em Pacotes: define o valor recebido (ex: 50 MT) e os dados a entregar (ex: 1 GB).',
      'Vai a Conta & API e copia a tua chave (hka_...). É ela que liga o MacroDroid ou os bots à tua conta.',
      'Cria um bot em Bots: automático (deteta pagamentos via MacroDroid) ou manual (WhatsApp/Baileys).',
    ],
    tips: ['O painel mostra uma checklist de progresso no Resumo até concluíres estes passos.'],
  },
  {
    cat: 'Bot automático (MacroDroid)',
    icon: 'fa-bolt',
    title: 'Configurar deteção automática de pagamentos',
    steps: [
      'Instala a app MacroDroid no telemóvel que recebe os SMS de M-Pesa/e-Mola.',
      'Cria uma macro: Gatilho = "SMS recebido" (do M-Pesa/e-Mola).',
      'Ação = "Pedido HTTP POST" para o endpoint indicado em Conta & API, com o cabeçalho x-api-key = a tua chave.',
      'No corpo do pedido envia o valor, o número e a operadora (formato indicado na página Conta & API).',
      'Garante que o valor recebido corresponde a um Pacote definido — é assim que o sistema sabe o que entregar.',
    ],
    tips: [
      'Vê o estado "MacroDroid online" no Resumo para confirmar que está a comunicar.',
      'Se um valor não tiver pacote, a venda fica pendente para confirmares.',
    ],
  },
  {
    cat: 'Bot manual (WhatsApp/Baileys)',
    icon: 'fa-robot',
    title: 'Criar e iniciar um bot manual',
    steps: [
      'Em Bots clica em "Novo bot" → tipo Manual.',
      'Descarrega o "Bot-modelo" (Baileys pronto) ou a "Ponte de pagamentos" na página de Bots — ou usa o teu próprio projeto.',
      'Abre o bot e carrega o projeto: ZIP, Ficheiros ou Pasta. Usa o seletor "Carregar para:" para colocar no sítio certo.',
      'Em "Arranque" indica o ficheiro que inicia o bot (ex: index.js) ou deixa vazio para deteção automática.',
      'Clica em Iniciar. Lê o QR code que aparece no painel (WhatsApp → Aparelhos conectados → Conectar aparelho).',
      'Quando ligar, o estado fica "Ligado ao WhatsApp".',
    ],
    tips: [
      'As credenciais (chave/URL/ID) são injetadas automaticamente — não precisas de configurar .env.',
      'O bot reinicia sozinho se cair. A sessão do WhatsApp fica guardada (não precisas de novo QR a cada reinício).',
    ],
  },
  {
    cat: 'Bot manual',
    icon: 'fa-terminal',
    title: 'Terminal, atualizar e reverter código',
    steps: [
      'No terminal do bot podes correr comandos (ex: pkg install ffmpeg -y, npm install, node index.js).',
      'Para blocos grandes/EOF, usa o botão </> (script multi-linha).',
      'Para atualizar um ficheiro: abre-o na árvore, edita (com realce de sintaxe) e Guarda; ou usa "substituir" para carregar uma nova versão no mesmo caminho.',
      'Se algo correr mal, abre o ficheiro → Histórico → reverte para uma versão anterior.',
      'Reinicia o bot para aplicar as alterações.',
    ],
    tips: ['Os logs aparecem em tempo real. O botão "limpar" limpa o terminal.'],
  },
  {
    cat: 'Ponte de pagamentos',
    icon: 'fa-money-bill-transfer',
    title: 'Ler comprovantes M-Pesa/eMola no WhatsApp',
    steps: [
      'Na página de Bots, descarrega a "Ponte de pagamentos".',
      'Cria um bot manual e carrega o ZIP. Inicia e lê o QR.',
      'Edita o config.json (gestor de ficheiros): tabela de preços, o teu número de admin e os teus números de conta.',
      'Os clientes reenviam o SMS do M-Pesa/eMola ao número do bot; a ponte lê o valor e regista a venda.',
    ],
    tips: ['Valores fora da tabela ficam para confirmação manual e avisam-te.'],
  },
  {
    cat: 'Grupos',
    icon: 'fa-users',
    title: 'Gerir grupos e assinaturas',
    steps: [
      'Na página de um bot, secção Grupos: clica "Adicionar grupo" e mete o ID do grupo, plano e validade.',
      'Clica "Varrer" (com o bot ligado) para o bot colher a descrição, admins e membros desse grupo.',
      'Em Grupos (menu) vês todas as assinaturas, o estado (ativa/a expirar/expirada) e renovas com 1 clique.',
      'O sistema avisa-te por email quando uma assinatura está a expirar.',
    ],
  },
  {
    cat: 'Pagamentos & Assinatura',
    icon: 'fa-credit-card',
    title: 'Assinar planos, cupões e recibos',
    steps: [
      'Em Assinatura escolhe um plano e clica Assinar.',
      'No checkout escolhe o método (Visa, PayPal, M-Pesa, e-Mola) e, se tiveres, aplica um cupão de desconto.',
      'Para M-Pesa/e-Mola: paga para o número indicado com a referência e clica "Já paguei" — o admin confirma.',
      'Descarrega o recibo em PDF a partir do histórico de faturas.',
    ],
  },
  {
    cat: 'Crescer',
    icon: 'fa-gift',
    title: 'Convidar outros e ganhar',
    steps: [
      'Vai a Convidar & Ganhar e copia o teu link de convite.',
      'Partilha por WhatsApp. Quem se registar pelo link fica ligado a ti.',
      'Acompanha quantos convidaste e quantos ficaram ativos.',
    ],
  },
  {
    cat: 'Dicas & boas práticas',
    icon: 'fa-lightbulb',
    title: 'Recomendações importantes',
    steps: [
      'Usa um número de WhatsApp dedicado só para o bot (não o pessoal).',
      'Evita enviar muitas mensagens automáticas por minuto (risco de bloqueio da conta).',
      'Mantém a tabela de preços da ponte alinhada com os teus Pacotes.',
      'Guarda a tua chave de API em segredo; podes regenerá-la em Conta & API.',
      'Consulta os Insights para saber os pacotes mais vendidos e as horas de pico.',
    ],
  },
];

export default function AjudaPage() {
  const { user } = useAuth('TENANT');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(0);

  const filtered = useMemo(() => {
    if (!q.trim()) return GUIDES;
    const s = q.toLowerCase();
    return GUIDES.filter((g) => `${g.cat} ${g.title} ${g.steps.join(' ')} ${(g.tips || []).join(' ')}`.toLowerCase().includes(s));
  }, [q]);

  return (
    <AppShell nav={TENANT_NAV} title="Ajuda & Guias" email={user?.email}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          Guias passo-a-passo para instalar e iniciar bots, gerir pagamentos e grupos. Precisas de ajuda rápida? Usa o assistente <i className="fa-solid fa-headset text-teal" /> (canto inferior direito) ou abre um ticket em <Link href="/dashboard/support" className="text-teal hover:underline">Suporte</Link>.
        </p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar nos guias…" className="field max-w-xs text-sm" />
      </div>

      <div className="space-y-3">
        {filtered.map((g, i) => (
          <div key={g.title} className="card overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><i className={`fa-solid ${g.icon}`} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] uppercase tracking-wide text-muted2">{g.cat}</span>
                <span className="block font-display font-semibold">{g.title}</span>
              </span>
              <i className={`fa-solid fa-chevron-down text-xs text-muted transition ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="border-t border-line px-5 py-4">
                <ol className="space-y-2.5">
                  {g.steps.map((s, j) => (
                    <li key={j} className="flex gap-3 text-sm">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-hover text-[11px] font-semibold text-muted">{j + 1}</span>
                      <span className="text-ink">{s}</span>
                    </li>
                  ))}
                </ol>
                {g.tips && g.tips.length > 0 && (
                  <div className="mt-4 rounded-xl border border-gold/25 bg-gold/10 p-3">
                    {g.tips.map((t, k) => (
                      <p key={k} className="flex gap-2 text-xs text-gold"><i className="fa-solid fa-lightbulb mt-0.5" />{t}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="card p-6 text-center text-sm text-muted">Sem resultados para "{q}".</p>}
      </div>
    </AppShell>
  );
}
