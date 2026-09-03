import { createClient, type Client, type InArgs, type InStatement, type InValue } from "@libsql/client";

export type DatabaseResult<T> = {
  results: T[];
  success: true;
};

export type PreparedStatement = {
  bind(...values: unknown[]): PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type Database = {
  prepare(sql: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<unknown[]>;
};

function normalizeValue(value: unknown): InValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError(`Unsupported database value: ${Object.prototype.toString.call(value)}`);
}

class LibsqlPreparedStatement implements PreparedStatement {
  private values: InArgs = [];

  constructor(private readonly client: Client, private readonly sql: string) {}

  bind(...values: unknown[]) {
    const statement = new LibsqlPreparedStatement(this.client, this.sql);
    statement.values = values.map(normalizeValue);
    return statement;
  }

  toStatement(): InStatement {
    return { sql: this.sql, args: this.values };
  }

  async all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>> {
    const result = await this.client.execute(this.toStatement());
    return { results: result.rows as unknown as T[], success: true };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.client.execute(this.toStatement());
    return (result.rows[0] as unknown as T | undefined) ?? null;
  }

  run() {
    return this.client.execute(this.toStatement());
  }
}

let database: Database | undefined;

export function getDatabase(): Database {
  if (database) return database;

  const url = process.env.TURSO_DATABASE_URL?.trim() || "file:land-and-earn.db";
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (url.startsWith("libsql:") && !authToken) {
    throw new Error("TURSO_AUTH_TOKEN is required for the configured Turso database.");
  }

  const client = createClient({ url, authToken });
  database = {
    prepare: (sql) => new LibsqlPreparedStatement(client, sql),
    batch: async (statements) => {
      const batch = statements.map((statement) => {
        if (!(statement instanceof LibsqlPreparedStatement)) throw new TypeError("Invalid prepared statement.");
        return statement.toStatement();
      });
      return client.batch(batch, "write");
    },
  };
  return database;
}
