import { isInitialized } from '../lib/config.js';
import { pull as gitPull } from '../lib/git-ops.js';

export interface PullOptions {
  quiet?: boolean;
}

/**
 * Pull latest updates from remote.
 */
export async function pull(options: PullOptions = {}): Promise<void> {
  // Check if initialized
  if (!isInitialized()) {
    if (!options.quiet) {
      console.error('MindContext is not initialized. Run "mctx init" first.');
    }
    process.exit(1);
  }

  if (!options.quiet) {
    console.log('Pulling latest updates...');
  }

  const result = gitPull();

  if (!options.quiet) {
    if (result.success) {
      console.log('✓ Updated');
      if (result.message && result.message !== 'Already up to date.') {
        console.log(`  ${result.message}`);
      }
    } else {
      console.error('✗ Failed to pull');
      console.error(`  ${result.message}`);
    }
  }
}
