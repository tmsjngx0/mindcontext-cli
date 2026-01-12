import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  isInitialized,
  readConfig,
  ensureProjectDir,
  getProjectDir,
} from '../lib/config.js';
import { generateUpdateFilename } from '../lib/machine-id.js';

export interface MigrationSources {
  hasProjectDir: boolean;
  hasFocusJson: boolean;
  projectFiles: string[];
  focusJsonPath?: string;
}

export interface MigrateOptions {
  projectPath: string;
  dryRun?: boolean;
  quiet?: boolean;
  skipProjectDir?: boolean;
  skipFocusJson?: boolean;
  autoConfirm?: boolean;
}

export interface MigrateResult {
  sources: MigrationSources;
  migrated: boolean;
  focusMigrated: boolean;
  projectDirMigrated: boolean;
}

/**
 * Recursively list all files in a directory.
 */
function listFilesRecursively(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listFilesRecursively(fullPath, baseDir));
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }

  return files;
}

/**
 * Detect migration sources in a project directory.
 */
export function detectMigrationSources(projectPath: string): MigrationSources {
  const projectDir = join(projectPath, '.project');
  const focusJsonPath = join(projectPath, '.claude', 'focus.json');

  const hasProjectDir = existsSync(projectDir);
  const hasFocusJson = existsSync(focusJsonPath);

  const projectFiles = hasProjectDir ? listFilesRecursively(projectDir) : [];

  return {
    hasProjectDir,
    hasFocusJson,
    projectFiles,
    focusJsonPath: hasFocusJson ? focusJsonPath : undefined,
  };
}

/**
 * Convert focus.json to update file format.
 */
export function convertFocusToUpdate(
  focusJson: Record<string, unknown>,
  projectName: string,
  machine: { name: string; id: string }
): Record<string, unknown> {
  const timestamp = (focusJson.timestamp as string) || new Date().toISOString();

  return {
    version: '1.0',
    timestamp,
    machine: machine.name,
    machine_id: machine.id,
    project: projectName,
    progress: {
      source: 'migration',
      change: 'migrated-from-focus',
      tasks_done: 0,
      tasks_total: 0,
    },
    context: {
      current_task: (focusJson.current_focus as string) || '',
      status: 'migrated',
      notes: focusJson.session_summary ? [focusJson.session_summary as string] : [],
      next: (focusJson.next_session_tasks as string[]) || [],
    },
  };
}

/**
 * Migrate command - convert .project/ and focus.json to mindcontext format.
 *
 * Usage:
 *   mc migrate                    Interactive migration
 *   mc migrate --dry-run          Preview what would be migrated
 *   mc migrate --auto-confirm     Non-interactive (use defaults)
 */
export async function migrate(options: MigrateOptions): Promise<MigrateResult> {
  // Check initialization
  if (!isInitialized()) {
    throw new Error('Mindcontext not initialized. Run "mc init" first.');
  }

  const config = readConfig();
  if (!config) {
    throw new Error('Failed to read config file.');
  }

  // Detect sources
  const sources = detectMigrationSources(options.projectPath);

  // Nothing to migrate
  if (!sources.hasProjectDir && !sources.hasFocusJson) {
    if (!options.quiet) {
      console.log('Nothing to migrate.');
      console.log('  - No .project/ directory found');
      console.log('  - No .claude/focus.json found');
    }
    return {
      sources,
      migrated: false,
      focusMigrated: false,
      projectDirMigrated: false,
    };
  }

  // Report what was found
  if (!options.quiet) {
    console.log('Migration sources detected:\n');

    if (sources.hasProjectDir) {
      console.log('  .project/ directory:');
      for (const file of sources.projectFiles) {
        console.log(`    - ${file}`);
      }
    }

    if (sources.hasFocusJson) {
      console.log('  .claude/focus.json: Found');
    }

    console.log('');
  }

  // Dry-run mode
  if (options.dryRun) {
    if (!options.quiet) {
      console.log('Dry-run mode - no changes made.');

      if (sources.hasFocusJson) {
        console.log('\nWould migrate focus.json to update file.');
      }

      if (sources.hasProjectDir) {
        console.log('\nWould prompt for .project/ file destinations.');
      }
    }
    return {
      sources,
      migrated: false,
      focusMigrated: false,
      projectDirMigrated: false,
    };
  }

  let focusMigrated = false;
  let projectDirMigrated = false;

  // Migrate focus.json
  if (sources.hasFocusJson && !options.skipFocusJson) {
    if (!options.quiet) {
      console.log('Migrating focus.json...');
    }

    try {
      // Find project name from path
      const projectName = Object.keys(config.projects).find(
        (name) => config.projects[name].path === options.projectPath
      ) || 'unknown-project';

      // Read focus.json
      const focusContent = readFileSync(sources.focusJsonPath!, 'utf8');
      const focusJson = JSON.parse(focusContent);

      // Convert to update format
      const update = convertFocusToUpdate(focusJson, projectName, config.machine);

      // Ensure project directory exists
      ensureProjectDir(projectName);

      // Write update file
      const filename = generateUpdateFilename();
      const updatesDir = getProjectDir(projectName);
      const updatePath = join(updatesDir, filename);

      writeFileSync(updatePath, JSON.stringify(update, null, 2));

      if (!options.quiet) {
        console.log(`  ✓ Created update file: ${filename}`);
      }

      focusMigrated = true;
    } catch (error) {
      if (!options.quiet) {
        console.error(`  ✗ Failed to migrate focus.json: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  // Note: .project/ migration requires interactive prompts
  // For now, we only support focus.json migration in non-interactive mode
  if (sources.hasProjectDir && !options.skipProjectDir) {
    if (options.autoConfirm) {
      if (!options.quiet) {
        console.log('\n.project/ migration requires interactive mode.');
        console.log('Run without --auto-confirm to migrate .project/ files.');
      }
    } else if (!options.quiet) {
      console.log('\n.project/ migration: Interactive prompts not yet implemented.');
      console.log('Files remain in .project/ - manual migration recommended.');
    }
  }

  const migrated = focusMigrated || projectDirMigrated;

  if (!options.quiet && migrated) {
    console.log('\n✓ Migration complete.');
  }

  return {
    sources,
    migrated,
    focusMigrated,
    projectDirMigrated,
  };
}
