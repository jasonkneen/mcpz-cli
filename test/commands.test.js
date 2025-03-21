import assert from 'node:assert';
import { describe, it, before, after, mock } from 'node:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock the console for capturing output
import { stdout } from 'node:process';

// Import the command modules
import { add } from '../src/commands/add.js';
import { remove } from '../src/commands/remove.js';
import { list } from '../src/commands/list.js';

// Mock the config module
import * as configModule from '../src/utils/config.js';

describe('Command Tests', () => {
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
    
    // Initialize with empty config
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));
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
  
  describe('add command', () => {
    it('should add a new server configuration', () => {
      // Mock console functions to prevent output during tests
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalError = console.error;
      console.log = () => {};
      console.info = () => {};
      console.error = () => {};
      
      // Call the add command
      add('test-server', { command: 'test-cmd', args: 'arg1,arg2', env: 'KEY=value' });
      
      // Restore console functions
      console.log = originalLog;
      console.info = originalInfo;
      console.error = originalError;
      
      // Check the config file
      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 1);
      assert.strictEqual(config.servers[0].name, 'test-server');
      assert.strictEqual(config.servers[0].command, 'test-cmd');
      assert.deepStrictEqual(config.servers[0].args, ['arg1', 'arg2']);
      assert.deepStrictEqual(config.servers[0].env, { KEY: 'value' });
    });
  });
  
  describe('remove command', () => {
    it('should remove an existing server configuration', () => {
      // Setup test data
      const initialConfig = { 
        servers: [{ name: 'test-server', command: 'test-cmd' }]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));
      
      // Mock console functions to prevent output during tests
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalError = console.error;
      console.log = () => {};
      console.info = () => {};
      console.error = () => {};
      
      // Call the remove command
      remove('test-server');
      
      // Restore console functions
      console.log = originalLog;
      console.info = originalInfo;
      console.error = originalError;
      
      // Check the config file
      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 0);
    });
    
    it('should handle non-existent server', () => {
      // Setup test data
      const initialConfig = { servers: [] };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));
      
      // Mock console functions to prevent output during tests
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalError = console.error;
      console.log = () => {};
      console.info = () => {};
      console.error = () => {};
      
      // Call the remove command
      remove('non-existent');
      
      // Restore console functions
      console.log = originalLog;
      console.info = originalInfo;
      console.error = originalError;
      
      // Removing a non-existent server doesn't change the config
      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 0);
    });
  });
  
  describe('list command', () => {
    it('should list all server configurations', () => {
      // Setup test data
      const initialConfig = { 
        servers: [
          { name: 'server-1', command: 'cmd1' },
          { name: 'server-2', command: 'cmd2' }
        ]
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));
      
      // Mock console functions to prevent output during tests
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalError = console.error;
      console.log = () => {};
      console.info = () => {};
      console.error = () => {};
      
      // Call the list command - this just outputs to console, so we're
      // mainly testing that it doesn't crash with the test data
      list();
      
      // Restore console functions
      console.log = originalLog;
      console.info = originalInfo;
      console.error = originalError;
      
      // Verify the config hasn't changed
      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 2);
      assert.strictEqual(config.servers[0].name, 'server-1');
      assert.strictEqual(config.servers[1].name, 'server-2');
    });
    
    it('should handle empty server list', () => {
      // Setup test data
      const initialConfig = { servers: [] };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(initialConfig));
      
      // Mock console functions to prevent output during tests
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalError = console.error;
      console.log = () => {};
      console.info = () => {};
      console.error = () => {};
      
      // Call the list command - this just outputs to console
      list();
      
      // Restore console functions
      console.log = originalLog;
      console.info = originalInfo;
      console.error = originalError;
      
      // Verify the config is still empty
      const config = configModule.readConfig();
      assert.strictEqual(config.servers.length, 0);
    });
  });
});