import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PaymentJobData {
  paymentId: string;
  userId: string;
  amount: number;
  provider: string;
  providerRef: string;
}

export async function paymentWorker(data: PaymentJobData): Promise<any> {
  const { paymentId, userId, amount, provider, providerRef } = data;

  // Update payment status to completed
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'completed' },
  });

  // Check if there's a subscription to activate/extend
  if (payment.subscriptionId) {
    const sub = await prisma.subscription.findUnique({
      where: { id: payment.subscriptionId },
      include: { plan: true },
    });

    if (sub) {
      const newEnd = new Date(sub.currentPeriodEnd);
      newEnd.setMonth(newEnd.getMonth() + 1);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'active',
          currentPeriodEnd: newEnd,
        },
      });
    }
  }

  return {
    paymentId,
    userId,
    confirmed: true,
    provider,
    providerRef,
  };
}
