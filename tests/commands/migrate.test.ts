import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use temp directories for testing
const TEST_DIR = join(tmpdir(), 'mindcontext-migrate-test-' + Date.now());
const MINDCONTEXT_DIR = join(TEST_DIR, '.mindcontext');
const PROJECT_DIR = join(TEST_DIR, 'project');
const REPO_DIR = join(MINDCONTEXT_DIR, 'repo');

vi.mock('../../src/lib/config.js', async () => {
  const actual = await vi.importActual('../../src/lib/config.js');
  return {
    ...actual,
    getMindcontextDir: () => MINDCONTEXT_DIR,
    getRepoDir: () => REPO_DIR,
    isInitialized: () => existsSync(join(MINDCONTEXT_DIR, 'config.json')) && existsSync(REPO_DIR),
    readConfig: () => {
      const configPath = join(MINDCONTEXT_DIR, 'config.json');
      if (!existsSync(configPath)) return null;
      try {
        const fs = require('fs');
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch {
        return null;
      }
    },
    getProjectDir: (projectName: string) => join(REPO_DIR, 'projects', projectName, 'updates'),
    ensureProjectDir: (projectName: string) => {
      const dir = join(REPO_DIR, 'projects', projectName, 'updates');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    },
  };
});

// Import after mocking
import { migrate, detectMigrationSources, convertFocusToUpdate } from '../../src/commands/migrate.js';

describe('mc migrate command', () => {
  beforeEach(() => {
    // Create test environment
    mkdirSync(PROJECT_DIR, { recursive: true });
    mkdirSync(REPO_DIR, { recursive: true });

    // Create config
    const config = {
      version: '1.0',
      dashboard_repo: '',
      dashboard_url: '',
      projects: {
        'test-project': { path: PROJECT_DIR, openspec: false, category: 'work' },
      },
      machine: { name: 'test-machine', id: 'abc12345' },
    };
    writeFileSync(join(MINDCONTEXT_DIR, 'config.json'), JSON.stringify(config, null, 2));
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('detectMigrationSources', () => {
    it('should detect .project/ directory', () => {
      mkdirSync(join(PROJECT_DIR, '.project'), { recursive: true });
      writeFileSync(join(PROJECT_DIR, '.project', 'prd.md'), '# PRD');

      const sources = detectMigrationSources(PROJECT_DIR);

      expect(sources.hasProjectDir).toBe(true);
      expect(sources.projectFiles).toContain('prd.md');
    });

    it('should detect .claude/focus.json', () => {
      mkdirSync(join(PROJECT_DIR, '.claude'), { recursive: true });
      writeFileSync(
        join(PROJECT_DIR, '.claude', 'focus.json'),
        JSON.stringify({ current_focus: 'test' })
      );

      const sources = detectMigrationSources(PROJECT_DIR);

      expect(sources.hasFocusJson).toBe(true);
    });

    it('should return empty when nothing to migrate', () => {
      const sources = detectMigrationSources(PROJECT_DIR);

      expect(sources.hasProjectDir).toBe(false);
      expect(sources.hasFocusJson).toBe(false);
      expect(sources.projectFiles).toEqual([]);
    });

    it('should list all files in .project/', () => {
      mkdirSync(join(PROJECT_DIR, '.project', 'epics'), { recursive: true });
      writeFileSync(join(PROJECT_DIR, '.project', 'prd.md'), '# PRD');
      writeFileSync(join(PROJECT_DIR, '.project', 'epics', 'epic1.md'), '# Epic');

      const sources = detectMigrationSources(PROJECT_DIR);

      expect(sources.projectFiles).toContain('prd.md');
      expect(sources.projectFiles).toContain('epics/epic1.md');
    });
  });

  describe('convertFocusToUpdate', () => {
    it('should convert focus.json to update format', () => {
      const focusJson = {
        current_focus: 'Implementing user auth',
        session_summary: 'Added login endpoint',
        next_session_tasks: ['Add logout', 'Write tests'],
        timestamp: '2025-01-10T10:00:00Z',
      };

      const update = convertFocusToUpdate(focusJson, 'test-project', {
        name: 'test-machine',
        id: 'abc12345',
      });

      expect(update.project).toBe('test-project');
      expect(update.machine).toBe('test-machine');
      expect(update.context.current_task).toBe('Implementing user auth');
      expect(update.context.notes).toContain('Added login endpoint');
      expect(update.context.next).toEqual(['Add logout', 'Write tests']);
    });

    it('should handle minimal focus.json', () => {
      const focusJson = {
        current_focus: 'Working on feature',
      };

      const update = convertFocusToUpdate(focusJson, 'test-project', {
        name: 'test-machine',
        id: 'abc12345',
      });

      expect(update.context.current_task).toBe('Working on feature');
      expect(update.context.notes).toEqual([]);
      expect(update.context.next).toEqual([]);
    });
  });

  describe('migrate command - dry-run', () => {
    it('should show what would be migrated without making changes', async () => {
      // Setup migration sources
      mkdirSync(join(PROJECT_DIR, '.project'), { recursive: true });
      writeFileSync(join(PROJECT_DIR, '.project', 'prd.md'), '# PRD');
      mkdirSync(join(PROJECT_DIR, '.claude'), { recursive: true });
      writeFileSync(
        join(PROJECT_DIR, '.claude', 'focus.json'),
        JSON.stringify({ current_focus: 'test' })
      );

      const result = await migrate({
        projectPath: PROJECT_DIR,
        dryRun: true,
        quiet: true,
      });

      expect(result.sources.hasProjectDir).toBe(true);
      expect(result.sources.hasFocusJson).toBe(true);
      expect(result.migrated).toBe(false);

      // Files should still exist
      expect(existsSync(join(PROJECT_DIR, '.project', 'prd.md'))).toBe(true);
      expect(existsSync(join(PROJECT_DIR, '.claude', 'focus.json'))).toBe(true);
    });
  });

  describe('migrate command - focus.json only', () => {
    it('should migrate focus.json to update file', async () => {
      mkdirSync(join(PROJECT_DIR, '.claude'), { recursive: true });
      mkdirSync(join(REPO_DIR, 'projects', 'unknown-project', 'updates'), { recursive: true });

      const focusJson = {
        current_focus: 'Working on migration',
        session_summary: 'Implemented basic structure',
        next_session_tasks: ['Add tests', 'Refactor'],
      };
      writeFileSync(
        join(PROJECT_DIR, '.claude', 'focus.json'),
        JSON.stringify(focusJson, null, 2)
      );

      const result = await migrate({
        projectPath: PROJECT_DIR,
        quiet: true,
        skipProjectDir: true, // Only migrate focus.json
        autoConfirm: true, // Non-interactive
      });

      // The key assertion is that migration succeeded
      expect(result.focusMigrated).toBe(true);
      expect(result.migrated).toBe(true);
      expect(result.sources.hasFocusJson).toBe(true);
    });
  });

  describe('migrate command - nothing to migrate', () => {
    it('should report when nothing found to migrate', async () => {
      const result = await migrate({
        projectPath: PROJECT_DIR,
        quiet: true,
      });

      expect(result.sources.hasProjectDir).toBe(false);
      expect(result.sources.hasFocusJson).toBe(false);
      expect(result.migrated).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw error when mindcontext not initialized', async () => {
      rmSync(join(MINDCONTEXT_DIR, 'config.json'), { force: true });

      await expect(
        migrate({ projectPath: PROJECT_DIR, quiet: true })
      ).rejects.toThrow(/not initialized/i);
    });
  });
});
