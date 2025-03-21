import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the config command
import { config } from '../src/commands/config.js';

// Import config module to manipulate paths
import * as configModule from '../src/utils/config.js';

describe('Config Command', () => {
  // Set up test paths
  const TEST_DIR = path.join(os.tmpdir(), 'mcpz-test');
  const DEFAULT_CONFIG_PATH = path.join(TEST_DIR, 'default-config.json');
  const CUSTOM_CONFIG_PATH = path.join(TEST_DIR, 'custom', 'config.json');
  
  // Save original config values
  let originalDir;
  let originalPath;
  
  before(() => {
    // Save original paths
    originalDir = configModule.CONFIG.DIR;
    originalPath = configModule.CONFIG.PATH;
    
    // Create test directories
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
    const customDir = path.dirname(CUSTOM_CONFIG_PATH);
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    
    // Override the config path for testing
    configModule.CONFIG.DIR = path.dirname(DEFAULT_CONFIG_PATH);
    configModule.CONFIG.PATH = DEFAULT_CONFIG_PATH;
  });
  
  after(() => {
    // Restore original paths
    configModule.CONFIG.DIR = originalDir;
    configModule.CONFIG.PATH = originalPath;
    
    // Clean up test files
    if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
      fs.unlinkSync(DEFAULT_CONFIG_PATH);
    }
    
    if (fs.existsSync(CUSTOM_CONFIG_PATH)) {
      fs.unlinkSync(CUSTOM_CONFIG_PATH);
    }
    
    // Remove test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });
  
  it('should use custom load path', () => {
    // Create test config data
    const testConfig = {
      servers: [
        { name: 'custom-server', command: 'custom-cmd' }
      ]
    };
    
    // Write to custom path
    fs.writeFileSync(CUSTOM_CONFIG_PATH, JSON.stringify(testConfig, null, 2));
    
    // Mock console.log
    const originalLog = console.log;
    let output = '';
    console.log = (message) => {
      output += message + '\n';
    };
    
    // Call the config command with custom load path
    config({ load: CUSTOM_CONFIG_PATH });
    
    // Restore console.log
    console.log = originalLog;
    
    // Read the config to verify it loaded from custom path
    const loadedConfig = configModule.readConfig();
    
    // Check if the config was loaded correctly
    assert.deepStrictEqual(loadedConfig, testConfig);
    assert.ok(output.includes('loading configuration from'));
  });
  
  it('should use custom save path', () => {
    // Create test config
    const testConfig = {
      servers: [
        { name: 'default-server', command: 'default-cmd' }
      ]
    };
    
    // Write to default path
    fs.writeFileSync(DEFAULT_CONFIG_PATH, JSON.stringify(testConfig, null, 2));
    
    // Set custom load path back to null
    configModule.setCustomLoadPath(null);
    
    // Mock console.log
    const originalLog = console.log;
    let output = '';
    console.log = (message) => {
      output += message + '\n';
    };
    
    // Call the config command with custom save path
    config({ save: CUSTOM_CONFIG_PATH });
    
    // Restore console.log
    console.log = originalLog;
    
    // Verify the file was saved to the custom location
    assert.ok(fs.existsSync(CUSTOM_CONFIG_PATH));
    
    // Read the saved config
    const savedConfig = JSON.parse(fs.readFileSync(CUSTOM_CONFIG_PATH, 'utf8'));
    
    // Check if the config was saved correctly
    assert.deepStrictEqual(savedConfig, testConfig);
    assert.ok(output.includes('saving configuration to'));
  });
});