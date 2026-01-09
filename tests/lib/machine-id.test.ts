import { describe, it, expect } from 'vitest';
import { getMachineId, getTimestamp, generateUpdateFilename } from '../../src/lib/machine-id.js';

describe('machine-id', () => {
  describe('getMachineId', () => {
    it('should return an object with name and id', () => {
      const result = getMachineId();

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('id');
    });

    it('should return consistent results on multiple calls', () => {
      const result1 = getMachineId();
      const result2 = getMachineId();

      expect(result1.name).toBe(result2.name);
      expect(result1.id).toBe(result2.id);
    });

    it('should return an id of 8 characters', () => {
      const result = getMachineId();

      expect(result.id).toHaveLength(8);
    });

    it('should return a name containing only lowercase letters, numbers, and dashes', () => {
      const result = getMachineId();

      expect(result.name).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe('getTimestamp', () => {
    it('should return a timestamp string', () => {
      const result = getTimestamp();

      expect(typeof result).toBe('string');
    });

    it('should return a timestamp with dashes instead of colons', () => {
      const result = getTimestamp();

      expect(result).not.toContain(':');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
    });

    it('should return different timestamps on subsequent calls with delay', async () => {
      const result1 = getTimestamp();
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait 1.1 seconds
      const result2 = getTimestamp();

      expect(result1).not.toBe(result2);
    });
  });

  describe('generateUpdateFilename', () => {
    it('should return a filename ending in .json', () => {
      const result = generateUpdateFilename();

      expect(result).toMatch(/\.json$/);
    });

    it('should include timestamp, machine name, and machine id', () => {
      const result = generateUpdateFilename();
      const { name, id } = getMachineId();

      expect(result).toContain(name);
      expect(result).toContain(id);
    });

    it('should follow the format: timestamp_name_id.json', () => {
      const result = generateUpdateFilename();

      // Should match: YYYY-MM-DDTHH-MM-SS_machine-name_abc12345.json
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[a-z0-9-]+_[a-f0-9]{8}\.json$/);
    });
  });
});
