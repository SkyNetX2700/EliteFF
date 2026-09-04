import { db } from "@workspace/db";
import {
  contactTable,
  bestPlayerExclusionsTable,
  feedbackTable,
  historyTable,
  matchResultsTable,
  notificationsTable,
  registrationsTable,
  scoreboardTable,
  tournamentsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";

const tables: Record<string, any> = {
  contacts: contactTable,
  best_player_exclusions: bestPlayerExclusionsTable,
  feedback: feedbackTable,
  history: historyTable,
  match_results: matchResultsTable,
  notifications: notificationsTable,
  registrations: registrationsTable,
  scoreboard: scoreboardTable,
  tournaments: tournamentsTable,
  users: usersTable,
};

function snakeToCamel(value: any): any {
  if (Array.isArray(value)) return value.map(snakeToCamel);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    snakeKeyToCamel(key),
    snakeToCamel(item),
  ]));
}

function snakeKeyToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function snakeToSchemaKeys(table: any, value: any): any {
  if (Array.isArray(value)) return value.map(item => snakeToSchemaKeys(table, item));
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const schemaKey = snakeKeyToCamel(key);
    const resolvedKey = table[schemaKey] ? schemaKey : table[key] ? key : null;
    if (!resolvedKey) throw new Error(`Unknown field "${key}"`);
    return [resolvedKey, snakeToSchemaKeys(table, item)];
  }));
}

function column(table: any, name: string): any {
  const camelName = snakeKeyToCamel(name);
  const resolvedColumn = table[camelName] ?? table[name];
  if (!resolvedColumn) throw new Error(`Unknown field "${name}"`);
  return resolvedColumn;
}

class DataQuery {
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private values: any;
  private filters: any[] = [];
  private sort: { field: string; ascending: boolean } | null = null;
  private maxRows: number | undefined;
  private one = false;
  private countOnly = false;

  constructor(private readonly tableName: string) {}

  select(_fields = "*", options?: { count?: string; head?: boolean }) {
    if (options?.count === "exact") this.countOnly = true;
    return this;
  }

  insert(values: any) {
    this.operation = "insert";
    this.values = values;
    return this;
  }

  update(values: any) {
    this.operation = "update";
    this.values = values;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push(eq(column(tables[this.tableName], field), value));
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push(inArray(column(tables[this.tableName], field), values));
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push(gte(column(tables[this.tableName], field), value));
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.sort = { field, ascending: options?.ascending !== false };
    return this;
  }

  limit(rows: number) {
    this.maxRows = rows;
    return this;
  }

  single() {
    this.one = true;
    return this;
  }

  maybeSingle() {
    this.one = true;
    return this;
  }

  private whereClause(table: any) {
    return this.filters.length ? and(...this.filters) : undefined;
  }

  async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const table = tables[this.tableName];
      if (!table) throw new Error(`Unknown data table: ${this.tableName}`);
      const where = this.whereClause(table);

      if (this.operation === "select") {
        const requestedSortColumn = this.sort ? column(table, this.sort.field) : null;
        const sortColumn = requestedSortColumn ?? table.createdAt ?? table.id;
        const orderExpression = this.sort
          ? (this.sort.ascending ? asc(sortColumn) : desc(sortColumn))
          : desc(sortColumn);
        const rows = await db.select().from(table)
          .where(where)
          .orderBy(orderExpression)
          .limit(this.maxRows ?? 100000);
        const data = rows.map(row => toSnakeCase(row));
        if (this.countOnly) return { data: null, error: null, count: data.length };
        if (this.one) return { data: data[0] ?? null, error: null };
        return { data, error: null };
      }

      if (this.operation === "insert") {
        const items = (Array.isArray(this.values) ? this.values : [this.values])
          .map(item => snakeToSchemaKeys(table, item));
        const inserted = (await db.insert(table).values(items as any).returning()) as any[];
        const data = inserted.map((row: any) => toSnakeCase(row));
        if (this.one) return { data: data[0] ?? null, error: null };
        return { data, error: null };
      }

      if (this.operation === "update") {
        const updated = (await db.update(table).set(snakeToSchemaKeys(table, this.values)).where(where).returning()) as any[];
        const data = updated.map((row: any) => toSnakeCase(row));
        if (this.one) return { data: data[0] ?? null, error: null };
        return { data, error: null };
      }

      const deleted = (await db.delete(table).where(where).returning()) as any[];
      const data = deleted.map((row: any) => toSnakeCase(row));
      return { data: this.one ? (data[0] ?? null) : data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }
}

function toSnakeCase(value: any): any {
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
    toSnakeCase(item),
  ]));
}

export function dataClient() {
  return {
    from(tableName: string) {
      return new DataQuery(tableName);
    },
  };
}

export function camel(value: any) {
  return snakeToCamel(value);
}

export function camels(value: any[]) {
  return snakeToCamel(value ?? []);
}

export function safeUser(value: any) {
  if (!value) return null;
  const user = { ...value };
  delete user.passwordHash;
  delete user.resetToken;
  delete user.resetTokenExpiry;
  delete user.password_hash;
  delete user.reset_token;
  delete user.reset_token_expiry;
  return user;
}

export function publicTournament(value: any) {
  if (!value) return null;
  // The UPI ID and QR URL are intentionally public tournament payment details.
  // They are needed by players before registration so the QR can encode the
  // exact amount and payment destination.
  return snakeToCamel({ ...value });
}