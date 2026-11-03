export interface ClusterConfig {
  id: string;
  name: string;
  hostname: string;
  username: string;
  password: string;
  version: string;
}

export interface AppConfig {
  version: string;
  dataDir: string;
  port: number;
  queryTimeoutMs: number;
  maxBatches: number;
  logRetentionMonths: number;
  apiKey: string | null;
  clusters: ClusterConfig[];
  defaultClusterId: string;
}
