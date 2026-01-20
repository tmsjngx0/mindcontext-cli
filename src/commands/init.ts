import { existsSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import {
  getMindcontextDir,
  getRepoDir,
  isInitialized,
  createDefaultConfig,
  writeConfig,
  readConfig,
} from '../lib/config.js';
import { cloneRepo } from '../lib/git-ops.js';

/**
 * Prompt user for input.
 */
async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Initialize mindcontext.
 */
export async function init(options: { quiet?: boolean } = {}): Promise<void> {
  const mindcontextDir = getMindcontextDir();
  const repoDir = getRepoDir();

  // Check if already initialized
  if (isInitialized()) {
    const config = readConfig();
    if (!options.quiet) {
      console.log('MindContext is already initialized.');
      console.log(`  Directory: ${mindcontextDir}`);
      console.log(`  Dashboard: ${config?.dashboard_url || 'Not configured'}`);
      console.log(`  Projects: ${Object.keys(config?.projects || {}).length}`);
      console.log('');
      console.log('Run "mctx reset" to start fresh.');
    }
    return;
  }

  if (!options.quiet) {
    console.log('Initializing MindContext...\n');
  }

  // Create directory
  if (!existsSync(mindcontextDir)) {
    mkdirSync(mindcontextDir, { recursive: true });
  }

  // Get dashboard repo URL
  let dashboardRepo = '';
  if (!options.quiet) {
    console.log('Enter your dashboard repository URL.');
    console.log('(Create one from https://github.com/tmsjngx0/mindcontext-template)\n');
    dashboardRepo = await prompt('Dashboard repo URL (git@github.com:user/repo.git): ');
  }

  if (!dashboardRepo) {
    if (!options.quiet) {
      console.log('\nNo dashboard URL provided. You can configure it later with:');
      console.log('  mc config --dashboard-repo <url>');
    }
    // Create config without dashboard
    const config = createDefaultConfig();
    writeConfig(config);
    if (!options.quiet) {
      console.log(`\nCreated: ${mindcontextDir}/config.json`);
    }
    return;
  }

  // Clone the repo
  if (!options.quiet) {
    console.log(`\nCloning dashboard repository...`);
  }

  try {
    cloneRepo(dashboardRepo, repoDir);
  } catch (error) {
    console.error('Failed to clone repository:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Extract dashboard URL from repo URL
  let dashboardUrl = '';
  const match = dashboardRepo.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (match) {
    dashboardUrl = `https://${match[1]}.github.io/${match[2]}`;
  }

  // Create config
  const config = createDefaultConfig();
  config.dashboard_repo = dashboardRepo;
  config.dashboard_url = dashboardUrl;
  writeConfig(config);

  if (!options.quiet) {
    console.log('\n✓ MindContext initialized!');
    console.log(`  Directory: ${mindcontextDir}`);
    console.log(`  Dashboard: ${dashboardUrl}`);
    console.log('');
    console.log('Next steps:');
    console.log('  cd <your-project>');
    console.log('  mc connect');
  }
}
