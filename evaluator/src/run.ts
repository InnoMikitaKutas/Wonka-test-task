// Evaluator entry point. See docs/03-evaluation.md for the full
// design: the four stages, the scorecard shape, the rubric weights,
// the recovery rule.
//
// Usage:
//   pnpm run run -- --submission <dir> [--seed <seed>] [--reuse-db] [--base <ref>]
//
// <dir> is a candidate's copy of task/: a git repo whose first commit
// is the untouched initial state. Grades black-box, through the replay
// CLI, HTTP endpoints, the projections DB, and git. Never imports the
// submission's internal modules.

import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildDiffReport } from './analysis/diff-report.js';
import { buildHistoryReport } from './analysis/history-report.js';
import { REPORT_DIR, RUBRIC_PATH, loadConfig, type EvaluatorConfig } from './config.js';
import { landmineDetectors, runFunctional } from './detectors/index.js';
import { exec, git, spawnLogged } from './lib/exec.js';
import { probe, sleep } from './lib/http.js';
import type { DetectorContext, DetectorResult, Rubric } from './lib/types.js';
import { buildScorecard, renderMarkdown, summarize, writeScorecard } from './report/render.js';

function log(message: string): void {
  const time = new Date().toTimeString().slice(0, 8);
  console.error(`[evaluator ${time}] ${message}`);
}

interface CliArgs {
  submission: string;
  seed: string;
  reuseDb: boolean;
  base: string | null;
}

const USAGE = 'usage: run.ts --submission <dir> --seed <seed> [--reuse-db] [--base <ref>]';

function parseArgs(rawArgv: string[]): CliArgs {
  // A leading "--" is the conventional npm/pnpm separator between the
  // package-manager's own flags and the script's arguments. Node does
  // not strip it when running a file (only in `node -e` mode does it
  // vanish), so tolerate one here rather than rejecting it.
  const argv = rawArgv[0] === '--' ? rawArgv.slice(1) : rawArgv;

  let submission = '';
  let seed = 'wonka-demo-001';
  let reuseDb = false;
  let base: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--submission') {
      submission = argv[++i] ?? '';
    } else if (arg === '--seed') {
      seed = argv[++i] ?? seed;
    } else if (arg === '--reuse-db') {
      reuseDb = true;
    } else if (arg === '--base') {
      base = argv[++i] ?? null;
    } else {
      throw new Error(`unknown argument: ${arg}\n${USAGE}`);
    }
  }
  if (!submission) throw new Error(USAGE);
  return { submission, seed, reuseDb, base };
}

async function resolveBaseRef(submissionDir: string): Promise<string> {
  const result = await git(['rev-list', '--max-parents=0', 'HEAD'], submissionDir);
  const roots = result.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  return roots[roots.length - 1] ?? '';
}

async function waitForPostgresHealthy(submissionDir: string): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    const result = await exec('docker', ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'ats', '-d', 'ats'], {
      cwd: submissionDir,
    });
    if (result.code === 0) return true;
    await sleep(1000);
  }
  return false;
}

interface Stage0Handles {
  apiProcess: ChildProcess | null;
  analyticsProcess: ChildProcess | null;
}

async function runStage0(submissionDir: string, config: EvaluatorConfig, workDir: string): Promise<Stage0Handles> {
  log('Stage 0: fresh setup');

  await exec('pnpm', ['install'], { cwd: submissionDir, timeoutMs: 10 * 60 * 1000 });
  await exec('pnpm', ['-r', 'build'], { cwd: submissionDir, timeoutMs: 10 * 60 * 1000 });
  await exec('docker', ['compose', 'up', '-d'], { cwd: submissionDir });

  log('waiting for postgres to become healthy...');
  const healthy = await waitForPostgresHealthy(submissionDir);
  if (!healthy) log('postgres did not become healthy in time; continuing anyway (Stage 0 failures are recorded, not fatal)');

  if ((await exec('pnpm', ['db:migrate'], { cwd: submissionDir })).code !== 0) log('warning: pnpm db:migrate failed');
  if ((await exec('pnpm', ['db:seed'], { cwd: submissionDir })).code !== 0) log('warning: pnpm db:seed failed');
  if ((await exec('pnpm', ['--filter', '@ats/projector', 'project'], { cwd: submissionDir })).code !== 0) {
    log('warning: initial projector catch-up failed');
  }

  log(`starting api on ${config.apiUrl} (port ${config.apiPort})`);
  const apiProcess = spawnLogged('node', ['packages/api/dist/main.js'], {
    cwd: submissionDir,
    env: { ...process.env, PORT: config.apiPort, DATABASE_URL: config.databaseUrl },
    logFile: path.join(workDir, 'api.log'),
  });
  const apiReady = await probe(`${config.apiUrl}/candidates/__evaluator_probe__`);
  if (apiReady.status === 0) log(`warning: api did not answer within the retry budget; see ${path.join(workDir, 'api.log')}`);

  log('installing analytics deps with uv');
  const analyticsDir = path.join(submissionDir, 'services/analytics');
  if ((await exec(config.uvBin, ['sync'], { cwd: analyticsDir })).code !== 0) log('warning: uv sync failed; is uv installed?');

  log(`starting analytics on ${config.analyticsUrl} (port ${config.analyticsPort})`);
  const analyticsProcess = spawnLogged(config.uvBin, ['run', 'uvicorn', 'app.main:app', '--port', config.analyticsPort], {
    cwd: analyticsDir,
    env: { ...process.env, DATABASE_URL: config.databaseUrl },
    logFile: path.join(workDir, 'analytics.log'),
  });
  const analyticsReady = await probe(`${config.analyticsUrl}/health`);
  if (analyticsReady.status === 0) {
    log(`warning: analytics did not answer within the retry budget; see ${path.join(workDir, 'analytics.log')}`);
  }

  return { apiProcess, analyticsProcess };
}

async function cleanup(submissionDir: string, reuseDb: boolean, handles: Stage0Handles): Promise<void> {
  if (reuseDb) {
    log('reuse-db: leaving postgres and any already-running services alone');
    return;
  }
  if (handles.apiProcess) {
    log(`stopping api (pid ${handles.apiProcess.pid ?? '?'})`);
    handles.apiProcess.kill('SIGTERM');
  }
  if (handles.analyticsProcess) {
    log(`stopping analytics (pid ${handles.analyticsProcess.pid ?? '?'})`);
    handles.analyticsProcess.kill('SIGTERM');
  }
  if (fs.existsSync(path.join(submissionDir, 'docker-compose.yml'))) {
    log('stopping docker compose in the submission');
    await exec('docker', ['compose', 'down'], { cwd: submissionDir });
  }
}

async function runLandmineDetectors(
  ctx: DetectorContext,
): Promise<{ landmines: Record<string, DetectorResult>; staticExplainers: DetectorResult }> {
  const landmines: Record<string, DetectorResult> = {};
  let staticExplainers: DetectorResult = { id: 'STATIC', verdict: 'MISSING', evidence: 'did not run' };

  for (const detector of landmineDetectors) {
    let result: DetectorResult;
    try {
      result = await detector.run(ctx);
    } catch (err) {
      const message = `detector ${detector.id} crashed: ${err instanceof Error ? err.message : String(err)}`;
      log(message);
      result = { id: detector.id, verdict: 'MISSING', evidence: message };
    }
    if (detector.id === 'STATIC') staticExplainers = result;
    else landmines[detector.id] = result;
  }

  return { landmines, staticExplainers };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const submissionDir = fs.realpathSync(args.submission);
  log(`submission: ${submissionDir}`);

  const baseRef = args.base ?? (await resolveBaseRef(submissionDir));
  log(`base ref: ${baseRef}`);

  const config = loadConfig();
  const ctx: DetectorContext = { submissionDir, baseRef, apiUrl: config.apiUrl, analyticsUrl: config.analyticsUrl };

  const workDir = path.join(REPORT_DIR, 'work', `run.${Date.now().toString(36)}`);
  fs.mkdirSync(workDir, { recursive: true });

  let handles: Stage0Handles = { apiProcess: null, analyticsProcess: null };
  process.on('SIGINT', () => {
    void cleanup(submissionDir, args.reuseDb, handles).finally(() => process.exit(130));
  });

  try {
    if (!args.reuseDb) {
      handles = await runStage0(submissionDir, config, workDir);
    } else {
      log(`Stage 0: reusing already-running services (API_URL=${config.apiUrl} ANALYTICS_URL=${config.analyticsUrl})`);
    }

    log('Stage 1: functional acceptance');
    const functional = await runFunctional(ctx);

    log('Stage 2: landmine detectors');
    const { landmines, staticExplainers } = await runLandmineDetectors(ctx);

    log('Stage 3: diff and history analysis');
    const diffReport = await buildDiffReport(submissionDir, baseRef);
    const historyReport = await buildHistoryReport(submissionDir, baseRef);

    log('Rendering scorecard');
    const rubric = JSON.parse(fs.readFileSync(RUBRIC_PATH, 'utf8')) as Rubric;
    const scorecard = buildScorecard(
      { functional, landmines, staticExplainers, diffReport, historyReport },
      { submission: submissionDir, seed: args.seed, base: baseRef },
      rubric,
    );
    const markdown = renderMarkdown(scorecard, rubric);
    writeScorecard(scorecard, markdown, REPORT_DIR);

    console.log(`summary: ${summarize(scorecard, rubric)}`);
    console.log(`scorecard written to ${path.join(REPORT_DIR, 'scorecard.md')}`);
  } finally {
    await cleanup(submissionDir, args.reuseDb, handles);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
