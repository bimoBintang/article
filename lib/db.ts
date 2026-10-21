import { neon } from "@neondatabase/serverless";

// Lazy initialization so the module can be imported at build time
// without a DATABASE_URL being present.
let sql: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local to connect to Neon PostgreSQL."
      );
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

export async function query<T = unknown>(
  text: TemplateStringsArray | string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getSql().query(text as any, params || []);
  return result as unknown as T[];
}

export async function queryOne<T = unknown>(
  text: TemplateStringsArray | string,
  params?: unknown[]
): Promise<T | null> {
  const result = await getSql().query(text as any, params || []);
  const rows = result as unknown as any[];
  return rows.length > 0 ? (rows[0] as T) : null;
}
