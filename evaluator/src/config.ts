// Resolved paths and service URLs. URLs only fall back to a default
// when the caller has not already exported one, so `--reuse-db` can
// point at services running anywhere.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EVALUATOR_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPORT_DIR = path.join(EVALUATOR_DIR, 'report');
export const RUBRIC_PATH = path.join(EVALUATOR_DIR, 'rubric.config.json');

const DEFAULT_UV_BIN = '/opt/homebrew/bin/uv';

export interface EvaluatorConfig {
  apiUrl: string;
  analyticsUrl: string;
  databaseUrl: string;
  apiPort: string;
  analyticsPort: string;
  uvBin: string;
}

function portOf(url: string, fallback: string): string {
  const parsed = new URL(url);
  return parsed.port || fallback;
}

function resolveUvBin(): string {
  const fromEnv = process.env.EVALUATOR_UV_BIN;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  if (fs.existsSync(DEFAULT_UV_BIN)) return DEFAULT_UV_BIN;
  return 'uv';
}

export function loadConfig(): EvaluatorConfig {
  const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';
  const analyticsUrl = process.env.ANALYTICS_URL ?? 'http://127.0.0.1:8010';
  const databaseUrl = process.env.DATABASE_URL ?? 'postgres://ats:ats@localhost:5432/ats';
  return {
    apiUrl,
    analyticsUrl,
    databaseUrl,
    apiPort: portOf(apiUrl, '3000'),
    analyticsPort: portOf(analyticsUrl, '8010'),
    uvBin: resolveUvBin(),
  };
}
