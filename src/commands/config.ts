import {
  isInitialized,
  readConfig,
  writeConfig,
  type Config,
} from '../lib/config.js';

export interface ConfigOptions {
  show?: boolean;
  get?: string;
  dashboardRepo?: string;
  dashboardUrl?: string;
  quiet?: boolean;
}

/**
 * Config command - view and update mindcontext configuration.
 *
 * Usage:
 *   mc config                      Show current config
 *   mc config --get <key>          Get specific config value
 *   mc config --dashboard-repo <url>  Set dashboard repository URL
 *   mc config --dashboard-url <url>   Set dashboard web URL
 */
export async function config(options: ConfigOptions): Promise<unknown> {
  // Check initialization
  if (!isInitialized()) {
    throw new Error('Mindcontext not initialized. Run "mctx init" first.');
  }

  const currentConfig = readConfig();
  if (!currentConfig) {
    throw new Error('Failed to read config file.');
  }

  // Get specific key
  if (options.get) {
    const key = options.get as keyof Config;
    const value = currentConfig[key];
    if (!options.quiet) {
      if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }
    }
    return value;
  }

  // Set values
  let updated = false;

  if (options.dashboardRepo !== undefined) {
    currentConfig.dashboard_repo = options.dashboardRepo;
    updated = true;
  }

  if (options.dashboardUrl !== undefined) {
    currentConfig.dashboard_url = options.dashboardUrl;
    updated = true;
  }

  if (updated) {
    writeConfig(currentConfig);
    if (!options.quiet) {
      console.log('✓ Config updated');
    }
    return currentConfig;
  }

  // Show current config (default behavior)
  if (!options.quiet) {
    console.log('Mindcontext Configuration:\n');
    console.log(`  Dashboard Repo: ${currentConfig.dashboard_repo || '(not set)'}`);
    console.log(`  Dashboard URL:  ${currentConfig.dashboard_url || '(not set)'}`);
    console.log(`  Machine:        ${currentConfig.machine.name} (${currentConfig.machine.id})`);
    console.log(`  Projects:       ${Object.keys(currentConfig.projects).length} registered`);
  }

  return currentConfig;
}
