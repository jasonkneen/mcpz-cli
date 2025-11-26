import assert from 'node:assert';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock the real config module
import * as configModule from '../src/utils/config.js';

describe('Config Module', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'mcpz-test-' + Date.now());
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
    // Reset custom paths before each test
    configModule.setCustomLoadPath(null);
    configModule.setCustomSavePath(null);

    // Remove config file if exists
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  describe('readConfig', () => {
    it('should return default config when file does not exist', () => {
      const config = configModule.readConfig();
      assert.deepStrictEqual(config, { servers: [] });
    });

    it('should read an existing config file', () => {
      const testConfig = { servers: [{ name: 'test-server', command: 'test' }] };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));

      const config = configModule.readConfig();
      assert.deepStrictEqual(config, testConfig);
    });

    it('should return default config on parse error', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, 'invalid json {');

      const config = configModule.readConfig();
      assert.deepStrictEqual(config, { servers: [] });
    });

    it('should handle empty config file', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, '');

      const config = configModule.readConfig();
      assert.deepStrictEqual(config, { servers: [] });
    });
  });

  describe('writeConfig', () => {
    it('should write config to file', () => {
      const testConfig = {
        servers: [
          { name: 'test-server-1', command: 'test1' },
          { name: 'test-server-2', command: 'test2' }
        ]
      };

      const result = configModule.writeConfig(testConfig);

      assert.strictEqual(result, true);

      const readConfig = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
      assert.deepStrictEqual(readConfig, testConfig);
    });

    it('should create config file if it does not exist', () => {
      const config = { servers: [] };
      const success = configModule.writeConfig(config);

      assert.strictEqual(success, true);
      assert.strictEqual(fs.existsSync(TEST_CONFIG_PATH), true);
    });

    it('should format config with indentation', () => {
      const config = { servers: [{ name: 'test' }] };
      configModule.writeConfig(config);

      const content = fs.readFileSync(TEST_CONFIG_PATH, 'utf8');
      assert.ok(content.includes('\n'));
    });
  });

  describe('getServerByName', () => {
    it('should find a server by name', () => {
      const testConfig = {
        servers: [
          { name: 'server-a', command: 'cmd-a' },
          { name: 'server-b', command: 'cmd-b' }
        ]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));

      const server = configModule.getServerByName('server-b');

      assert.strictEqual(server.name, 'server-b');
      assert.strictEqual(server.command, 'cmd-b');
    });

    it('should return null for non-existent server', () => {
      const testConfig = { servers: [{ name: 'server-a', command: 'cmd-a' }] };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));

      const server = configModule.getServerByName('non-existent');

      assert.strictEqual(server, null);
    });

    it('should return null when servers list is empty', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));

      const server = configModule.getServerByName('any');

      assert.strictEqual(server, null);
    });
  });

  describe('addServer', () => {
    it('should add a new server to empty config', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));

      const server = { name: 'new-server', command: 'test-command' };
      const result = configModule.addServer(server);

      assert.strictEqual(result, true);

      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 1);
      assert.deepStrictEqual(config.servers[0], server);
    });

    it('should update an existing server with same name', () => {
      const initialConfig = {
        servers: [{ name: 'existing', command: 'old-cmd' }]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

      const updatedServer = { name: 'existing', command: 'new-cmd', args: ['arg1'] };
      const result = configModule.addServer(updatedServer);

      assert.strictEqual(result, true);

      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 1);
      assert.strictEqual(config.servers[0].command, 'new-cmd');
      assert.deepStrictEqual(config.servers[0].args, ['arg1']);
    });

    it('should append server to existing list', () => {
      const initialConfig = {
        servers: [{ name: 'server-1', command: 'cmd1' }]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

      const newServer = { name: 'server-2', command: 'cmd2' };
      configModule.addServer(newServer);

      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 2);
    });
  });

  describe('removeServer', () => {
    it('should remove an existing server', () => {
      const initialConfig = {
        servers: [
          { name: 'server-1', command: 'cmd1' },
          { name: 'server-2', command: 'cmd2' }
        ]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

      const result = configModule.removeServer('server-1');

      assert.strictEqual(result, true);

      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 1);
      assert.strictEqual(config.servers[0].name, 'server-2');
    });

    it('should return false when removing non-existent server', () => {
      const initialConfig = { servers: [{ name: 'server-1', command: 'cmd1' }] };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));

      const result = configModule.removeServer('non-existent');

      assert.strictEqual(result, false);

      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 1);
    });

    it('should handle removal from empty list', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));

      const result = configModule.removeServer('any');

      assert.strictEqual(result, false);
    });
  });

  describe('Groups Management', () => {
    it('should return empty object when no groups exist', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));

      const groups = configModule.getGroups();

      assert.deepStrictEqual(groups, {});
    });

    it('should add a new group', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));

      const result = configModule.addGroup('test-group', ['server1', 'server2']);

      assert.strictEqual(result, true);

      const groups = configModule.getGroups();
      assert.deepStrictEqual(groups['test-group'], ['server1', 'server2']);
    });

    it('should update an existing group', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [],
        groups: { 'existing': ['old-server'] }
      }));

      configModule.addGroup('existing', ['new-server1', 'new-server2']);

      const groups = configModule.getGroups();
      assert.deepStrictEqual(groups['existing'], ['new-server1', 'new-server2']);
    });

    it('should remove an existing group', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [],
        groups: { 'to-remove': ['server1'] }
      }));

      const result = configModule.removeGroup('to-remove');

      assert.strictEqual(result, true);

      const groups = configModule.getGroups();
      assert.strictEqual(groups['to-remove'], undefined);
    });

    it('should return false when removing non-existent group', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));

      const result = configModule.removeGroup('non-existent');

      assert.strictEqual(result, false);
    });
  });

  describe('expandServerOrGroup', () => {
    it('should return server name if not a group', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));

      const result = configModule.expandServerOrGroup('single-server');

      assert.deepStrictEqual(result, ['single-server']);
    });

    it('should expand group to server names', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [],
        groups: { 'my-group': ['server1', 'server2', 'server3'] }
      }));

      const result = configModule.expandServerOrGroup('my-group');

      assert.deepStrictEqual(result, ['server1', 'server2', 'server3']);
    });
  });

  describe('Custom Paths', () => {
    it('should use custom load path', () => {
      const customPath = path.join(TEST_DIR, 'custom-load.json');
      const customConfig = { servers: [{ name: 'custom', command: 'custom-cmd' }] };
      fs.writeFileSync(customPath, JSON.stringify(customConfig));

      configModule.setCustomLoadPath(customPath);

      const config = configModule.readConfig();
      assert.strictEqual(config.servers[0].name, 'custom');

      configModule.setCustomLoadPath(null);
    });

    it('should use custom save path', () => {
      const customSavePath = path.join(TEST_DIR, 'custom-save', 'config.json');

      configModule.setCustomSavePath(customSavePath);

      const config = { servers: [{ name: 'saved', command: 'save-cmd' }] };
      configModule.writeConfig(config);

      assert.ok(fs.existsSync(customSavePath));

      const savedConfig = JSON.parse(fs.readFileSync(customSavePath, 'utf8'));
      assert.strictEqual(savedConfig.servers[0].name, 'saved');

      configModule.setCustomSavePath(null);
    });
  });
});
