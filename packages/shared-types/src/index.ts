export enum BotStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
  WAITING_QR = 'waiting_qr',
}

export enum PlanType {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentProvider {
  MPESA = 'mpesa',
  EMOLA = 'emola',
  MKESH = 'mkesh',
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bot {
  id: string;
  name: string;
  status: BotStatus;
  userId: string;
  phoneNumber?: string;
  containerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  maxBots: number;
  priceMonthly: number;
  features: string[];
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerRef?: string;
  createdAt: Date;
}

export interface BotStatusEvent {
  botId: string;
  status: BotStatus;
  qrCode?: string;
  message?: string;
  timestamp: Date;
}

export interface CreateBotDto {
  name: string;
  phoneNumber?: string;
}

export interface StartBotResponse {
  success: boolean;
  containerId?: string;
  message?: string;
}
