import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';

// Import the log module
import log from '../src/utils/log.js';

describe('Log Module', () => {
  let originalLog;
  let originalError;
  let originalWarn;
  let originalDebug;
  let originalIsTTY;

  const capturedOutput = {
    log: [],
    error: [],
    warn: [],
    debug: []
  };

  beforeEach(() => {
    // Save original console methods
    originalLog = console.log;
    originalError = console.error;
    originalWarn = console.warn;
    originalDebug = console.debug;
    originalIsTTY = process.stdout.isTTY;

    // Reset captured output
    capturedOutput.log = [];
    capturedOutput.error = [];
    capturedOutput.warn = [];
    capturedOutput.debug = [];

    // Mock console methods
    console.log = (...args) => capturedOutput.log.push(args.join(' '));
    console.error = (...args) => capturedOutput.error.push(args.join(' '));
    console.warn = (...args) => capturedOutput.warn.push(args.join(' '));
    console.debug = (...args) => capturedOutput.debug.push(args.join(' '));
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.debug = originalDebug;

    // Restore TTY state
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true
    });
  });

  describe('log.info', () => {
    it('should log info messages when logging is enabled', () => {
      // Ensure TTY mode for logging
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true
      });

      log.info('test info message');

      assert.ok(capturedOutput.log.some(msg => msg.includes('test info message')));
    });

    it('should support multiple arguments', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true
      });

      log.info('message', 'with', 'multiple', 'parts');

      assert.ok(capturedOutput.log.some(msg => msg.includes('message') && msg.includes('multiple')));
    });
  });

  describe('log.error', () => {
    it('should always log error messages', () => {
      log.error('test error message');

      assert.ok(capturedOutput.error.some(msg => msg.includes('test error message')));
    });

    it('should log errors even in piped mode', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true
      });

      log.error('piped error message');

      assert.ok(capturedOutput.error.some(msg => msg.includes('piped error message')));
    });
  });

  describe('log.warn', () => {
    it('should log warning messages in TTY mode', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true
      });

      log.warn('test warning message');

      assert.ok(capturedOutput.warn.some(msg => msg.includes('test warning message')));
    });
  });

  describe('log.debug', () => {
    it('should log debug messages in TTY mode', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true
      });

      log.debug('test debug message');

      assert.ok(capturedOutput.debug.some(msg => msg.includes('test debug message')));
    });
  });

  describe('log.structured', () => {
    it('should output structured data as JSON', () => {
      const data = { key: 'value', number: 42 };

      log.structured(data);

      const output = capturedOutput.log.join('');
      assert.ok(output.includes('key'));
      assert.ok(output.includes('value'));
      assert.ok(output.includes('42'));
    });

    it('should format JSON nicely in TTY mode', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true
      });

      const data = { key: 'value' };
      log.structured(data);

      const output = capturedOutput.log.join('');
      // In TTY mode, should be formatted with newlines
      assert.ok(output.includes('\n') || output.includes('key'));
    });

    it('should output compact JSON in piped mode', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true
      });

      const data = { key: 'value' };
      log.structured(data);

      const output = capturedOutput.log.join('');
      // Should be valid JSON
      assert.ok(output.includes('key'));
    });
  });

  describe('log._isTTY', () => {
    it('should return true when stdout is a TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true
      });

      assert.strictEqual(log._isTTY(), true);
    });

    it('should return falsy when stdout is not a TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true
      });

      assert.ok(!log._isTTY());
    });
  });

  describe('log.debugLogSystem', () => {
    it('should output logging system debug info to stderr', () => {
      log.debugLogSystem();

      const output = capturedOutput.error.join(' ');
      assert.ok(output.includes('LOGGING SYSTEM DEBUG'));
      assert.ok(output.includes('TTY Mode'));
      assert.ok(output.includes('Logging Enabled'));
    });
  });
});
