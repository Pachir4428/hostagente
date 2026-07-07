import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  getGateways() {
    return this.getRaw<Gateways>('gateways', DEFAULT_GATEWAYS);
  }

  async saveGateways(value: Partial<Gateways>) {
    const current = await this.getGateways();
    const merged = { ...current, ...value } as Gateways;
    await this.setRaw('gateways', merged);
    return merged;
  }

  getAssistant() {
    return this.getRaw<AssistantConfig>('assistant', DEFAULT_ASSISTANT);
  }

  async saveAssistant(value: Partial<AssistantConfig>) {
    const current = await this.getAssistant();
    const merged = { ...current, ...value } as AssistantConfig;
    await this.setRaw('assistant', merged);
    return merged;
  }

  /** Full config for the SUPER_ADMIN settings page (includes secrets). */
  async adminView() {
    const [gateways, assistant] = await Promise.all([this.getGateways(), this.getAssistant()]);
    return { gateways, assistant };
  }

  /** Safe config for tenants/checkout: enabled gateways without secrets. */
  async publicGateways() {
    const g = await this.getGateways();
    const strip = (c: GatewayConfig) => ({ enabled: !!c.enabled, number: c.number, mode: c.mode });
    return {
      visa: strip(g.visa),
      paypal: strip(g.paypal),
      mpesa: strip(g.mpesa),
      emola: strip(g.emola),
    };
  }
}
