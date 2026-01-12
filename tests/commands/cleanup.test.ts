import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use a temp directory for testing
const TEST_DIR = join(tmpdir(), 'mindcontext-cleanup-test-' + Date.now());
const CONFIG_FILE = join(TEST_DIR, 'config.json');
const REPO_DIR = join(TEST_DIR, 'repo');

vi.mock('../../src/lib/config.js', async () => {
  const actual = await vi.importActual('../../src/lib/config.js');
  return {
    ...actual,
    getMindcontextDir: () => TEST_DIR,
    getRepoDir: () => REPO_DIR,
    isInitialized: () => existsSync(CONFIG_FILE) && existsSync(REPO_DIR),
    readConfig: () => {
      if (!existsSync(CONFIG_FILE)) return null;
      try {
        const fs = require('fs');
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      } catch {
        return null;
      }
    },
  };
});

// Import after mocking
import { cleanup } from '../../src/commands/cleanup.js';

describe('mc cleanup command', () => {
  const projectName = 'test-project';
  const updatesDir = join(REPO_DIR, 'projects', projectName, 'updates');

  beforeEach(() => {
    // Create temp directory structure
    mkdirSync(updatesDir, { recursive: true });

    // Create config
    const defaultConfig = {
      version: '1.0',
      dashboard_repo: 'git@github.com:user/dash.git',
      dashboard_url: 'https://user.github.io/dash',
      projects: {
        [projectName]: { path: '/test/path', openspec: true, category: 'work' },
      },
      machine: { name: 'test-machine', id: 'abc12345' },
    };
    writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  function createUpdateFile(name: string, ageInDays: number) {
    const filePath = join(updatesDir, name);
    writeFileSync(filePath, JSON.stringify({ test: true }));
    // Set mtime to simulate age
    const fs = require('fs');
    const mtime = new Date(Date.now() - ageInDays * 24 * 60 * 60 * 1000);
    fs.utimesSync(filePath, mtime, mtime);
  }

  describe('remove old files', () => {
    it('should remove files older than default threshold (30 days)', async () => {
      // Create files with different ages
      createUpdateFile('old-file-1.json', 45);
      createUpdateFile('old-file-2.json', 60);
      createUpdateFile('recent-file.json', 5);

      const result = await cleanup({ quiet: true });

      expect(result.deleted).toBe(2);
      expect(existsSync(join(updatesDir, 'recent-file.json'))).toBe(true);
      expect(existsSync(join(updatesDir, 'old-file-1.json'))).toBe(false);
      expect(existsSync(join(updatesDir, 'old-file-2.json'))).toBe(false);
    });

    it('should respect --older-than flag', async () => {
      createUpdateFile('file-10-days.json', 10);
      createUpdateFile('file-20-days.json', 20);
      createUpdateFile('file-5-days.json', 5);

      const result = await cleanup({ olderThan: 7, quiet: true });

      expect(result.deleted).toBe(2);
      expect(existsSync(join(updatesDir, 'file-5-days.json'))).toBe(true);
      expect(existsSync(join(updatesDir, 'file-10-days.json'))).toBe(false);
      expect(existsSync(join(updatesDir, 'file-20-days.json'))).toBe(false);
    });

    it('should do nothing when no old files exist', async () => {
      createUpdateFile('recent-1.json', 5);
      createUpdateFile('recent-2.json', 10);

      const result = await cleanup({ quiet: true });

      expect(result.deleted).toBe(0);
      expect(readdirSync(updatesDir)).toHaveLength(2);
    });
  });

  describe('dry-run mode', () => {
    it('should not delete files in dry-run mode', async () => {
      createUpdateFile('old-file.json', 45);
      createUpdateFile('recent-file.json', 5);

      const result = await cleanup({ dryRun: true, quiet: true });

      expect(result.deleted).toBe(0);
      expect(result.wouldDelete).toBe(1);
      expect(existsSync(join(updatesDir, 'old-file.json'))).toBe(true);
    });
  });

  describe('multiple projects', () => {
    it('should clean up files across all registered projects', async () => {
      // Create another project
      const project2Dir = join(REPO_DIR, 'projects', 'project-2', 'updates');
      mkdirSync(project2Dir, { recursive: true });

      // Update config to include second project
      const config = {
        version: '1.0',
        dashboard_repo: '',
        dashboard_url: '',
        projects: {
          [projectName]: { path: '/test/path', openspec: true, category: 'work' },
          'project-2': { path: '/test/path2', openspec: false, category: 'personal' },
        },
        machine: { name: 'test-machine', id: 'abc12345' },
      };
      writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

      createUpdateFile('old-in-p1.json', 45);
      writeFileSync(join(project2Dir, 'old-in-p2.json'), JSON.stringify({ test: true }));
      const fs = require('fs');
      const mtime = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      fs.utimesSync(join(project2Dir, 'old-in-p2.json'), mtime, mtime);

      const result = await cleanup({ quiet: true });

      expect(result.deleted).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should throw error when mindcontext not initialized', async () => {
      rmSync(CONFIG_FILE, { force: true });

      await expect(cleanup({ quiet: true })).rejects.toThrow(/not initialized/i);
    });
  });
});
