/**
 * Minimal chainable stand-in for drizzle `db` used by L2 route tests.
 * Tests enqueue select replies in call order; insert/update/txn are stubbed.
 */

type Reply = unknown[] | (() => unknown[]);

function resolveReply(reply: Reply | undefined): unknown[] {
  if (reply === undefined) return [];
  return typeof reply === "function" ? reply() : reply;
}

function makeThenable<T>(value: () => T | Promise<T>) {
  return {
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(value()).then(onfulfilled, onrejected);
    },
    limit: async (_n?: number) => value(),
    orderBy: async (..._args: unknown[]) => value(),
    returning: async (..._args: unknown[]) => value(),
  };
}

export class ScriptedDb {
  private selectQueue: Reply[] = [];
  insertReturning: unknown[] = [];
  updateReturning: unknown[] = [];
  /** When set, transaction callback receives this as `tx` (defaults to self proxy). */
  transactionImpl: ((fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>) | null = null;

  reset() {
    this.selectQueue = [];
    this.insertReturning = [];
    this.updateReturning = [];
    this.transactionImpl = null;
  }

  enqueueSelect(...replies: Reply[]) {
    this.selectQueue.push(...replies);
  }

  private nextSelect(): unknown[] {
    return resolveReply(this.selectQueue.shift());
  }

  private selectChain() {
    const self = this;
    const terminal = makeThenable(() => self.nextSelect());
    const afterFrom = {
      where: () => terminal,
      innerJoin: () => ({
        where: () => makeThenable(() => self.nextSelect()),
      }),
      leftJoin: () => ({
        where: () => makeThenable(() => self.nextSelect()),
      }),
      ...terminal,
    };
    return {
      from: () => afterFrom,
    };
  }

  asDb() {
    const self = this;
    const api = {
      select: () => self.selectChain(),
      insert: () => ({
        values: () => ({
          returning: async () => self.insertReturning,
          onConflictDoUpdate: () => Promise.resolve(undefined),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => makeThenable(() => self.updateReturning),
        }),
      }),
      delete: () => ({
        where: async () => undefined,
      }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        if (self.transactionImpl) return self.transactionImpl(fn);
        return fn(api);
      },
    };
    return api;
  }
}
