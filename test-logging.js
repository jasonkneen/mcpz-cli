#!/usr/bin/env node

import { log } from './src/utils/log.js';
import { isLogging } from './src/utils/config.js';
import chalk from 'chalk';

/**
 * Test script to validate the fixed logging behavior
 */
function runTests() {
  console.log('=== CLI LOGGING TEST SCRIPT ===');
  
  // Test 1: Basic logging
  console.log('\nTest 1: Basic logging');
  log.info('This is an info message (stdout, only shown in logging mode)');
  log.warn('This is a warning message (stderr, only shown in logging mode)');
  log.error('This is an error message (stderr, always shown)');
  log.debug('This is a debug message (stderr, only shown in logging mode)');
  
  // Test 2: TTY detection
  console.log('\nTest 2: TTY detection');
  console.log(`Is TTY: ${process.stdout.isTTY ? 'Yes' : 'No'}`);
  console.log(`Is Logging Enabled: ${isLogging() ? 'Yes' : 'No'}`);
  
  // Test 3: Structured output
  console.log('\nTest 3: Structured output');
  log.structured({
    action: 'test',
    timestamp: new Date().toISOString(),
    data: {
      test: 'value',
      number: 123
    }
  });
  
  // Test 4: Environment-aware behavior
  console.log('\nTest 4: Environment-aware behavior');
  console.log('In TTY mode: more verbose output');
  console.log('In Piped mode: only important output unless debug is enabled');
  console.log('Try running: node test-logging.js | cat');
  console.log('And: DEBUG=true node test-logging.js | cat');
  
  // Test 5: Color output (only visible in TTY mode)
  console.log('\nTest 5: Color output (TTY only)');
  console.log(chalk.green('This text should be green in TTY mode'));
  console.log(chalk.red('This text should be red in TTY mode'));
  console.log(chalk.blue('This text should be blue in TTY mode'));
  
  // Test 6: Log system debug
  console.log('\nTest 6: Log system debug');
  log.debugLogSystem();
  
  console.log('\n=== TEST COMPLETE ===');
}

// Run all tests
runTests();

console.log('\nFull Implementation Overview:');
console.log('1. Error logs always go to stderr, regardless of logging mode');
console.log('2. Regular output goes to stdout for clean piping');
console.log('3. Environment-aware behavior adjusts based on context');
console.log('4. Structured output format depends on TTY vs piped mode');
console.log('5. Consistent log usage across all files');