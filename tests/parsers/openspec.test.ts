import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { hasOpenSpec, parseOpenSpec, getOpenSpecProgress } from '../../src/parsers/openspec.js';

// Use a temp directory for testing
const TEST_DIR = join(tmpdir(), 'openspec-test-' + Date.now());

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

describe('openspec parser', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('hasOpenSpec', () => {
    it('should return false for empty directory', () => {
      const projectDir = join(TEST_DIR, 'empty-project');
      mkdirSync(projectDir, { recursive: true });

      expect(hasOpenSpec(projectDir)).toBe(false);
    });

    it('should return false for directory without openspec', () => {
      const projectDir = createTestProject({
        'src/index.ts': 'console.log("hello");',
        'package.json': '{}',
      });

      expect(hasOpenSpec(projectDir)).toBe(false);
    });

    it('should return true for directory with openspec structure', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/.gitkeep': '',
      });

      expect(hasOpenSpec(projectDir)).toBe(true);
    });

    it('should return false for openspec without changes directory', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
      });

      expect(hasOpenSpec(projectDir)).toBe(false);
    });
  });

  describe('parseOpenSpec', () => {
    it('should return found: false for non-openspec project', () => {
      const projectDir = join(TEST_DIR, 'no-openspec');
      mkdirSync(projectDir, { recursive: true });

      const result = parseOpenSpec(projectDir);

      expect(result.found).toBe(false);
      expect(result.changes).toEqual([]);
      expect(result.activeChange).toBeNull();
    });

    it('should parse a project with no changes', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/.gitkeep': '',
      });

      const result = parseOpenSpec(projectDir);

      expect(result.found).toBe(true);
      expect(result.changes).toEqual([]);
      expect(result.activeChange).toBeNull();
    });

    it('should parse a change with tasks', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/add-feature/proposal.md': '# Proposal',
        'openspec/changes/add-feature/tasks.md': `
# Tasks

- [ ] Task 1
- [x] Task 2
- [ ] Task 3
- [x] Task 4
`,
      });

      const result = parseOpenSpec(projectDir);

      expect(result.found).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].id).toBe('add-feature');
      expect(result.changes[0].tasksTotal).toBe(4);
      expect(result.changes[0].tasksComplete).toBe(2);
    });

    it('should identify active change as in_progress', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/add-feature/tasks.md': `
- [x] Task 1
- [ ] Task 2
`,
      });

      const result = parseOpenSpec(projectDir);

      expect(result.activeChange).not.toBeNull();
      expect(result.activeChange?.status).toBe('in_progress');
    });

    it('should identify completed change as done', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/add-feature/tasks.md': `
- [x] Task 1
- [x] Task 2
`,
      });

      const result = parseOpenSpec(projectDir);

      expect(result.changes[0].status).toBe('done');
    });

    it('should skip archive directory', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/archive/old-feature/tasks.md': '- [x] Done',
        'openspec/changes/new-feature/tasks.md': '- [ ] Todo',
      });

      const result = parseOpenSpec(projectDir);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].id).toBe('new-feature');
    });

    it('should handle multiple changes', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/feature-a/tasks.md': '- [ ] Task A',
        'openspec/changes/feature-b/tasks.md': '- [x] Task B1\n- [ ] Task B2',
        'openspec/changes/feature-c/tasks.md': '- [x] Task C',
      });

      const result = parseOpenSpec(projectDir);

      expect(result.changes).toHaveLength(3);
      // Active should be the in_progress one (feature-b)
      expect(result.activeChange?.id).toBe('feature-b');
    });
  });

  describe('getOpenSpecProgress', () => {
    it('should return manual source for non-openspec project', () => {
      const projectDir = join(TEST_DIR, 'no-openspec');
      mkdirSync(projectDir, { recursive: true });

      const result = getOpenSpecProgress(projectDir);

      expect(result.source).toBe('manual');
      expect(result.tasks_done).toBe(0);
      expect(result.tasks_total).toBe(0);
    });

    it('should return openspec source with progress data', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/add-feature/tasks.md': `
- [x] Task 1
- [x] Task 2
- [ ] Task 3
`,
      });

      const result = getOpenSpecProgress(projectDir);

      expect(result.source).toBe('openspec');
      expect(result.change).toBe('add-feature');
      expect(result.tasks_done).toBe(2);
      expect(result.tasks_total).toBe(3);
    });

    it('should return progress for active change only', () => {
      const projectDir = createTestProject({
        'openspec/project.md': '# Project',
        'openspec/changes/feature-a/tasks.md': '- [ ] Pending',
        'openspec/changes/feature-b/tasks.md': '- [x] Done\n- [ ] Pending',
      });

      const result = getOpenSpecProgress(projectDir);

      // Should return the in_progress change (feature-b)
      expect(result.change).toBe('feature-b');
      expect(result.tasks_done).toBe(1);
      expect(result.tasks_total).toBe(2);
    });
  });
});
