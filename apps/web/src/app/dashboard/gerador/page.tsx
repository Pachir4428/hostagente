'use client';

import { useAuth } from '@/lib/useAuth';
import { AppShell } from '@/components/AppShell';
import { TENANT_NAV } from '@/lib/nav';
import { CodeGenerator } from '@/components/CodeGenerator';

export default function GeradorPage() {
  const { user } = useAuth('TENANT');
  return (
    <AppShell nav={TENANT_NAV} title="Gerador de código" email={user?.email}>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Cria comandos Baileys e nanos para os teus bots. Gera, copia (ou descarrega) e cola no gestor de ficheiros do bot (ex: <span className="font-mono">src/comandos/</span>), depois reinicia o bot.
      </p>
      <CodeGenerator canSave />
    </AppShell>
  );
}
