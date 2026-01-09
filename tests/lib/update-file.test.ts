import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ProgressData, ContextData, UpdateFile } from '../../src/lib/update-file.js';

// Test data
const mockProgress: ProgressData = {
  source: 'openspec',
  change: 'add-feature',
  tasks_done: 3,
  tasks_total: 10,
};

const mockContext: ContextData = {
  current_task: 'task-1',
  status: 'in_progress',
  notes: ['Working on feature'],
  next: ['Add tests'],
};

describe('update-file', () => {
  describe('UpdateFile interface', () => {
    it('should define required fields', () => {
      const update: UpdateFile = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        machine: 'test-machine',
        machine_id: 'abc12345',
        project: 'test-project',
        progress: mockProgress,
        context: mockContext,
      };

      expect(update.version).toBe('1.0');
      expect(update.machine).toBe('test-machine');
      expect(update.machine_id).toBe('abc12345');
      expect(update.project).toBe('test-project');
    });
  });

  describe('ProgressData', () => {
    it('should support openspec source', () => {
      const progress: ProgressData = {
        source: 'openspec',
        change: 'add-feature',
        tasks_done: 5,
        tasks_total: 10,
      };

      expect(progress.source).toBe('openspec');
      expect(progress.change).toBe('add-feature');
    });

    it('should support manual source', () => {
      const progress: ProgressData = {
        source: 'manual',
        tasks_done: 0,
        tasks_total: 0,
      };

      expect(progress.source).toBe('manual');
      expect(progress.change).toBeUndefined();
    });

    it('should calculate percentage correctly', () => {
      const progress: ProgressData = {
        source: 'openspec',
        tasks_done: 7,
        tasks_total: 10,
      };

      const percentage = progress.tasks_total > 0
        ? Math.round((progress.tasks_done / progress.tasks_total) * 100)
        : 0;

      expect(percentage).toBe(70);
    });
  });

  describe('ContextData', () => {
    it('should support all status values', () => {
      const statuses: ContextData['status'][] = ['idle', 'in_progress', 'blocked', 'review'];

      for (const status of statuses) {
        const context: ContextData = {
          status,
          notes: [],
          next: [],
        };

        expect(context.status).toBe(status);
      }
    });

    it('should support optional current_task', () => {
      const contextWithTask: ContextData = {
        current_task: 'task-1',
        status: 'in_progress',
        notes: [],
        next: [],
      };

      const contextWithoutTask: ContextData = {
        status: 'idle',
        notes: [],
        next: [],
      };

      expect(contextWithTask.current_task).toBe('task-1');
      expect(contextWithoutTask.current_task).toBeUndefined();
    });
  });
});
