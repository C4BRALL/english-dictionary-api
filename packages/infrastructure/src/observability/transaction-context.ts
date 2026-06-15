import { AsyncLocalStorage } from 'node:async_hooks';

export interface TransactionContext {
  transactionId: string;
  userId?: string;
}

const transactionStorage = new AsyncLocalStorage<TransactionContext>();

export function runWithTransaction<T>(context: TransactionContext, callback: () => T): T {
  return transactionStorage.run({ ...context }, callback);
}

export function getTransactionContext(): TransactionContext | undefined {
  return transactionStorage.getStore();
}

export function setTransactionUserId(userId: string): void {
  const context = transactionStorage.getStore();

  if (context) {
    context.userId = userId;
  }
}
