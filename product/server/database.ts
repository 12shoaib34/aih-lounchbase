import postgres from "postgres";

export type DatabaseBindings = {
  FILES?: {
    put(
      key: string,
      value: ArrayBuffer,
      options?: {
        onlyIf: Headers;
        customMetadata: Record<string, string>;
      },
    ): Promise<{ size: number } | null>;
    get(key: string): Promise<{
      size?: number;
      version?: string;
      customMetadata?: Record<string, string>;
      arrayBuffer(): Promise<ArrayBuffer>;
    } | null>;
    head?(key: string): Promise<{ size: number } | null>;
    list?(options: { limit: number; cursor?: string }): Promise<{
      objects: { key: string; size: number }[];
      truncated: boolean;
      cursor?: string;
    }>;
    delete(key: string): Promise<void>;
  };
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
};

export function connectDatabase(bindings: DatabaseBindings) {
  const connectionString =
    bindings.HYPERDRIVE?.connectionString ?? bindings.DATABASE_URL;
  if (!connectionString) throw new Error("Database is not configured.");
  return postgres(connectionString, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
  });
}
