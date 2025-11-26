import assert from 'node:assert';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the command modules
import { add } from '../src/commands/add.js';
import { remove } from '../src/commands/remove.js';
import { list } from '../src/commands/list.js';

// Import config module to manipulate paths
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

describe('Command Tests', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'mcpz-cmd-test-' + Date.now());
  const TEST_CONFIG_DIR = path.join(TEST_DIR, '.mcpz');
  const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json');

  // Save original config values
  let originalDir;
  let originalPath;

  before(() => {
    // Save original paths
    originalDir = configModule.CONFIG.DIR;
    originalPath = configModule.CONFIG.PATH;

    // Create test directory
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }

    // Override the config path for testing
    configModule.CONFIG.DIR = TEST_CONFIG_DIR;
    configModule.CONFIG.PATH = TEST_CONFIG_PATH;
  });

  after(() => {
    // Restore original paths
    configModule.CONFIG.DIR = originalDir;
    configModule.CONFIG.PATH = originalPath;

    // Clean up test files
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Initialize with empty config
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));
  });

  describe('add command', () => {
    it('should add a new server configuration', () => {
      const capture = captureConsole();

      try {
        add('test-server', { command: 'test-cmd', args: 'arg1,arg2', env: 'KEY=value' });
      } finally {
        capture.restore();
      }

      // Check the config file
      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 1);
      assert.strictEqual(config.servers[0].name, 'test-server');
      assert.strictEqual(config.servers[0].command, 'test-cmd');
      assert.deepStrictEqual(config.servers[0].args, ['arg1', 'arg2']);
      assert.deepStrictEqual(config.servers[0].env, { KEY: 'value' });
    });

    it('should require a name', () => {
      const capture = captureConsole();

      try {
        add(null, { command: 'cmd' });
      } finally {
        capture.restore();
      }

      assert.ok(capture.logs.info.some(log => log.includes('Name is required')));
    });

    it('should require a command', () => {
      const capture = captureConsole();

      try {
        add('test', {});
      } finally {
        capture.restore();
      }

      assert.ok(capture.logs.info.some(log => log.includes('Command is required')));
    });

    it('should update existing server with same name', () => {
      // First add
      const capture1 = captureConsole();
      try {
        add('update-server', { command: 'old-cmd' });
      } finally {
        capture1.restore();
      }

      // Second add with same name
      const capture2 = captureConsole();
      try {
        add('update-server', { command: 'new-cmd' });
      } finally {
        capture2.restore();
      }

      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 1);
      assert.strictEqual(config.servers[0].command, 'new-cmd');
    });

    it('should handle empty args and env', () => {
      const capture = captureConsole();

      try {
        add('simple-server', { command: 'cmd' });
      } finally {
        capture.restore();
      }

      const config = configModule.readConfig();
      assert.deepStrictEqual(config.servers[0].args, []);
      assert.deepStrictEqual(config.servers[0].env, {});
    });

    it('should parse multiple environment variables', () => {
      const capture = captureConsole();

      try {
        add('env-server', { command: 'cmd', env: 'KEY1=val1,KEY2=val2,KEY3=val3' });
      } finally {
        capture.restore();
      }

      const config = configModule.readConfig();
      assert.deepStrictEqual(config.servers[0].env, {
        KEY1: 'val1',
        KEY2: 'val2',
        KEY3: 'val3'
      });
    });

    it('should assign a unique UUID to each server', () => {
      const capture = captureConsole();

      try {
        add('uuid-server-1', { command: 'cmd1' });
        add('uuid-server-2', { command: 'cmd2' });
      } finally {
        capture.restore();
      }

      const config = configModule.readConfig();
      assert.ok(config.servers[0].id);
      assert.ok(config.servers[1].id);
      assert.notStrictEqual(config.servers[0].id, config.servers[1].id);
    });

    it('should set enabled to true by default', () => {
      const capture = captureConsole();

      try {
        add('enabled-server', { command: 'cmd' });
      } finally {
        capture.restore();
      }

      const config = configModule.readConfig();
      assert.strictEqual(config.servers[0].enabled, true);
    });

    it('should set type to process by default', () => {
      const capture = captureConsole();

      try {
        add('type-server', { command: 'cmd' });
      } finally {
        capture.restore();
      }

      const config = configModule.readConfig();
      assert.strictEqual(config.servers[0].type, 'process');
    });
  });

  describe('remove command', () => {
    it('should remove an existing server configuration', () => {
      // Setup
      const initialConfig = { servers: [{ name: 'to-remove', command: 'cmd' }] };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

      const capture = captureConsole();

      try {
        remove('to-remove');
      } finally {
        capture.restore();
      }

      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 0);
    });

    it('should handle non-existent server', () => {
      const capture = captureConsole();

      try {
        remove('non-existent');
      } finally {
        capture.restore();
      }

      // Should output an error about server not found
      const allOutput = [...capture.logs.error, ...capture.logs.info].join(' ');
      assert.ok(allOutput.includes('No MCP configuration found') || allOutput.includes('non-existent'));
    });

    it('should require a name', () => {
      const capture = captureConsole();

      try {
        remove(null);
      } finally {
        capture.restore();
      }

      assert.ok(capture.logs.error.some(log => log.includes('required')));
    });

    it('should not affect other servers when removing one', () => {
      const initialConfig = {
        servers: [
          { name: 'keep-1', command: 'cmd1' },
          { name: 'remove-me', command: 'cmd2' },
          { name: 'keep-2', command: 'cmd3' }
        ]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

      const capture = captureConsole();

      try {
        remove('remove-me');
      } finally {
        capture.restore();
      }

      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 2);
      assert.ok(config.servers.some(s => s.name === 'keep-1'));
      assert.ok(config.servers.some(s => s.name === 'keep-2'));
      assert.ok(!config.servers.some(s => s.name === 'remove-me'));
    });
  });

  describe('list command', () => {
    it('should list all server configurations', () => {
      const initialConfig = {
        servers: [
          { id: '1', name: 'server-1', command: 'cmd1', args: [], env: {}, enabled: true, type: 'process' },
          { id: '2', name: 'server-2', command: 'cmd2', args: ['arg1'], env: { KEY: 'val' }, enabled: false, type: 'process' }
        ]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

      const capture = captureConsole();

      try {
        list();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('server-1'));
      assert.ok(allOutput.includes('server-2'));
    });

    it('should handle empty server list', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));

      const capture = captureConsole();

      try {
        list();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('No MCP configurations found'));
    });

    it('should display server details', () => {
      const initialConfig = {
        servers: [{
          id: 'test-id',
          name: 'detailed-server',
          command: 'node server.js',
          args: ['--port', '3000'],
          env: { NODE_ENV: 'production' },
          enabled: true,
          type: 'process'
        }]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

      const capture = captureConsole();

      try {
        list();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('detailed-server'));
      assert.ok(allOutput.includes('node server.js'));
    });
  });
});
