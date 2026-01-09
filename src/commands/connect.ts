import { basename, resolve, join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { isInitialized, readConfig, writeConfig, ensureProjectDir } from '../lib/config.js';
import { hasOpenSpec } from '../parsers/openspec.js';
import { COMMAND_TEMPLATES, HOOK_TEMPLATES } from '../lib/templates.js';

export interface ConnectOptions {
  category?: string;
  name?: string;
  quiet?: boolean;
  withHooks?: boolean;
}

/**
 * Connect current project to mindcontext.
 */
export async function connect(options: ConnectOptions = {}): Promise<void> {
  // Check if initialized
  if (!isInitialized()) {
    console.error('MindContext is not initialized. Run "mc init" first.');
    process.exit(1);
  }

  const config = readConfig();
  if (!config) {
    console.error('Failed to read config.');
    process.exit(1);
  }

  // Get project path and name
  const projectPath = resolve(process.cwd());
  const projectName = options.name || basename(projectPath);

  // Check if already connected
  if (config.projects[projectName]) {
    if (!options.quiet) {
      console.log(`Project "${projectName}" is already connected.`);
      console.log(`  Path: ${config.projects[projectName].path}`);
      console.log(`  Category: ${config.projects[projectName].category}`);
      console.log(`  OpenSpec: ${config.projects[projectName].openspec ? 'Yes' : 'No'}`);
    }
    return;
  }

  // Detect OpenSpec
  const openspec = hasOpenSpec(projectPath);

  // Add project to config
  config.projects[projectName] = {
    path: projectPath,
    openspec,
    category: options.category || 'default',
  };
  writeConfig(config);

  // Create project directory in repo
  ensureProjectDir(projectName);

  // Generate .claude/commands/mc/ templates
  const claudeDir = join(projectPath, '.claude');
  const commandsDir = join(claudeDir, 'commands', 'mc');

  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true });

    // Write command templates
    for (const [filename, content] of Object.entries(COMMAND_TEMPLATES)) {
      writeFileSync(join(commandsDir, filename), content);
    }

    if (!options.quiet) {
      console.log(`✓ Created .claude/commands/mc/`);
    }
  }

  // Optionally generate hooks
  if (options.withHooks) {
    const hooksDir = join(claudeDir, 'hooks');
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });

      for (const [filename, content] of Object.entries(HOOK_TEMPLATES)) {
        writeFileSync(join(hooksDir, filename), content);
      }

      if (!options.quiet) {
        console.log(`✓ Created .claude/hooks/`);
      }
    }
  }

  if (!options.quiet) {
    console.log(`✓ Connected "${projectName}"`);
    console.log(`  Path: ${projectPath}`);
    console.log(`  Category: ${options.category || 'default'}`);
    console.log(`  OpenSpec: ${openspec ? 'Detected' : 'Not found'}`);
    console.log('');
    console.log('Next: Run "mc sync" to create your first update.');
  }
}
