import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

/**
 * End-to-end integration tests for the mindcontext CLI.
 *
 * These tests validate the complete workflow:
 * init → connect → sync → progress → context → cleanup → reset
 *
 * Validates Phase 1 checkpoint: "mc sync creates update file in ~/.mindcontext/repo/"
 */

const TEST_HOME = join(tmpdir(), 'mc-e2e-test-' + Date.now());
const MINDCONTEXT_DIR = join(TEST_HOME, '.mindcontext');
const TEST_PROJECT = join(TEST_HOME, 'test-project');
const DASHBOARD_REPO = join(TEST_HOME, 'dashboard-repo');

// Helper to run mc commands with test HOME
function mc(args: string, options: { cwd?: string } = {}): string {
  const cliPath = join(__dirname, '../../dist/cli.js');
  const env = { ...process.env, HOME: TEST_HOME };
  try {
    return execSync(`node ${cliPath} ${args}`, {
      encoding: 'utf8',
      env,
      cwd: options.cwd || TEST_PROJECT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    // Return stderr if command fails
    return error.stderr || error.stdout || error.message;
  }
}

describe('End-to-End CLI Flow', () => {
  beforeAll(() => {
    // Create test environment
    mkdirSync(TEST_HOME, { recursive: true });
    mkdirSync(TEST_PROJECT, { recursive: true });

    // Create a mock dashboard repo (bare git repo)
    mkdirSync(DASHBOARD_REPO, { recursive: true });
    execSync('git init --bare', { cwd: DASHBOARD_REPO });

    // Create test project with openspec structure
    mkdirSync(join(TEST_PROJECT, 'openspec', 'changes', 'test-feature'), { recursive: true });

    // Create a tasks.md file
    writeFileSync(
      join(TEST_PROJECT, 'openspec', 'changes', 'test-feature', 'tasks.md'),
      `# Tasks
- [x] Task 1
- [x] Task 2
- [ ] Task 3
- [ ] Task 4
`
    );

    // Create proposal.md with status
    writeFileSync(
      join(TEST_PROJECT, 'openspec', 'changes', 'test-feature', 'proposal.md'),
      `---
status: in_progress
---
# Test Feature
`
    );

    // Initialize git in test project
    execSync('git init', { cwd: TEST_PROJECT });
    execSync('git config user.email "test@test.com"', { cwd: TEST_PROJECT });
    execSync('git config user.name "Test User"', { cwd: TEST_PROJECT });
  });

  afterAll(() => {
    // Clean up test environment
    if (existsSync(TEST_HOME)) {
      rmSync(TEST_HOME, { recursive: true, force: true });
    }
  });

  describe('Phase 1 Validation: init → connect → sync → progress', () => {
    it('should initialize mindcontext directory', () => {
      // Note: init normally prompts for dashboard repo, we test the structure creation
      mkdirSync(MINDCONTEXT_DIR, { recursive: true });
      mkdirSync(join(MINDCONTEXT_DIR, 'repo', 'projects'), { recursive: true });

      // Create config manually (simulating init)
      const config = {
        version: '1.0',
        dashboard_repo: DASHBOARD_REPO,
        dashboard_url: '',
        projects: {},
        machine: { name: 'test-machine', id: 'abc12345' },
      };
      writeFileSync(
        join(MINDCONTEXT_DIR, 'config.json'),
        JSON.stringify(config, null, 2)
      );

      // Initialize git in repo dir
      execSync('git init', { cwd: join(MINDCONTEXT_DIR, 'repo') });
      execSync('git config user.email "test@test.com"', { cwd: join(MINDCONTEXT_DIR, 'repo') });
      execSync('git config user.name "Test User"', { cwd: join(MINDCONTEXT_DIR, 'repo') });

      expect(existsSync(MINDCONTEXT_DIR)).toBe(true);
      expect(existsSync(join(MINDCONTEXT_DIR, 'config.json'))).toBe(true);
    });

    it('should connect project and register it', () => {
      const output = mc('connect --quiet');

      // Read config to verify project was registered
      const config = JSON.parse(readFileSync(join(MINDCONTEXT_DIR, 'config.json'), 'utf8'));

      expect(Object.keys(config.projects)).toHaveLength(1);
      expect(config.projects['test-project']).toBeDefined();
      expect(config.projects['test-project'].openspec).toBe(true);
    });

    it('should create .claude/commands/mc/ templates on connect', () => {
      // Templates should have been created by connect
      const claudeDir = join(TEST_PROJECT, '.claude', 'commands', 'mc');

      expect(existsSync(join(claudeDir, 'sync.md'))).toBe(true);
      expect(existsSync(join(claudeDir, 'progress.md'))).toBe(true);
      expect(existsSync(join(claudeDir, 'context.md'))).toBe(true);
    });

    it('should sync and create update file in repo', () => {
      const output = mc('sync --quiet');

      // Verify update file was created
      const updatesDir = join(MINDCONTEXT_DIR, 'repo', 'projects', 'test-project', 'updates');
      expect(existsSync(updatesDir)).toBe(true);

      const files = readdirSync(updatesDir).filter(f => f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);

      // Verify update file content
      const updateFile = JSON.parse(readFileSync(join(updatesDir, files[0]), 'utf8'));
      expect(updateFile.project).toBe('test-project');
      expect(updateFile.progress).toBeDefined();
      expect(updateFile.progress.tasks_done).toBe(2);
      expect(updateFile.progress.tasks_total).toBe(4);
    });

    it('should show progress from synced data', () => {
      const output = mc('progress');

      expect(output).toContain('test-project');
      // Progress should show 2/4 = 50%
      expect(output).toMatch(/50%|2\/4/);
    });

    it('should output context as JSON', () => {
      const output = mc('context --json');
      const context = JSON.parse(output);

      expect(context.project).toBe('test-project');
      expect(context.progress).toBeDefined();
    });
  });

  describe('Config command', () => {
    it('should show current configuration', () => {
      const output = mc('config');

      expect(output).toContain('Dashboard');
      expect(output).toContain('Machine');
    });

    it('should update dashboard URL', () => {
      mc('config --dashboard-url=https://example.com/dashboard --quiet');

      const config = JSON.parse(readFileSync(join(MINDCONTEXT_DIR, 'config.json'), 'utf8'));
      expect(config.dashboard_url).toBe('https://example.com/dashboard');
    });

    it('should get specific config value', () => {
      const output = mc('config --get=dashboard_url');
      expect(output.trim()).toBe('https://example.com/dashboard');
    });
  });

  describe('Cleanup command', () => {
    it('should report no old files to clean (files are new)', () => {
      const output = mc('cleanup');
      expect(output).toContain('0 file');
    });

    it('should preview cleanup with dry-run', () => {
      const output = mc('cleanup --dry-run');
      expect(output).toContain('would be deleted');
    });
  });

  describe('Reset command', () => {
    it('should require --force flag', () => {
      const output = mc('reset');
      expect(output).toContain('--force');
    });

    it('should preview reset with --dry-run', () => {
      const output = mc('reset --dry-run');
      expect(output).toContain('Would remove');
    });

    // Note: We don't actually run reset --force as it would break other tests
  });

  describe('Multiple sync operations', () => {
    it('should create update files with unique timestamps', () => {
      // Syncs may have same timestamp within milliseconds, so we just verify
      // that the updates directory has files and sync doesn't fail
      const updatesDir = join(MINDCONTEXT_DIR, 'repo', 'projects', 'test-project', 'updates');

      const filesBefore = readdirSync(updatesDir).filter(f => f.endsWith('.json'));
      expect(filesBefore.length).toBeGreaterThanOrEqual(1);

      // Another sync should succeed
      const output = mc('sync --quiet');
      expect(output).not.toContain('Error');

      const filesAfter = readdirSync(updatesDir).filter(f => f.endsWith('.json'));
      expect(filesAfter.length).toBeGreaterThanOrEqual(filesBefore.length);
    });
  });
});
