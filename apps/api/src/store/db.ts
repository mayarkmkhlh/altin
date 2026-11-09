import type pg from "pg";

export type Queryable = {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
};

export type Db = Queryable & {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
};

function queryable(target: pg.Pool | pg.PoolClient): Queryable {
  return {
    async query<R>(sql: string, params?: unknown[]) {
      const { rows } = await target.query(sql, params);
      return { rows: rows as R[] };
    },
  };
}

export function pgDb(pool: pg.Pool): Db {
  return {
    ...queryable(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(queryable(client));
        await client.query("commit");
        return result;
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
