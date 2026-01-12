import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateUpdateFilename as genFilename, getMachineId } from './machine-id.js';
import { getProjectDir, ensureProjectDir } from './config.js';

// Re-export for use by other modules
export { genFilename as generateUpdateFilename };

export interface ProgressData {
  source: 'openspec' | 'manual';
  change?: string;
  tasks_done: number;
  tasks_total: number;
}

export interface ContextData {
  current_task?: string;
  status: 'idle' | 'in_progress' | 'blocked' | 'review';
  notes: string[];
  next: string[];
}

export interface UpdateFile {
  version: string;
  timestamp: string;
  machine: string;
  machine_id: string;
  project: string;
  progress: ProgressData;
  context: ContextData;
  recent_commits?: string[];
}

/**
 * Create an update file with progress and context data.
 */
export function createUpdateFile(
  projectName: string,
  progress: ProgressData,
  context: ContextData,
  recentCommits?: string[]
): string {
  const { name, id } = getMachineId();
  const filename = genFilename();
  const filepath = join(getProjectDir(projectName), filename);

  const update: UpdateFile = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    machine: name,
    machine_id: id,
    project: projectName,
    progress,
    context,
    recent_commits: recentCommits,
  };

  ensureProjectDir(projectName);
  writeFileSync(filepath, JSON.stringify(update, null, 2));

  return filepath;
}

/**
 * Read all update files for a project.
 */
export function readUpdateFiles(projectName: string): UpdateFile[] {
  const dir = getProjectDir(projectName);
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const updates: UpdateFile[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf8');
      updates.push(JSON.parse(content) as UpdateFile);
    } catch {
      // Skip invalid files
    }
  }

  // Sort by timestamp descending (newest first)
  return updates.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Get the latest update for a project.
 */
export function getLatestUpdate(projectName: string): UpdateFile | null {
  const updates = readUpdateFiles(projectName);
  return updates[0] || null;
}

/**
 * Get the latest update for each machine for a project.
 */
export function getLatestByMachine(projectName: string): Map<string, UpdateFile> {
  const updates = readUpdateFiles(projectName);
  const byMachine = new Map<string, UpdateFile>();

  for (const update of updates) {
    if (!byMachine.has(update.machine_id)) {
      byMachine.set(update.machine_id, update);
    }
  }

  return byMachine;
}

/**
 * Get recent updates across all machines.
 */
export function getRecentUpdates(projectName: string, limit = 10): UpdateFile[] {
  const updates = readUpdateFiles(projectName);
  return updates.slice(0, limit);
}
