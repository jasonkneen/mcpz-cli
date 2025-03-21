import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock the real config module
import * as configModule from '../src/utils/config.js';

describe('Config Module', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'mcpz-test');
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
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    
    // Remove test directory
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });
  
  it('should create a new config file if one does not exist', () => {
    // Remove any existing test config
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    
    const config = configModule.readConfig();
    
    assert.deepStrictEqual(config, { servers: [] });
    
    // The config file doesn't get created until writeConfig is called
    // Let's write the config to verify the directory gets created
    const success = configModule.writeConfig(config);
    assert.strictEqual(success, true);
    assert.strictEqual(fs.existsSync(TEST_CONFIG_PATH), true);
  });
  
  it('should read an existing config file', () => {
    const testConfig = { servers: [{ name: 'test-server', command: 'test' }] };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
    
    const config = configModule.readConfig();
    
    assert.deepStrictEqual(config, testConfig);
  });
  
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
  
  it('should add a server to the config', () => {
    const initialConfig = { servers: [] };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));
    
    const server = { name: 'new-server', command: 'test-command' };
    const result = configModule.addServer(server);
    
    assert.strictEqual(result, true);
    
    const config = configModule.readConfig();
    assert.strictEqual(config.servers.length, 1);
    assert.deepStrictEqual(config.servers[0], server);
  });
  
  it('should remove a server from the config', () => {
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
  
  it('should return false when removing a non-existent server', () => {
    const initialConfig = { 
      servers: [{ name: 'server-1', command: 'cmd1' }]
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));
    
    const result = configModule.removeServer('non-existent');
    
    assert.strictEqual(result, false);
    
    const config = configModule.readConfig();
    assert.strictEqual(config.servers.length, 1);
  });
});