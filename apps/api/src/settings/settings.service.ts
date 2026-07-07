import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, decryptSecret } from '../common/crypto.util';

export interface GatewayConfig {
  enabled?: boolean;
  // M-Pesa / e-Mola: the number that receives payments + display label
  number?: string;
  // Card (Visa/Stripe) / PayPal: public + secret credentials
  publicKey?: string;
  secretKey?: string;
  clientId?: string;
  clientSecret?: string;
  // sandbox | live
  mode?: 'sandbox' | 'live';
}

export type Gateways = Record<'visa' | 'paypal' | 'mpesa' | 'emola', GatewayConfig>;

export interface AssistantConfig {
  provider?: 'anthropic' | 'openai';
  apiKey?: string;
  model?: string;
  enabled?: boolean;
}

// Shown in the admin UI instead of a real secret so credentials never leave the
// server. Saving this value back keeps the stored secret unchanged.
const MASK = '••••••';

const DEFAULT_GATEWAYS: Gateways = {
  visa: { enabled: false, mode: 'sandbox' },
  paypal: { enabled: false, mode: 'sandbox' },
  mpesa: { enabled: false },
  emola: { enabled: false },
};

const DEFAULT_ASSISTANT: AssistantConfig = {
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  enabled: true,
};

// Secret fields that are encrypted at rest and masked in the admin view.
const GATEWAY_SECRETS: (keyof GatewayConfig)[] = ['secretKey', 'clientSecret'];

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private async getRaw<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!row) return fallback;
    return { ...fallback, ...(row.value as any) };
  }

  private async setRaw(key: string, value: any) {
    await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // Decide the value to store for a secret: keep existing when the incoming
  // value is empty or the mask; otherwise encrypt the new plaintext.
  private mergeSecret(incoming: string | undefined, existing: string | undefined): string | undefined {
    if (incoming === undefined || incoming === '' || incoming === MASK) return existing;
    return encryptSecret(incoming);
  }

  // ── Gateways ──────────────────────────────────────────────
  /** Decrypted gateways for internal use (checkout). */
  async getGateways(): Promise<Gateways> {
    const stored = await this.getRaw<Gateways>('gateways', DEFAULT_GATEWAYS);
    for (const g of Object.values(stored)) {
      for (const f of GATEWAY_SECRETS) {
        if (g[f]) (g as any)[f] = decryptSecret(g[f] as string);
      }
    }
    return stored;
  }

  private async getStoredGateways(): Promise<Gateways> {
    return this.getRaw<Gateways>('gateways', DEFAULT_GATEWAYS);
  }

  async saveGateways(value: Partial<Gateways>) {
    const stored = await this.getStoredGateways();
    const merged: any = { ...stored };
    for (const id of Object.keys(value) as (keyof Gateways)[]) {
      const incoming = value[id] || {};
      const prev = stored[id] || {};
      const next: any = { ...prev, ...incoming };
      for (const f of GATEWAY_SECRETS) {
        next[f] = this.mergeSecret(incoming[f] as string | undefined, prev[f] as string);
      }
      merged[id] = next;
    }
    await this.setRaw('gateways', merged);
    return this.maskedGateways(merged);
  }

  private maskedGateways(g: Gateways): Gateways {
    const out: any = JSON.parse(JSON.stringify(g));
    for (const cfg of Object.values(out) as GatewayConfig[]) {
      for (const f of GATEWAY_SECRETS) {
        if (cfg[f]) (cfg as any)[f] = MASK;
      }
    }
    return out;
  }

  // ── Assistant ─────────────────────────────────────────────
  async getAssistant(): Promise<AssistantConfig> {
    const stored = await this.getRaw<AssistantConfig>('assistant', DEFAULT_ASSISTANT);
    if (stored.apiKey) stored.apiKey = decryptSecret(stored.apiKey);
    return stored;
  }

  async saveAssistant(value: Partial<AssistantConfig>) {
    const stored = await this.getRaw<AssistantConfig>('assistant', DEFAULT_ASSISTANT);
    const merged: AssistantConfig = { ...stored, ...value };
    merged.apiKey = this.mergeSecret(value.apiKey, stored.apiKey);
    await this.setRaw('assistant', merged);
    return { ...merged, apiKey: merged.apiKey ? MASK : '' };
  }

  // ── Views ─────────────────────────────────────────────────
  /** Config for the SUPER_ADMIN settings page — secrets masked, never leaked. */
  async adminView() {
    const [gateways, assistant] = await Promise.all([this.getStoredGateways(), this.getRaw<AssistantConfig>('assistant', DEFAULT_ASSISTANT)]);
    return {
      gateways: this.maskedGateways(gateways),
      assistant: { ...assistant, apiKey: assistant.apiKey ? MASK : '' },
    };
  }

  /** Safe config for tenants/checkout: enabled gateways without secrets. */
  async publicGateways() {
    const g = await this.getStoredGateways();
    const strip = (c: GatewayConfig) => ({ enabled: !!c.enabled, number: c.number, mode: c.mode });
    return {
      visa: strip(g.visa),
      paypal: strip(g.paypal),
      mpesa: strip(g.mpesa),
      emola: strip(g.emola),
    };
  }
}
