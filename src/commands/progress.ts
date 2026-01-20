import { execSync } from 'child_process';
import { basename, resolve } from 'path';
import { isInitialized, readConfig } from '../lib/config.js';
import { getLatestUpdate, getRecentUpdates } from '../lib/update-file.js';
import { getOpenSpecProgress } from '../parsers/openspec.js';

export interface ProgressOptions {
  web?: boolean;
  quiet?: boolean;
}

/**
 * Display progress or open dashboard.
 */
export async function progress(options: ProgressOptions = {}): Promise<void> {
  // Check if initialized
  if (!isInitialized()) {
    if (!options.quiet) {
      console.error('MindContext is not initialized. Run "mctx init" first.');
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

  // Open web dashboard
  if (options.web) {
    if (!config.dashboard_url) {
      if (!options.quiet) {
        console.error('No dashboard URL configured.');
        console.error('Configure with: mc config --dashboard-url <url>');
      }
      process.exit(1);
    }

    if (!options.quiet) {
      console.log(`Opening: ${config.dashboard_url}`);
    }

    // Open in browser
    try {
      const platform = process.platform;
      if (platform === 'darwin') {
        execSync(`open "${config.dashboard_url}"`);
      } else if (platform === 'win32') {
        execSync(`start "${config.dashboard_url}"`);
      } else {
        execSync(`xdg-open "${config.dashboard_url}"`);
      }
    } catch {
      if (!options.quiet) {
        console.log(`Please open: ${config.dashboard_url}`);
      }
    }
    return;
  }

  // CLI progress view
  const projectPath = resolve(process.cwd());
  const projectName = basename(projectPath);
  const project = config.projects[projectName];

  if (!project) {
    // Show all projects
    console.log('MindContext Progress\n');
    console.log('Projects:');

    for (const [name, proj] of Object.entries(config.projects)) {
      const openspecProgress = getOpenSpecProgress(proj.path);
      const percentage =
        openspecProgress.tasks_total > 0
          ? Math.round((openspecProgress.tasks_done / openspecProgress.tasks_total) * 100)
          : 0;

      const bar = generateProgressBar(percentage);
      console.log(`  ${name}`);
      console.log(`    ${bar} ${percentage}%`);
      if (openspecProgress.change) {
        console.log(`    Current: ${openspecProgress.change}`);
      }
    }

    if (Object.keys(config.projects).length === 0) {
      console.log('  (No projects connected)');
      console.log('');
      console.log('Run "mctx connect" in a project directory to connect it.');
    }

    if (config.dashboard_url) {
      console.log('');
      console.log(`Dashboard: ${config.dashboard_url}`);
      console.log('Run "mctx progress --web" to open in browser.');
    }
    return;
  }

  // Show current project progress
  const openspecProgress = getOpenSpecProgress(projectPath);
  const percentage =
    openspecProgress.tasks_total > 0
      ? Math.round((openspecProgress.tasks_done / openspecProgress.tasks_total) * 100)
      : 0;

  console.log(`${projectName}\n`);

  if (openspecProgress.source === 'openspec' && openspecProgress.change) {
    console.log(`Change: ${openspecProgress.change}`);
    console.log(`Progress: ${openspecProgress.tasks_done}/${openspecProgress.tasks_total}`);
    console.log(generateProgressBar(percentage, 30) + ` ${percentage}%`);
  } else {
    console.log('No active OpenSpec change.');
  }

  // Show recent updates
  const recentUpdates = getRecentUpdates(projectName, 5);
  if (recentUpdates.length > 0) {
    console.log('\nRecent Activity:');
    for (const update of recentUpdates) {
      const date = new Date(update.timestamp).toLocaleDateString();
      const time = new Date(update.timestamp).toLocaleTimeString();
      console.log(`  ${date} ${time} - ${update.machine}`);
      if (update.context.notes.length > 0) {
        console.log(`    Notes: ${update.context.notes.join(', ')}`);
      }
    }
  }
}

/**
 * Generate a text-based progress bar.
 */
function generateProgressBar(percentage: number, width = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
