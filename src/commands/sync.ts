import { basename, resolve } from 'path';
import { isInitialized, readConfig } from '../lib/config.js';
import { sync as gitSync, getRecentCommits } from '../lib/git-ops.js';
import { createUpdateFile, ContextData } from '../lib/update-file.js';
import { getOpenSpecProgress } from '../parsers/openspec.js';

export interface SyncOptions {
  quiet?: boolean;
  dryRun?: boolean;
  notes?: string[];
  next?: string[];
  status?: ContextData['status'];
}

/**
 * Sync progress for current project.
 */
export async function sync(options: SyncOptions = {}): Promise<void> {
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

  // Get progress from OpenSpec
  const progress = getOpenSpecProgress(projectPath);

  // Build context
  const context: ContextData = {
    current_task: progress.change ? `Working on ${progress.change}` : undefined,
    status: options.status || (progress.tasks_done > 0 ? 'in_progress' : 'idle'),
    notes: options.notes || [],
    next: options.next || [],
  };

  if (!options.quiet) {
    console.log(`Syncing "${projectName}"...`);
    if (progress.source === 'openspec') {
      console.log(`  Change: ${progress.change}`);
      console.log(`  Progress: ${progress.tasks_done}/${progress.tasks_total}`);
    }
  }

  // Get recent commits from project
  const recentCommits = getRecentCommits(projectPath, 5);

  if (options.dryRun) {
    if (!options.quiet) {
      console.log('\n[Dry run] Would create update file:');
      console.log(JSON.stringify({ progress, context, recent_commits: recentCommits }, null, 2));
    }
    return;
  }

  // Create update file
  const filepath = createUpdateFile(projectName, progress, context, recentCommits);

  if (!options.quiet) {
    console.log(`  Created: ${filepath}`);
  }

  // Git sync
  const commitMessage = `chore(progress): sync ${config.machine.name}`;
  const result = gitSync(commitMessage);

  if (!options.quiet) {
    if (result.committed && result.pushed) {
      console.log('✓ Synced successfully');
    } else if (result.committed) {
      console.log('✓ Committed locally (push pending)');
      console.log('  Run "mc push" when online to push changes.');
    } else {
      console.log(`  ${result.message}`);
    }
  }
}
