// Typed wrappers over node:child_process. Every detector shells out
// through these instead of touching child_process directly, so a
// failed command is data (an ExecResult) rather than a thrown error.

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
}

interface NodeExecError {
  stdout?: unknown;
  stderr?: unknown;
  code?: unknown;
}

function asNodeExecError(err: unknown): NodeExecError {
  return typeof err === 'object' && err !== null ? (err as NodeExecError) : {};
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Runs a command to completion. Never throws: a non-zero exit, a
// timeout, or a missing binary all come back as a non-zero code with
// whatever stdout/stderr was captured.
export async function exec(command: string, args: string[], options: ExecOptions = {}): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const shape = asNodeExecError(err);
    return {
      stdout: typeof shape.stdout === 'string' ? shape.stdout : '',
      stderr: typeof shape.stderr === 'string' ? shape.stderr : messageOf(err),
      code: typeof shape.code === 'number' ? shape.code : 1,
    };
  }
}

// git -C <cwd> <args...>
export async function git(args: string[], cwd: string): Promise<ExecResult> {
  return exec('git', ['-C', cwd, ...args]);
}

// Runs one SQL statement against the submission's postgres container
// through `docker compose exec`, cwd'd into the submission so compose
// resolves the right project. No local psql install required.
export async function psql(sql: string, submissionDir: string): Promise<string> {
  const result = await exec(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'ats', '-d', 'ats', '-t', '-A', '-c', sql],
    { cwd: submissionDir },
  );
  return result.stdout.trim();
}

export interface SpawnLoggedOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  logFile: string;
}

// Starts a long-running process (the api or analytics service) with
// stdout/stderr appended to a log file, and returns the handle so the
// caller can kill it later. Unlike exec(), this does not wait for exit.
export function spawnLogged(command: string, args: string[], options: SpawnLoggedOptions): ChildProcess {
  const logFd = fs.openSync(options.logFile, 'a');
  return spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', logFd, logFd],
  });
}
