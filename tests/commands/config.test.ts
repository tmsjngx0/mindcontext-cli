import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the config module to use test directory
const TEST_DIR = join(tmpdir(), 'mindcontext-config-test-' + Date.now());
const CONFIG_FILE = join(TEST_DIR, 'config.json');

vi.mock('../../src/lib/config.js', async () => {
  const actual = await vi.importActual('../../src/lib/config.js');
  return {
    ...actual,
    getMindcontextDir: () => TEST_DIR,
    isInitialized: () => existsSync(CONFIG_FILE),
    readConfig: () => {
      if (!existsSync(CONFIG_FILE)) return null;
      try {
        return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
      } catch {
        return null;
      }
    },
    writeConfig: (config: unknown) => {
      if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true });
      }
      writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    },
  };
});

// Import after mocking
import { config } from '../../src/commands/config.js';

describe('mc config command', () => {
  beforeEach(() => {
    // Create temp directory with config
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    // Create a default config
    const defaultConfig = {
      version: '1.0',
      dashboard_repo: '',
      dashboard_url: '',
      projects: {},
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

  describe('show config', () => {
    it('should return current config when called with no options', async () => {
      const result = await config({ show: true });

      expect(result).toHaveProperty('dashboard_repo');
      expect(result).toHaveProperty('dashboard_url');
      expect(result).toHaveProperty('machine');
    });

    it('should return specific key when --get is used', async () => {
      // Set up config with values
      const testConfig = {
        version: '1.0',
        dashboard_repo: 'git@github.com:user/dashboard.git',
        dashboard_url: 'https://user.github.io/dashboard',
        projects: {},
        machine: { name: 'test-machine', id: 'abc12345' },
      };
      writeFileSync(CONFIG_FILE, JSON.stringify(testConfig, null, 2));

      const result = await config({ get: 'dashboard_repo' });

      expect(result).toBe('git@github.com:user/dashboard.git');
    });
  });

  describe('set config values', () => {
    it('should set dashboard_repo when --dashboard-repo is provided', async () => {
      await config({ dashboardRepo: 'git@github.com:new/repo.git' });

      const savedConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
      expect(savedConfig.dashboard_repo).toBe('git@github.com:new/repo.git');
    });

    it('should set dashboard_url when --dashboard-url is provided', async () => {
      await config({ dashboardUrl: 'https://example.github.io/dashboard' });

      const savedConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
      expect(savedConfig.dashboard_url).toBe('https://example.github.io/dashboard');
    });

    it('should set multiple values at once', async () => {
      await config({
        dashboardRepo: 'git@github.com:user/dash.git',
        dashboardUrl: 'https://user.github.io/dash',
      });

      const savedConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
      expect(savedConfig.dashboard_repo).toBe('git@github.com:user/dash.git');
      expect(savedConfig.dashboard_url).toBe('https://user.github.io/dash');
    });

    it('should preserve existing config when setting new values', async () => {
      // Set up config with existing project
      const testConfig = {
        version: '1.0',
        dashboard_repo: 'old-repo',
        dashboard_url: 'old-url',
        projects: { 'my-project': { path: '/path', openspec: true, category: 'work' } },
        machine: { name: 'test-machine', id: 'abc12345' },
      };
      writeFileSync(CONFIG_FILE, JSON.stringify(testConfig, null, 2));

      await config({ dashboardUrl: 'new-url' });

      const savedConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
      expect(savedConfig.dashboard_url).toBe('new-url');
      expect(savedConfig.dashboard_repo).toBe('old-repo'); // preserved
      expect(savedConfig.projects['my-project']).toBeDefined(); // preserved
    });
  });

  describe('error handling', () => {
    it('should throw error when mindcontext not initialized', async () => {
      // Remove config file to simulate uninitialized state
      rmSync(CONFIG_FILE, { force: true });

      await expect(config({ show: true })).rejects.toThrow(/not initialized/i);
    });
  });
});
