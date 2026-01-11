import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import { existsSync } from 'fs';
import { getRepoDir, addPending, readPending, clearPending } from './config.js';

const execOptions: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'],
};

/**
 * Check if we have network connectivity to GitHub.
 */
export function isOnline(): boolean {
  try {
    execSync('git ls-remote --exit-code origin HEAD', {
      ...execOptions,
      cwd: getRepoDir(),
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clone the dashboard repository.
 */
export function cloneRepo(repoUrl: string, targetDir: string): void {
  execSync(`git clone "${repoUrl}" "${targetDir}"`, execOptions);
}

/**
 * Pull latest changes from remote.
 */
export function pull(): { success: boolean; message: string } {
  const repoDir = getRepoDir();
  if (!existsSync(repoDir)) {
    return { success: false, message: 'Repository not initialized' };
  }

  try {
    const output = execSync('git pull --rebase origin main', {
      ...execOptions,
      cwd: repoDir,
    });
    return { success: true, message: output.trim() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pull failed';
    return { success: false, message };
  }
}

/**
 * Stage all changes.
 */
export function stageAll(): void {
  const repoDir = getRepoDir();
  execSync('git add -A', { ...execOptions, cwd: repoDir });
}

/**
 * Create a commit.
 */
export function commit(message: string): { success: boolean; message: string } {
  const repoDir = getRepoDir();
  try {
    // Check if there are changes to commit
    const status = execSync('git status --porcelain', {
      ...execOptions,
      cwd: repoDir,
    });
    if (!status.trim()) {
      return { success: true, message: 'Nothing to commit' };
    }

    stageAll();
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      ...execOptions,
      cwd: repoDir,
    });
    return { success: true, message: 'Committed' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Commit failed';
    return { success: false, message: msg };
  }
}

/**
 * Push changes to remote.
 */
export function push(): { success: boolean; message: string } {
  const repoDir = getRepoDir();
  try {
    execSync('git push origin main', {
      ...execOptions,
      cwd: repoDir,
      timeout: 30000,
    });
    return { success: true, message: 'Pushed to remote' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push failed';
    return { success: false, message };
  }
}

/**
 * Sync: commit and push (with offline support).
 */
export function sync(commitMessage: string): {
  committed: boolean;
  pushed: boolean;
  message: string;
} {
  // First, try to push any pending commits
  const pending = readPending();
  if (pending.length > 0) {
    const pushResult = push();
    if (pushResult.success) {
      clearPending();
    }
  }

  // Commit changes
  const commitResult = commit(commitMessage);
  if (!commitResult.success) {
    return {
      committed: false,
      pushed: false,
      message: commitResult.message,
    };
  }

  if (commitResult.message === 'Nothing to commit') {
    return {
      committed: false,
      pushed: false,
      message: 'No changes to sync',
    };
  }

  // Try to push
  const pushResult = push();
  if (!pushResult.success) {
    // Save for later
    addPending(commitMessage);
    return {
      committed: true,
      pushed: false,
      message: 'Committed locally. Push pending (offline)',
    };
  }

  return {
    committed: true,
    pushed: true,
    message: 'Synced successfully',
  };
}

/**
 * Get current branch name.
 */
export function getCurrentBranch(): string {
  const repoDir = getRepoDir();
  try {
    return execSync('git branch --show-current', {
      ...execOptions,
      cwd: repoDir,
    }).trim();
  } catch {
    return 'main';
  }
}

/**
 * Get recent commits from a project directory.
 * Returns commit messages (not from mindcontext repo, but from the user's project).
 */
export function getRecentCommits(projectPath: string, limit = 5): string[] {
  try {
    const output = execSync(
      `git log --oneline -${limit} --format="%s"`,
      { ...execOptions, cwd: projectPath }
    );
    return output
      .trim()
      .split('\n')
      .filter(line => line.length > 0);
  } catch {
    return [];
  }
}
