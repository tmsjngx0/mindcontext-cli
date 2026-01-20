import { readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import {
  isInitialized,
  readConfig,
  getRepoDir,
} from '../lib/config.js';

export interface CleanupOptions {
  olderThan?: number; // days
  dryRun?: boolean;
  quiet?: boolean;
}

export interface CleanupResult {
  deleted: number;
  wouldDelete?: number;
}

const DEFAULT_OLDER_THAN_DAYS = 30;

/**
 * Cleanup command - remove old update files.
 *
 * Usage:
 *   mc cleanup                    Remove files older than 30 days
 *   mc cleanup --older-than 7     Remove files older than 7 days
 *   mc cleanup --dry-run          Preview what would be deleted
 */
export async function cleanup(options: CleanupOptions): Promise<CleanupResult> {
  // Check initialization
  if (!isInitialized()) {
    throw new Error('Mindcontext not initialized. Run "mctx init" first.');
  }

  const config = readConfig();
  if (!config) {
    throw new Error('Failed to read config file.');
  }

  const olderThanDays = options.olderThan ?? DEFAULT_OLDER_THAN_DAYS;
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const repoDir = getRepoDir();

  let deleted = 0;
  let wouldDelete = 0;

  // Process each registered project
  for (const projectName of Object.keys(config.projects)) {
    const updatesDir = join(repoDir, 'projects', projectName, 'updates');

    if (!existsSync(updatesDir)) {
      continue;
    }

    const files = readdirSync(updatesDir);

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const filePath = join(updatesDir, file);
      const stats = statSync(filePath);
      const fileAge = stats.mtime.getTime();

      if (fileAge < cutoffTime) {
        if (options.dryRun) {
          wouldDelete++;
          if (!options.quiet) {
            console.log(`Would delete: ${projectName}/${file}`);
          }
        } else {
          unlinkSync(filePath);
          deleted++;
          if (!options.quiet) {
            console.log(`Deleted: ${projectName}/${file}`);
          }
        }
      }
    }
  }

  if (!options.quiet) {
    if (options.dryRun) {
      console.log(`\n${wouldDelete} file(s) would be deleted.`);
    } else {
      console.log(`\n✓ Cleaned up ${deleted} file(s).`);
    }
  }

  return { deleted, wouldDelete };
}
