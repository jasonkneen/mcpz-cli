import { isLogging } from './config.js';

/**
 * Log utility that provides structured logging with proper separation of concerns:
 * - Regular output goes to stdout
 * - Logs and errors go to stderr
 * - Environment-aware behavior adjusts based on TTY vs piped context
 */
export const log = {
  /**
   * Check if we're in a TTY context
   * @private
   * @returns {boolean} Whether the output is connected to a TTY
   */
  _isTTY: () => process.stdout.isTTY,

  /**
   * Log info message (only in logging mode)
   * Sends to stdout for normal user output
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    if (isLogging()) {
      console.log(...args); // Use console.log for stdout
    }
  },

  /**
   * Log error message (always shown)
   * Always sends to stderr regardless of logging mode
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    // Always show errors regardless of logging state
    console.error(...args);
  },

  /**
   * Log warning message (only in logging mode)
   * Sends to stderr for warnings
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (isLogging()) {
      console.warn(...args);
    }
  },

  /**
   * Log debug message (only in logging mode)
   * Sends to stderr for debug information
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isLogging()) {
      console.debug(...args);
    }
  },

  /**
   * Format structured output for machine consumption
   * Use this for data that needs to be machine-readable
   * @param {Object} data - Data to output
   */
  structured: (data) => {
    // For structured data, we always use stdout
    // If in a piped context, we just output the raw JSON
    // If in TTY, we can format it nicely
    if (log._isTTY()) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      // In piped context, output raw JSON without formatting
      console.log(JSON.stringify(data));
    }
  },

  /**
   * Debug the logging system state
   * Useful for diagnosing logging issues
   */
  debugLogSystem: () => {
    const isTTY = process.stdout.isTTY;
    const isLoggingEnabled = isLogging();
    
    console.error('=== LOGGING SYSTEM DEBUG ===');
    console.error(`TTY Mode: ${isTTY ? 'Yes' : 'No'}`);
    console.error(`Logging Enabled: ${isLoggingEnabled ? 'Yes' : 'No'}`);
    console.error('Error messages will always be shown');
    console.error(`Info/Warn/Debug messages ${isLoggingEnabled ? 'will' : 'will not'} be shown`);
    console.error('===========================');
  }
};

export default log;