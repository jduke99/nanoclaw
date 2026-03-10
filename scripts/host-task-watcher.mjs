/**
 * Host Task Watcher — Claude Code Bridge
 *
 * Monitors data/ipc/main/host-tasks/ for tasks delegated by the
 * NanoClaw agent (Andy). Spawns `claude -p` to execute each task
 * and writes results back to host-task-results/.
 *
 * Usage: node scripts/host-task-watcher.mjs
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// NanoClaw runs in WSL2 at /root/nanoclaw — IPC files live there, not on Windows side
// Access via \\wsl$\ UNC path from Windows
const WSL_IPC = '\\\\wsl$\\Ubuntu-24.04\\home\\ubuntu\\nanoclaw\\data\\ipc\\main';
const WIN_IPC = path.join(PROJECT_ROOT, 'data', 'ipc', 'main');
const IPC_DIR = fs.existsSync(WSL_IPC) ? WSL_IPC : WIN_IPC;
const TASKS_DIR = path.join(IPC_DIR, 'host-tasks');
const RESULTS_DIR = path.join(IPC_DIR, 'host-task-results');
const POLL_MS = 2000;
const TASK_TIMEOUT_MS = 300_000; // 5 min hard limit

fs.mkdirSync(TASKS_DIR, { recursive: true });
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

log('Host task watcher started');
log(`Watching: ${TASKS_DIR}`);
log(`Results:  ${RESULTS_DIR}`);
log('---');

function writeResult(taskId, result) {
  const resultPath = path.join(RESULTS_DIR, `${taskId}.json`);
  const tmpPath = `${resultPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(result, null, 2));
  fs.renameSync(tmpPath, resultPath);
}

function executeWithClaude(task) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const proc = spawn('claude', [
      '-p',
      '--output-format', 'text',
      '--dangerously-skip-permissions',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, CLAUDECODE: '' },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    const prompt = [
      `You are executing a delegated task from NanoClaw (Andy, the Telegram bot).`,
      ``,
      `## Task: ${task.description}`,
      ``,
      `## Instructions`,
      task.instructions,
      ``,
      `Execute these instructions and report results concisely.`,
    ].join('\n');

    proc.stdin.write(prompt);
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        taskId: task.id,
        success: false,
        message: 'Timed out (5 min hard limit)',
        duration_ms: Date.now() - startTime,
      });
    }, TASK_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      if (code === 0) {
        resolve({
          taskId: task.id,
          success: true,
          message: stdout.trim().slice(0, 4000),
          duration_ms: duration,
        });
      } else {
        resolve({
          taskId: task.id,
          success: false,
          message: `Exit code ${code}: ${stderr.trim().slice(-500)}`,
          duration_ms: duration,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        taskId: task.id,
        success: false,
        message: `Spawn failed: ${err.message}`,
        duration_ms: Date.now() - startTime,
      });
    });
  });
}

let processing = false;

async function poll() {
  if (processing) {
    setTimeout(poll, POLL_MS);
    return;
  }

  try {
    const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(TASKS_DIR, file);
      try {
        const task = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fs.unlinkSync(filePath);

        log(`Task received: ${task.id} — ${task.description}`);
        processing = true;

        const result = await executeWithClaude(task);
        writeResult(task.id, result);

        log(`Task ${result.success ? 'completed' : 'failed'}: ${task.id} (${result.duration_ms}ms)`);
        processing = false;
      } catch (err) {
        log(`Error processing ${file}: ${err.message}`);
        processing = false;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log(`Poll error: ${err.message}`);
    }
  }

  setTimeout(poll, POLL_MS);
}

poll();
