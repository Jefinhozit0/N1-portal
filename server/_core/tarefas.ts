import { hasBackupForToday, runBackup } from "./backup";
import { sendAccessReminders } from "./lembretes";

/**
 * Background jobs, checked every hour while the server runs:
 * - daily backup (the first check after midnight that finds no backup for the day makes one);
 * - reminders for clients who have not created their password.
 * Each job runs one at a time and a failure is only logged.
 */

const HOUR = 60 * 60 * 1000;
const running = new Set<string>();

export type JobState = { lastRun: string | null; lastError: string | null; lastResult: string | null };
export const jobState: Record<"backup" | "lembretes", JobState> = {
  backup: { lastRun: null, lastError: null, lastResult: null },
  lembretes: { lastRun: null, lastError: null, lastResult: null },
};

export async function runJob(name: "backup" | "lembretes", task: () => Promise<string>) {
  if (running.has(name)) return;
  running.add(name);
  try {
    jobState[name].lastResult = await task();
    jobState[name].lastError = null;
  } catch (error) {
    jobState[name].lastError = error instanceof Error ? error.message : String(error);
    console.error(`[tarefas] ${name} failed:`, error);
  } finally {
    jobState[name].lastRun = new Date().toISOString();
    running.delete(name);
  }
}

export const backupJob = () => runJob("backup", async () => {
  const { summary } = await runBackup();
  return `${summary.clientes ?? 0} clientes, ${summary.mensagens ?? 0} mensagens, ${summary.vendas ?? 0} vendas`;
});

async function hourlyCheck() {
  if (!hasBackupForToday()) await backupJob();
  await runJob("lembretes", async () => `${await sendAccessReminders()} lembrete(s) enviado(s)`);
}

export function startBackgroundJobs() {
  // First check a minute after start, so it doesn't compete with the server warming up.
  setTimeout(() => void hourlyCheck(), 60_000);
  setInterval(() => void hourlyCheck(), HOUR);
}
