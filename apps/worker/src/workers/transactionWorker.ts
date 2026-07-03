import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TransactionJobData {
  transactionId: string;
}

/**
 * Post-processing for a detected payment transaction:
 * try to match it to a product (by tenant + amount + operator) and mark it
 * delivered/refused accordingly. This runs async after the ingest endpoint
 * records the raw transaction.
 */
export async function transactionWorker(data: TransactionJobData): Promise<any> {
  const tx = await prisma.transaction.findUnique({ where: { id: data.transactionId } });
  if (!tx) return { error: 'Transaction not found' };
  if (tx.status !== 'pending') return { skipped: true, status: tx.status };

  const product = await prisma.product.findFirst({
    where: {
      tenantId: tx.tenantId,
      amount: tx.amount,
      active: true,
      autoDetect: true,
      OR: [{ operator: tx.operator }, { operator: null }],
    },
  });

  const updated = await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      productId: product?.id ?? null,
      status: product ? 'delivered' : 'refused',
    },
  });

  return { transactionId: updated.id, status: updated.status, productId: updated.productId };
}
