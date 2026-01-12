import { existsSync, rmSync } from 'fs';
import { getMindcontextDir } from '../lib/config.js';

export interface ResetOptions {
  force?: boolean;
  dryRun?: boolean;
  quiet?: boolean;
}

export interface ResetResult {
  success: boolean;
  removed: boolean;
  wouldRemove?: boolean;
}

/**
 * Reset command - remove ~/.mindcontext/ and start fresh.
 *
 * Usage:
 *   mc reset                 Show what would be removed
 *   mc reset --force         Actually remove everything
 *   mc reset --dry-run       Preview removal without deleting
 */
export async function reset(options: ResetOptions): Promise<ResetResult> {
  const mindcontextDir = getMindcontextDir();

  // Check if there's anything to remove
  if (!existsSync(mindcontextDir)) {
    if (!options.quiet) {
      console.log('Nothing to remove. Mindcontext directory does not exist.');
    }
    return { success: true, removed: false };
  }

  // Dry-run mode
  if (options.dryRun) {
    if (!options.quiet) {
      console.log(`Would remove: ${mindcontextDir}`);
      console.log('\nThis will delete:');
      console.log('  - config.json (global configuration)');
      console.log('  - repo/ (dashboard repository clone)');
      console.log('  - All cached data and pending pushes');
      console.log('\nRun with --force to actually remove.');
    }
    return { success: true, removed: false, wouldRemove: true };
  }

  // Require --force flag
  if (!options.force) {
    if (!options.quiet) {
      console.log('Reset requires --force flag to confirm.');
      console.log(`\nThis will remove: ${mindcontextDir}`);
      console.log('\nRun: mc reset --force');
      console.log('Or preview with: mc reset --dry-run');
    }
    return { success: false, removed: false };
  }

  // Actually remove
  try {
    rmSync(mindcontextDir, { recursive: true, force: true });
    if (!options.quiet) {
      console.log(`✓ Removed ${mindcontextDir}`);
      console.log('\nRun "mc init" to set up mindcontext again.');
    }
    return { success: true, removed: true };
  } catch (error) {
    if (!options.quiet) {
      console.error(`Failed to remove: ${error instanceof Error ? error.message : error}`);
    }
    return { success: false, removed: false };
  }
}
