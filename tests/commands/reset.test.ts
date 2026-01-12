import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use a temp directory for testing
const TEST_DIR = join(tmpdir(), 'mindcontext-reset-test-' + Date.now());
const CONFIG_FILE = join(TEST_DIR, 'config.json');
const REPO_DIR = join(TEST_DIR, 'repo');

vi.mock('../../src/lib/config.js', async () => {
  const actual = await vi.importActual('../../src/lib/config.js');
  return {
    ...actual,
    getMindcontextDir: () => TEST_DIR,
    getRepoDir: () => REPO_DIR,
    isInitialized: () => existsSync(CONFIG_FILE) && existsSync(REPO_DIR),
  };
});

// Import after mocking
import { reset } from '../../src/commands/reset.js';

describe('mc reset command', () => {
  beforeEach(() => {
    // Create temp directory structure
    mkdirSync(REPO_DIR, { recursive: true });
    mkdirSync(join(REPO_DIR, 'projects', 'test-project', 'updates'), { recursive: true });

    // Create config
    const defaultConfig = {
      version: '1.0',
      dashboard_repo: 'git@github.com:user/dash.git',
      dashboard_url: 'https://user.github.io/dash',
      projects: {},
      machine: { name: 'test-machine', id: 'abc12345' },
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));

    // Create some files
    writeFileSync(join(REPO_DIR, 'projects', 'test-project', 'updates', 'update.json'), '{}');
  });

  afterEach(() => {
    // Clean up temp directory if it still exists
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('with --force flag', () => {
    it('should remove the entire mindcontext directory', async () => {
      expect(existsSync(TEST_DIR)).toBe(true);
      expect(existsSync(CONFIG_FILE)).toBe(true);
      expect(existsSync(REPO_DIR)).toBe(true);

      await reset({ force: true, quiet: true });

      expect(existsSync(TEST_DIR)).toBe(false);
    });

    it('should return success result', async () => {
      const result = await reset({ force: true, quiet: true });

      expect(result.success).toBe(true);
      expect(result.removed).toBe(true);
    });
  });

  describe('without --force flag', () => {
    it('should not remove anything without force', async () => {
      const result = await reset({ quiet: true });

      expect(existsSync(TEST_DIR)).toBe(true);
      expect(result.success).toBe(false);
      expect(result.removed).toBe(false);
    });
  });

  describe('dry-run mode', () => {
    it('should not delete anything in dry-run mode', async () => {
      const result = await reset({ force: true, dryRun: true, quiet: true });

      expect(existsSync(TEST_DIR)).toBe(true);
      expect(result.wouldRemove).toBe(true);
      expect(result.removed).toBe(false);
    });
  });

  describe('when not initialized', () => {
    it('should indicate nothing to remove', async () => {
      // Remove everything first
      rmSync(TEST_DIR, { recursive: true, force: true });

      const result = await reset({ force: true, quiet: true });

      expect(result.success).toBe(true);
      expect(result.removed).toBe(false);
    });
  });
});
