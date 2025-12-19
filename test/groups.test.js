import assert from 'node:assert';
import { describe, it, before, after, beforeEach } from 'node:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the groups command
import { addGroup, removeGroup, listGroups } from '../src/commands/groups.js';

// Import config module
import * as configModule from '../src/utils/config.js';

// Helper to capture console output
function captureConsole() {
  const logs = { log: [], error: [], info: [], warn: [] };
  const original = {
    log: console.log,
    error: console.error,
    info: console.info,
    warn: console.warn
  };

  console.log = (...args) => logs.log.push(args.join(' '));
  console.error = (...args) => logs.error.push(args.join(' '));
  console.info = (...args) => logs.info.push(args.join(' '));
  console.warn = (...args) => logs.warn.push(args.join(' '));

  return {
    logs,
    restore: () => {
      console.log = original.log;
      console.error = original.error;
      console.info = original.info;
      console.warn = original.warn;
    }
  };
}

describe('Groups Command Tests', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'mcpz-groups-test-' + Date.now());
  const TEST_CONFIG_DIR = path.join(TEST_DIR, '.mcpz');
  const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json');

  let originalDir;
  let originalPath;

  before(() => {
    originalDir = configModule.CONFIG.DIR;
    originalPath = configModule.CONFIG.PATH;

    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });

    configModule.CONFIG.DIR = TEST_CONFIG_DIR;
    configModule.CONFIG.PATH = TEST_CONFIG_PATH;
  });

  after(() => {
    configModule.CONFIG.DIR = originalDir;
    configModule.CONFIG.PATH = originalPath;

    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [], groups: {} }));
  });

  describe('addGroup', () => {
    it('should add a new group with servers', () => {
      const capture = captureConsole();

      try {
        addGroup('my-group', { servers: 'server1,server2,server3' });
      } finally {
        capture.restore();
      }

      const groups = configModule.getGroups();
      assert.deepStrictEqual(groups['my-group'], ['server1', 'server2', 'server3']);
    });

    it('should require a group name', () => {
      const capture = captureConsole();

      try {
        addGroup(null, { servers: 'server1' });
      } finally {
        capture.restore();
      }

      assert.ok(capture.logs.info.some(log => log.includes('Group name is required')));
    });

    it('should require servers option', () => {
      const capture = captureConsole();

      try {
        addGroup('test-group', {});
      } finally {
        capture.restore();
      }

      assert.ok(capture.logs.info.some(log => log.includes('Server list is required')));
    });

    it('should handle empty servers list', () => {
      const capture = captureConsole();

      try {
        addGroup('empty-group', { servers: '' });
      } finally {
        capture.restore();
      }

      // Should show an error about empty server list
      const allOutput = capture.logs.info.join(' ');
      assert.ok(
        allOutput.includes('cannot be empty') ||
        allOutput.includes('Server list') ||
        allOutput.includes('required')
      );
    });

    it('should trim whitespace from server names', () => {
      const capture = captureConsole();

      try {
        addGroup('trimmed-group', { servers: ' server1 , server2 , server3 ' });
      } finally {
        capture.restore();
      }

      const groups = configModule.getGroups();
      assert.deepStrictEqual(groups['trimmed-group'], ['server1', 'server2', 'server3']);
    });

    it('should update an existing group', () => {
      // Add initial group
      const capture1 = captureConsole();
      try {
        addGroup('update-group', { servers: 'old-server' });
      } finally {
        capture1.restore();
      }

      // Update the group
      const capture2 = captureConsole();
      try {
        addGroup('update-group', { servers: 'new-server1,new-server2' });
      } finally {
        capture2.restore();
      }

      const groups = configModule.getGroups();
      assert.deepStrictEqual(groups['update-group'], ['new-server1', 'new-server2']);
    });
  });

  describe('removeGroup', () => {
    it('should remove an existing group', () => {
      // Setup
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [],
        groups: { 'to-remove': ['server1'] }
      }));

      const capture = captureConsole();

      try {
        removeGroup('to-remove');
      } finally {
        capture.restore();
      }

      const groups = configModule.getGroups();
      assert.strictEqual(groups['to-remove'], undefined);
    });

    it('should require a group name', () => {
      const capture = captureConsole();

      try {
        removeGroup(null);
      } finally {
        capture.restore();
      }

      assert.ok(capture.logs.info.some(log => log.includes('Group name is required')));
    });

    it('should handle non-existent group', () => {
      const capture = captureConsole();

      try {
        removeGroup('non-existent');
      } finally {
        capture.restore();
      }

      assert.ok(capture.logs.info.some(log => log.includes('not found')));
    });
  });

  describe('listGroups', () => {
    it('should list all groups', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [],
        groups: {
          'group-1': ['server-a', 'server-b'],
          'group-2': ['server-c']
        }
      }));

      const capture = captureConsole();

      try {
        listGroups();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('group-1'));
      assert.ok(allOutput.includes('group-2'));
      assert.ok(allOutput.includes('server-a'));
      assert.ok(allOutput.includes('server-b'));
      assert.ok(allOutput.includes('server-c'));
    });

    it('should handle empty groups', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [], groups: {} }));

      const capture = captureConsole();

      try {
        listGroups();
      } finally {
        capture.restore();
      }

      assert.ok(capture.logs.info.some(log => log.includes('No server groups defined')));
    });

    it('should handle group with empty servers array', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [],
        groups: { 'empty-group': [] }
      }));

      const capture = captureConsole();

      try {
        listGroups();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('empty-group'));
      assert.ok(allOutput.includes('No servers in this group'));
    });
  });
});
