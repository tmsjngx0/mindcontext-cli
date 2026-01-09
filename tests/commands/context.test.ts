import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getOpenSpecProgress } from '../../src/parsers/openspec.js';

// Mock process.cwd() to return our test directory
const TEST_DIR = join(tmpdir(), 'context-test-' + Date.now());

function createTestProject(structure: Record<string, string>): string {
  const projectDir = join(TEST_DIR, 'test-project');

  for (const [path, content] of Object.entries(structure)) {
    const fullPath = join(projectDir, path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
  }

  return projectDir;
}

describe('context command', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('ContextOutput structure', () => {
    it('should define the expected output format', () => {
      interface ContextOutput {
        project: string;
        connected: boolean;
        progress: {
          source: 'openspec' | 'manual';
          change?: string;
          tasks_done: number;
          tasks_total: number;
          percentage: number;
        };
        lastUpdate?: {
          timestamp: string;
          machine: string;
          status: string;
          notes: string[];
          next: string[];
        };
        team: Array<{
          machine: string;
          timestamp: string;
          status: string;
        }>;
      }

      const output: ContextOutput = {
        project: 'test-project',
        connected: false,
        progress: {
          source: 'manual',
          tasks_done: 0,
          tasks_total: 0,
          percentage: 0,
        },
        team: [],
      };

      expect(output.project).toBe('test-project');
      expect(output.connected).toBe(false);
      expect(output.progress.source).toBe('manual');
    });

    it('should calculate percentage correctly', () => {
      const tasks_done = 7;
      const tasks_total = 10;

      const percentage = tasks_total > 0
        ? Math.round((tasks_done / tasks_total) * 100)
        : 0;

      expect(percentage).toBe(70);
    });

    it('should return 0 percentage when no tasks', () => {
      const tasks_done = 0;
      const tasks_total = 0;

      const percentage = tasks_total > 0
        ? Math.round((tasks_done / tasks_total) * 100)
        : 0;

      expect(percentage).toBe(0);
    });
  });

  describe('context with openspec project', () => {
    it('should detect openspec and return progress', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/add-feature/tasks.md': `
- [x] Task 1
- [x] Task 2
- [ ] Task 3
- [ ] Task 4
`,
      });

      const progress = getOpenSpecProgress(projectDir);

      expect(progress.source).toBe('openspec');
      expect(progress.change).toBe('add-feature');
      expect(progress.tasks_done).toBe(2);
      expect(progress.tasks_total).toBe(4);
    });
  });
});
