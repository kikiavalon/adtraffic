import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface TelemetryConfig {
  consent: boolean;
  installId?: string;
  email?: string;
  agency?: string;
  createdAt?: string;
  noticeShown?: boolean;
}

function telemetryDir(): string {
  return process.env.ADTRAFFIC_TELEMETRY_DIR ?? join(homedir(), '.adtraffic');
}

function configPath(): string {
  return join(telemetryDir(), 'telemetry.json');
}

export function configExists(): boolean {
  return existsSync(configPath());
}

export function readConfig(): TelemetryConfig | null {
  try {
    if (!existsSync(configPath())) return null;
    const parsed = JSON.parse(readFileSync(configPath(), 'utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as TelemetryConfig).consent !== 'boolean'
    ) {
      return null;
    }
    return parsed as TelemetryConfig;
  } catch {
    return null;
  }
}

export function writeConfig(partial: Partial<TelemetryConfig>): TelemetryConfig {
  const existing = readConfig() ?? { consent: false };
  const merged: TelemetryConfig = { ...existing, ...partial };
  mkdirSync(telemetryDir(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}
