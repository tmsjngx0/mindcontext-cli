import { init } from './commands/init.js';
import { connect } from './commands/connect.js';
import { sync } from './commands/sync.js';
import { pull } from './commands/pull.js';
import { context } from './commands/context.js';
import { progress } from './commands/progress.js';

const args = process.argv.slice(2);
const command = args[0];

// Parse flags
const flags: Record<string, boolean | string> = {};
const positional: string[] = [];

for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    flags[key] = value ?? true;
  } else if (arg.startsWith('-')) {
    flags[arg.slice(1)] = true;
  } else {
    positional.push(arg);
  }
}

async function main() {
  try {
    switch (command) {
      case 'init':
        await init({ quiet: !!flags.quiet || !!flags.q });
        break;

      case 'connect':
        await connect({
          category: flags.category as string | undefined,
          name: positional[0],
          quiet: !!flags.quiet || !!flags.q,
          withHooks: !!flags['with-hooks'],
        });
        break;

      case 'sync':
        await sync({
          quiet: !!flags.quiet || !!flags.q,
          dryRun: !!flags['dry-run'],
        });
        break;

      case 'pull':
        await pull({ quiet: !!flags.quiet || !!flags.q });
        break;

      case 'context':
        await context({
          json: !!flags.json,
          quiet: !!flags.quiet || !!flags.q,
        });
        break;

      case 'progress':
        await progress({
          web: !!flags.web,
          quiet: !!flags.quiet || !!flags.q,
        });
        break;

      case 'help':
      case '--help':
      case '-h':
      case undefined:
        printHelp();
        break;

      case 'version':
      case '--version':
      case '-v':
        console.log('mindcontext v0.1.0');
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "mc help" for available commands.');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
mindcontext - Git-based project progress tracker

USAGE:
  mc <command> [options]

COMMANDS:
  init              Initialize mindcontext (~/.mindcontext/)
  connect           Connect current project to mindcontext
  sync              Create progress update and push
  pull              Pull latest updates from remote
  context           Output current context (for integration)
  progress          Show progress (or --web to open dashboard)
  help              Show this help message

OPTIONS:
  --quiet, -q       Suppress output
  --json            Output as JSON (context command)
  --web             Open web dashboard (progress command)
  --category        Set project category (connect command)
  --with-hooks      Generate session-end hook (connect command)
  --dry-run         Show what would be done (sync command)

EXAMPLES:
  # First-time setup
  mc init

  # Connect a project
  cd my-project
  mc connect --category work

  # Daily usage
  mc sync              # Push progress update
  mc progress          # View progress in terminal
  mc progress --web    # Open dashboard in browser
  mc pull              # Get team updates

DOCUMENTATION:
  https://github.com/tmsjngx0/mindcontext
`);
}

main();
