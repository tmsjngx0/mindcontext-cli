import { basename, resolve } from 'path';
import { isInitialized, readConfig } from '../lib/config.js';
import { readUpdateFiles, UpdateFile } from '../lib/update-file.js';

export interface ChangelogOptions {
  days?: number;
  format?: 'md' | 'json';
  quiet?: boolean;
}

interface ChangelogEntry {
  date: string;
  updates: Array<{
    timestamp: string;
    machine: string;
    change?: string;
    tasks_done: number;
    tasks_total: number;
    status: string;
    notes: string[];
  }>;
}

/**
 * Generate changelog from updates.
 */
export async function changelog(options: ChangelogOptions = {}): Promise<void> {
  const days = options.days || 7;
  const format = options.format || 'md';

  // Check if initialized
  if (!isInitialized()) {
    if (!options.quiet) {
      console.error('MindContext is not initialized. Run "mc init" first.');
    }
    process.exit(1);
  }

  const config = readConfig();
  if (!config) {
    if (!options.quiet) {
      console.error('Failed to read config.');
    }
    process.exit(1);
  }

  // Get current project
  const projectPath = resolve(process.cwd());
  const projectName = basename(projectPath);

  // Check if project is connected
  const project = config.projects[projectName];
  if (!project) {
    if (!options.quiet) {
      console.error(`Project "${projectName}" is not connected.`);
      console.error('Run "mc connect" first.');
    }
    process.exit(1);
  }

  // Get updates
  const updates = readUpdateFiles(projectName);

  // Filter by date range
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const filteredUpdates = updates.filter(
    u => new Date(u.timestamp) >= cutoffDate
  );

  if (filteredUpdates.length === 0) {
    if (!options.quiet) {
      console.log(`No updates in the last ${days} days.`);
    }
    return;
  }

  // Group by date
  const grouped = groupByDate(filteredUpdates);

  if (format === 'json') {
    console.log(JSON.stringify(grouped, null, 2));
    return;
  }

  // Markdown output
  printMarkdown(projectName, days, grouped);
}

/**
 * Group updates by date.
 */
function groupByDate(updates: UpdateFile[]): ChangelogEntry[] {
  const byDate = new Map<string, UpdateFile[]>();

  for (const update of updates) {
    const date = new Date(update.timestamp).toISOString().split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(update);
  }

  // Convert to array and sort by date descending
  const entries: ChangelogEntry[] = [];

  for (const [date, dateUpdates] of byDate) {
    entries.push({
      date,
      updates: dateUpdates.map(u => ({
        timestamp: u.timestamp,
        machine: u.machine,
        change: u.progress.change,
        tasks_done: u.progress.tasks_done,
        tasks_total: u.progress.tasks_total,
        status: u.context.status,
        notes: u.context.notes,
      })),
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Print changelog in markdown format.
 */
function printMarkdown(projectName: string, days: number, entries: ChangelogEntry[]): void {
  console.log(`# Changelog: ${projectName}`);
  console.log(`\nLast ${days} days\n`);

  for (const entry of entries) {
    const dateObj = new Date(entry.date);
    const dateStr = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    console.log(`## ${dateStr}`);
    console.log('');

    for (const update of entry.updates) {
      const time = new Date(update.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const progress = update.tasks_total > 0
        ? ` (${update.tasks_done}/${update.tasks_total})`
        : '';

      console.log(`- **${time}** [${update.machine}] ${update.change || 'Manual update'}${progress}`);

      if (update.notes.length > 0) {
        for (const note of update.notes) {
          console.log(`  - ${note}`);
        }
      }
    }

    console.log('');
  }
}
