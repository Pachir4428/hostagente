import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface MessageJobData {
  botId: string;
  from: string;
  body: string;
  timestamp: number;
}

export async function messageWorker(data: MessageJobData): Promise<any> {
  const { botId, from, body, timestamp } = data;

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) {
    return { error: 'Bot not found' };
  }

  // Basic message processing logic
  const response = await processMessage(body);

  return {
    botId,
    from,
    processed: true,
    response,
    timestamp,
  };
}

async function processMessage(body: string): Promise<string> {
  const lower = body.toLowerCase().trim();

  if (lower === 'hi' || lower === 'hello' || lower === 'ola') {
    return 'Hello! How can I help you today?';
  }

  if (lower === 'help') {
    return 'Available commands: hi, help, status';
  }

  if (lower === 'status') {
    return 'Bot is running normally.';
  }

  // If OpenAI is available, use it
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful WhatsApp assistant. Keep responses brief.' },
          { role: 'user', content: body },
        ],
        max_tokens: 200,
      });
      return completion.choices[0]?.message?.content || 'Sorry, I could not understand that.';
    } catch {
      // Fall through to default
    }
  }

  return 'Message received. Thank you!';
}
