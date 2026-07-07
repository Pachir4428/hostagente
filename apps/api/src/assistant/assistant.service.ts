import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `És o assistente do HostAgente, uma plataforma moçambicana de revenda de dados
móveis com deteção automática de pagamentos (M-Pesa, e-Mola, mKesh via MacroDroid)
e bots de WhatsApp (Baileys). Ajudas revendedores com dúvidas sobre:
- configurar bots (manuais e automáticos), upload de projetos, terminal, QR/pairing;
- automação de entregas e pacotes de dados;
- integração de pagamentos e webhooks;
- boas práticas de operação.
Responde sempre em português de forma curta, prática e passo-a-passo.`;

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(private settings: SettingsService) {}

  async chat(messages: ChatMessage[]): Promise<{ reply: string; source: 'ai' | 'fallback' }> {
    const cfg = await this.settings.getAssistant();
    const clean = (messages || []).filter((m) => m && m.content).slice(-12);

    if (!cfg.enabled || !cfg.apiKey) {
      return { reply: this.fallback(clean), source: 'fallback' };
    }

    try {
      if (cfg.provider === 'openai') {
        return { reply: await this.callOpenAI(cfg.apiKey, cfg.model || 'gpt-4o-mini', clean), source: 'ai' };
      }
      return {
        reply: await this.callAnthropic(cfg.apiKey, cfg.model || 'claude-haiku-4-5-20251001', clean),
        source: 'ai',
      };
    } catch (err: any) {
      this.logger.warn(`assistant AI call failed: ${err?.response?.status} ${err?.message}`);
      return { reply: this.fallback(clean), source: 'fallback' };
    }
  }

  private async callAnthropic(apiKey: string, model: string, messages: ChatMessage[]) {
    const res = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 30000,
      },
    );
    return res.data?.content?.[0]?.text?.trim() || 'Sem resposta.';
  }

  private async callOpenAI(apiKey: string, model: string, messages: ChatMessage[]) {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        max_tokens: 700,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        timeout: 30000,
      },
    );
    return res.data?.choices?.[0]?.message?.content?.trim() || 'Sem resposta.';
  }

  /** Rule-based answers when no AI key is configured, so the assistant still helps. */
  private fallback(messages: ChatMessage[]): string {
    const last = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const has = (...w: string[]) => w.some((x) => last.includes(x));

    if (has('upload', 'carregar', 'zip', 'pasta')) {
      return 'Para carregar um bot: entra em Bots → abre o bot manual → no painel de ficheiros à esquerda usa "ZIP", "Ficheiros" ou "Pasta". O ZIP deve ter o package.json na raiz. Depois clica em Iniciar para descompactar, correr npm install e arrancar.';
    }
    if (has('qr', 'pairing', 'ligar', 'conectar', 'whatsapp')) {
      return 'A ligação ao WhatsApp é feita pelo teu próprio projeto Baileys. Depois de Iniciar, o QR code ou o código de pairing aparecem na consola do bot. Lê e liga pelo telemóvel.';
    }
    if (has('terminal', 'comando', 'pkg', 'npm', 'node')) {
      return 'No terminal do bot podes correr comandos como: pkg install ffmpeg -y, npm install, node index.js. O pkg (estilo Termux) é mapeado para o apk do container automaticamente.';
    }
    if (has('pagamento', 'mpesa', 'e-mola', 'emola', 'macrodroid', 'automático', 'automatico')) {
      return 'Bots automáticos detetam pagamentos via MacroDroid: configura a API key em Conta & API, aponta o webhook do MacroDroid para o endpoint indicado, e cria os Pacotes (valor → dados) em Pacotes.';
    }
    if (has('checkout', 'assinar', 'plano', 'pagar')) {
      return 'Para assinar um plano: Assinatura → escolhe o plano → Checkout → escolhe o método (Visa, PayPal, M-Pesa ou e-Mola) e conclui. Os métodos disponíveis são definidos pelo administrador.';
    }
    return 'Posso ajudar com bots (upload, terminal, QR/pairing), automação de pagamentos (MacroDroid, M-Pesa, e-Mola), pacotes e checkout. Diz-me o que precisas. (Dica: o administrador pode ligar um assistente com IA em Definições → Assistente.)';
  }
}
