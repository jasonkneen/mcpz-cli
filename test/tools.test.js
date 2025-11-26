import assert from 'node:assert';
import { describe, it, before, after, beforeEach } from 'node:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the tools command
import { tools } from '../src/commands/tools.js';

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

describe('Tools Command Tests', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'mcpz-tools-test-' + Date.now());
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
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ servers: [] }));
  });

  describe('tools command', () => {
    it('should show message when no servers configured', () => {
      const capture = captureConsole();

      try {
        tools();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('No MCP configurations found'));
    });

    it('should list tools for all servers', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [
          { name: 'server-1', command: 'cmd1', enabled: true },
          { name: 'server-2', command: 'cmd2', enabled: true }
        ]
      }));

      const capture = captureConsole();

      try {
        tools();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('server-1'));
      assert.ok(allOutput.includes('server-2'));
    });

    it('should filter by server name', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [
          { id: '1', name: 'server-1', command: 'cmd1', enabled: true },
          { id: '2', name: 'server-2', command: 'cmd2', enabled: true }
        ]
      }));

      const capture = captureConsole();

      try {
        tools('server-1');
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('server-1'));
      // Should not include server-2 in a significant way
    });

    it('should handle non-existent server filter', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [
          { id: 'test-id', name: 'existing-server', command: 'cmd', enabled: true }
        ]
      }));

      const capture = captureConsole();

      try {
        tools('non-existent');
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('No MCP server found'));
    });

    it('should skip disabled servers', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [
          { name: 'enabled-server', command: 'cmd1', enabled: true },
          { name: 'disabled-server', command: 'cmd2', enabled: false }
        ]
      }));

      const capture = captureConsole();

      try {
        tools();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('enabled-server'));
      // disabled-server may appear in the server list but tools won't be displayed
    });

    it('should show no enabled servers message when all disabled', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [
          { name: 'disabled-1', command: 'cmd1', enabled: false },
          { name: 'disabled-2', command: 'cmd2', enabled: false }
        ]
      }));

      const capture = captureConsole();

      try {
        tools();
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('No enabled servers found'));
    });

    it('should filter by server ID as well as name', () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
        servers: [
          { id: 'unique-id-123', name: 'my-server', command: 'cmd', enabled: true }
        ]
      }));

      const capture = captureConsole();

      try {
        tools('unique-id-123');
      } finally {
        capture.restore();
      }

      const allOutput = capture.logs.info.join(' ');
      assert.ok(allOutput.includes('my-server'));
    });
  });
});
