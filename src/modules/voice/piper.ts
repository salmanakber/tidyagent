import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getEnv } from "@/lib/env";

let piper: ChildProcess | null = null;
let starting: Promise<void> | null = null;

function dataDir() {
  const env = getEnv();
  return env.PIPER_DATA_DIR || path.join(process.cwd(), "voices", "piper");
}

function pythonBin() {
  const venv = path.join(process.cwd(), ".venv-piper", "bin", "python");
  return fs.existsSync(venv) ? venv : "python3";
}

function piperBase() {
  return getEnv().PIPER_URL.replace(/\/$/, "");
}

async function ping(): Promise<boolean> {
  try {
    const response = await fetch(`${piperBase()}/info`, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensurePiperServer() {
  if (await ping()) return true;
  if (starting) {
    await starting;
    return ping();
  }
  starting = new Promise<void>((resolve) => {
    try {
      const env = getEnv();
      const child = spawn(
        pythonBin(),
        ["-m", "piper.http_server", "-m", env.PIPER_VOICE, "--host", "127.0.0.1", "--port", "5510", "--data-dir", dataDir()],
        { stdio: "ignore", detached: false },
      );
      piper = child;
      child.on("exit", () => {
        piper = null;
      });
      setTimeout(resolve, 1800);
    } catch {
      resolve();
    }
  });
  await starting;
  starting = null;
  return ping();
}

export async function synthesizePiper(text: string): Promise<Buffer | null> {
  const spoken = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!spoken) return null;
  await ensurePiperServer();
  try {
    const response = await fetch(`${piperBase()}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: spoken, voice: getEnv().PIPER_VOICE }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export function piperStatus() {
  return { running: Boolean(piper && !piper.killed), url: piperBase() };
}
