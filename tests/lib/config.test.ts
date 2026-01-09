import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createDefaultConfig,
  type Config,
} from '../../src/lib/config.js';

// Use a temp directory for testing
const TEST_DIR = join(tmpdir(), 'mindcontext-test-' + Date.now());

describe('config', () => {
  beforeEach(() => {
    // Create temp directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('createDefaultConfig', () => {
    it('should create a config with version 1.0', () => {
      const config = createDefaultConfig();

      expect(config.version).toBe('1.0');
    });

    it('should create a config with empty dashboard_repo', () => {
      const config = createDefaultConfig();

      expect(config.dashboard_repo).toBe('');
    });

    it('should create a config with empty dashboard_url', () => {
      const config = createDefaultConfig();

      expect(config.dashboard_url).toBe('');
    });

    it('should create a config with empty projects object', () => {
      const config = createDefaultConfig();

      expect(config.projects).toEqual({});
    });

    it('should create a config with machine info', () => {
      const config = createDefaultConfig();

      expect(config.machine).toHaveProperty('name');
      expect(config.machine).toHaveProperty('id');
      expect(config.machine.name).toBeTruthy();
      expect(config.machine.id).toHaveLength(8);
    });
  });

  describe('Config structure', () => {
    it('should have required fields when serialized to JSON', () => {
      const config = createDefaultConfig();
      const json = JSON.stringify(config);
      const parsed = JSON.parse(json) as Config;

      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('dashboard_repo');
      expect(parsed).toHaveProperty('dashboard_url');
      expect(parsed).toHaveProperty('projects');
      expect(parsed).toHaveProperty('machine');
    });
  });
});
