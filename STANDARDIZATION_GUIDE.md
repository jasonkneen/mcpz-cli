# CLI Standardization Implementation Guide

**Purpose:** Define patterns that should be adopted across all commands, utilities, and future plugins/skills

**Timeline:** Complete before plugin system implementation

---

## 1. Error Handling Standard

### Pattern Definition

All commands should follow this structure:

```javascript
import { validateRequired, validateNonEmpty } from '../utils/validators.js';
import { format } from '../utils/formatter.js';
import { getServerByName } from '../utils/config.js';

/**
 * Description of what command does
 * @param {string} name - Name of the thing
 * @param {Object} options - Command options
 * @returns {void}
 */
export function commandName(name, options) {
  try {
    // 1. Validate inputs
    validateRequired(name, 'Name');
    validateRequired(options.command, 'Command');

    // 2. Check state (server exists, etc.)
    const existing = getServerByName(name);

    // 3. Perform action
    const result = someAction(name, options);

    // 4. Report success
    format.success(`Successfully completed action for "${name}"`);

  } catch (error) {
    // Errors automatically logged to stderr via format.error
    format.error(error.message);
  }
}
```

### Implementation Files to Create

**File:** `/src/utils/validators.js`

```javascript
/**
 * Validation utilities for command inputs
 */

/**
 * Validates that a value is not empty
 * @param {*} value - Value to check
 * @param {string} fieldName - Field name for error message
 * @throws {Error} If value is empty
 */
export function validateRequired(value, fieldName) {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }
}

/**
 * Validates that a string is not empty
 * @param {string} value - String to check
 * @param {string} fieldName - Field name for error message
 * @throws {Error} If string is empty
 */
export function validateNonEmpty(value, fieldName) {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} cannot be empty`);
  }
}

/**
 * Validates that value is an array with minimum length
 * @param {*} value - Array to check
 * @param {string} fieldName - Field name for error message
 * @param {number} minLength - Minimum required length
 * @throws {Error} If not array or too short
 */
export function validateArray(value, fieldName, minLength = 1) {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new Error(`${fieldName} must have at least ${minLength} item(s)`);
  }
}

/**
 * Parses comma-separated values into an array
 * @param {string} str - String to parse
 * @returns {string[]} Array of trimmed values
 */
export function parseCommaSeparated(str) {
  if (!str) return [];
  return str.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Parses comma-separated key=value pairs into an object
 * @param {string} str - String to parse (e.g., "KEY1=val1,KEY2=val2")
 * @returns {Object} Object with keys and values
 */
export function parseKeyValuePairs(str) {
  if (!str) return {};

  const result = {};
  const pairs = str.split(',');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      result[key.trim()] = value.trim();
    }
  }

  return result;
}

/**
 * Validates that a server with given name exists
 * @param {string} serverName - Server name to check
 * @param {Function} lookupFn - Function to lookup server (e.g., getServerByName)
 * @returns {Object} Server object
 * @throws {Error} If server not found
 */
export function validateServerExists(serverName, lookupFn) {
  const server = lookupFn(serverName);
  if (!server) {
    throw new Error(`No MCP configuration found with name "${serverName}"`);
  }
  return server;
}
```

**File:** `/src/utils/formatter.js`

```javascript
import chalk from 'chalk';
import log from './log.js';

/**
 * Centralized output formatting for consistent CLI appearance
 */

export const format = {
  /**
   * Display a section header with visual separator
   * @param {string} title - Section title
   */
  sectionHeader: (title) => {
    console.info(chalk.bold(`\n${title}`));
    console.info(chalk.dim('─'.repeat(Math.min(title.length, 40))));
  },

  /**
   * Display an indented property: value pair
   * @param {string} label - Property label
   * @param {*} value - Property value
   * @param {Object} options - Display options
   */
  item: (label, value, options = {}) => {
    const indent = options.indent || 2;
    const padding = ' '.repeat(indent);
    const displayValue = value === null || value === undefined ? 'none' : value;
    console.info(chalk.dim(`${padding}${label}:`) + ` ${displayValue}`);
  },

  /**
   * Display an error message (always to stderr)
   * @param {string} message - Error message
   */
  error: (message) => {
    log.error(chalk.red(`✖ ${message}`));
  },

  /**
   * Display a success message
   * @param {string} message - Success message
   */
  success: (message) => {
    log.info(chalk.green(`✔ ${message}`));
  },

  /**
   * Display a warning message
   * @param {string} message - Warning message
   */
  warning: (message) => {
    log.warn(chalk.yellow(`⚠ ${message}`));
  },

  /**
   * Display an info message
   * @param {string} message - Info message
   */
  info: (message) => {
    log.info(chalk.blue(`ℹ ${message}`));
  },

  /**
   * Display a list of items
   * @param {string} title - List title
   * @param {string[]} items - Items to display
   * @param {Object} options - Display options
   */
  list: (title, items, options = {}) => {
    const indent = options.indent || 2;
    const padding = ' '.repeat(indent);

    if (!items || items.length === 0) {
      format.warning(options.emptyMessage || 'No items');
      return;
    }

    format.sectionHeader(title);
    items.forEach(item => {
      console.info(`${padding}• ${item}`);
    });
    console.info('');
  },

  /**
   * Display key-value pairs as formatted output
   * @param {Object} data - Key-value pairs to display
   * @param {Object} options - Display options
   */
  properties: (data, options = {}) => {
    const indent = options.indent || 2;
    const padding = ' '.repeat(indent);

    if (options.title) {
      format.sectionHeader(options.title);
    }

    Object.entries(data).forEach(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.join(', ') : value;
      console.info(chalk.dim(`${padding}${key}:`) + ` ${displayValue || 'none'}`);
    });
  },

  /**
   * Display a table-like structure
   * @param {Object[]} rows - Rows to display
   * @param {string[]} columns - Column names
   * @param {Object} options - Display options
   */
  table: (rows, columns, options = {}) => {
    if (!rows || rows.length === 0) {
      format.warning(options.emptyMessage || 'No data');
      return;
    }

    // Simple table rendering without external dependencies
    const indent = options.indent || 2;
    const padding = ' '.repeat(indent);

    if (options.title) {
      format.sectionHeader(options.title);
    }

    // Calculate column widths
    const widths = {};
    columns.forEach(col => {
      widths[col] = Math.max(
        col.length,
        Math.max(...rows.map(r => String(r[col] || '').length))
      );
    });

    // Header
    const header = columns.map(col => col.padEnd(widths[col])).join(' │ ');
    console.info(chalk.bold(`${padding}${header}`));
    console.info(chalk.dim(`${padding}${'─'.repeat(header.length)}`));

    // Rows
    rows.forEach(row => {
      const rowStr = columns.map(col => String(row[col] || '').padEnd(widths[col])).join(' │ ');
      console.info(`${padding}${rowStr}`);
    });
    console.info('');
  }
};

export default format;
```

---

## 2. Command Implementation Template

### Before (Current Pattern - Inconsistent)

```javascript
import chalk from 'chalk';
import { addServer, getServerByName } from '../utils/config.js';

export function add(name, options) {
  if (!name) {
    console.info(chalk.red('Error: Name is required'));
    return;
  }

  if (!options.command) {
    console.info(chalk.red('Error: Command is required'));
    return;
  }

  const existingServer = getServerByName(name);
  if (existingServer) {
    console.info(chalk.yellow(`Server with name "${name}" already exists. Updating...`));
  }

  const server = {
    id: existingServer?.id || uuidv4(),
    name,
    command: options.command,
    args: options.args ? parseCommaSeparatedValues(options.args) : [],
    env: options.env ? parseKeyValuePairs(options.env) : {},
    enabled: true,
    type: 'process'
  };

  if (addServer(server)) {
    console.info(chalk.green(`Successfully ${existingServer ? 'updated' : 'added'} MCP configuration: ${name}`));
  } else {
    console.info(chalk.red(`Failed to ${existingServer ? 'update' : 'add'} MCP configuration`));
  }
}
```

### After (Standardized Pattern)

```javascript
import { v4 as uuidv4 } from 'uuid';
import { validateRequired, parseCommaSeparated, parseKeyValuePairs } from '../utils/validators.js';
import { format } from '../utils/formatter.js';
import { addServer, getServerByName } from '../utils/config.js';

/**
 * Add a new MCP configuration
 * @param {string} name - Name of the MCP server
 * @param {Object} options - Command options
 * @param {string} options.command - Command to run the server
 * @param {string} [options.args] - Comma-separated arguments
 * @param {string} [options.env] - Comma-separated key=value environment variables
 */
export function add(name, options) {
  try {
    // 1. Validate inputs
    validateRequired(name, 'Server name');
    validateRequired(options.command, 'Command');

    // 2. Check for existing server
    const existingServer = getServerByName(name);
    if (existingServer) {
      format.warning(`Server "${name}" already exists. Updating configuration...`);
    }

    // 3. Parse and prepare server object
    const args = parseCommaSeparated(options.args);
    const env = parseKeyValuePairs(options.env);

    const server = {
      id: existingServer?.id || uuidv4(),
      name,
      command: options.command,
      args,
      env,
      enabled: true,
      type: 'process'
    };

    // 4. Save configuration
    if (!addServer(server)) {
      throw new Error(`Failed to save MCP configuration`);
    }

    // 5. Report success
    format.success(
      `${existingServer ? 'Updated' : 'Added'} MCP configuration: "${name}"`
    );

  } catch (error) {
    format.error(error.message);
  }
}
```

### Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Error reporting | `console.info(chalk.red(...))` | `format.error()` |
| Success reporting | `console.info(chalk.green(...))` | `format.success()` |
| Warnings | `console.info(chalk.yellow(...))` | `format.warning()` |
| Validation | Manual `if (!name)` checks | `validateRequired()` |
| Parsing | Inline functions | Shared `parseCommaSeparated()` |
| Error handling | Early returns, no context | Try/catch with meaningful errors |
| Readability | Comments explaining logic | Method names explain intent |

---

## 3. Test Infrastructure Standard

### Create Shared Test Helpers

**File:** `/test/helpers.js`

```javascript
/**
 * Shared test utilities
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Creates an isolated temporary directory for tests
 * @returns {Object} Object with dir path and cleanup function
 */
export function createTestDir(prefix = 'mcpz-test-') {
  const testDir = path.join(os.tmpdir(), prefix + Date.now() + '-' + Math.random().toString(36).substring(2, 7));
  fs.mkdirSync(testDir, { recursive: true });

  return {
    dir: testDir,
    cleanup: () => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    }
  };
}

/**
 * Captures console output for testing
 * @returns {Object} Object with captured logs and restore function
 */
export function captureConsole() {
  const captured = { log: [], error: [], info: [], warn: [] };
  const original = {
    log: console.log,
    error: console.error,
    info: console.info,
    warn: console.warn
  };

  console.log = (...args) => captured.log.push(args.join(' '));
  console.error = (...args) => captured.error.push(args.join(' '));
  console.info = (...args) => captured.info.push(args.join(' '));
  console.warn = (...args) => captured.warn.push(args.join(' '));

  return {
    logs: captured,
    restore: () => {
      console.log = original.log;
      console.error = original.error;
      console.info = original.info;
      console.warn = original.warn;
    }
  };
}

/**
 * Assert that a message appears in captured output
 * @param {Object} captured - Captured logs from captureConsole
 * @param {string} message - Message to search for
 * @param {string} [level] - Log level to search (all if not specified)
 * @returns {boolean} Whether message was found
 */
export function findInOutput(captured, message, level) {
  if (level) {
    return captured[level]?.some(log => log.includes(message)) || false;
  }

  return Object.values(captured).some(
    logs => Array.isArray(logs) && logs.some(log => log.includes(message))
  );
}

/**
 * Create a test configuration file
 * @param {string} configPath - Path to config file
 * @param {Object} data - Configuration data
 */
export function createTestConfig(configPath, data = {}) {
  const defaultConfig = {
    servers: [],
    groups: {}
  };

  const config = { ...defaultConfig, ...data };
  const dir = path.dirname(configPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
```

### Test File Template

**File:** `/test/commands/add.test.js`

```javascript
import assert from 'node:assert';
import { describe, it, before, after, beforeEach } from 'node:test';
import fs from 'fs';
import path from 'path';

import { add } from '../../src/commands/add.js';
import * as configModule from '../../src/utils/config.js';
import { createTestDir, captureConsole, createTestConfig, findInOutput } from '../helpers.js';

describe('add command', () => {
  let testContext;

  before(() => {
    testContext = createTestDir('mcpz-add-test-');
    const configPath = path.join(testContext.dir, '.mcpz', 'config.json');

    configModule.CONFIG.DIR = path.dirname(configPath);
    configModule.CONFIG.PATH = configPath;
  });

  after(() => {
    testContext.cleanup();
  });

  beforeEach(() => {
    createTestConfig(configModule.CONFIG.PATH);
  });

  it('should add a new server configuration', () => {
    const capture = captureConsole();

    try {
      add('test-server', { command: 'test-cmd', args: 'arg1,arg2', env: 'KEY=value' });
    } finally {
      capture.restore();
    }

    const config = configModule.readConfig();
    assert.strictEqual(config.servers.length, 1);
    assert.strictEqual(config.servers[0].name, 'test-server');
    assert(findInOutput(capture.logs, 'test-server'), 'Success message should contain server name');
  });

  it('should require a server name', () => {
    const capture = captureConsole();

    try {
      add(null, { command: 'cmd' });
    } finally {
      capture.restore();
    }

    assert(findInOutput(capture.logs, 'required'), 'Should show required error');
  });

  it('should update existing server with same name', () => {
    const capture1 = captureConsole();
    try {
      add('update-server', { command: 'old-cmd' });
    } finally {
      capture1.restore();
    }

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
});
```

---

## 4. Implementation Checklist

### Phase 1: Create Infrastructure (2-3 days)

- [ ] Create `/src/utils/validators.js`
- [ ] Create `/src/utils/formatter.js`
- [ ] Create `/test/helpers.js`
- [ ] Update `removeCommand` (already uses `log`) as reference implementation
- [ ] Document patterns in this file

### Phase 2: Refactor Commands (3-4 days)

- [ ] `add.js` - Replace with standardized pattern
- [ ] `list.js` - Use formatter for all output
- [ ] `remove.js` - Replace console with formatter
- [ ] `use.js` - Add proper error handling, remove empty log conditionals
- [ ] `groups.js` - Use validator functions and formatter
- [ ] `tools.js` - Use formatter for output
- [ ] `help.js` - Use formatter for layout
- [ ] `config.js` - Use formatter for display
- [ ] `update.js` - Already has try/catch, update to use formatter

### Phase 3: Update Tests (2-3 days)

- [ ] Extract shared test helpers to `/test/helpers.js`
- [ ] Update existing tests to use helpers
- [ ] Add tests for `use.js` (critical gap)
- [ ] Add tests for `update.js`
- [ ] Add tests for validators module

### Phase 4: Add Missing Tests (3-4 days)

- [ ] Interactive mode unit tests (component-focused)
- [ ] Server process integration tests
- [ ] End-to-end command tests

---

## 5. Breaking Down Dependencies

### Current Circular Reference Risk

```
interactive.js
  ↓ spawns
index.js (which imports interactive.js)
```

### Solution

Create `/src/server/interactive-entry.js` that dynamically imports interactive mode only when needed:

```javascript
/**
 * Separate entry point for interactive mode
 * Breaks potential circular dependency with index.js
 */

export async function startInteractiveMode() {
  const { interactive } = await import('../commands/interactive.js');
  await interactive();
}
```

Then in `index.js`:

```javascript
program
  .command('interactive')
  .alias('i')
  .description('Start mcpz in interactive mode')
  .action(() => {
    import('./server/interactive-entry.js')
      .then(module => module.startInteractiveMode())
      .catch(error => {
        console.error(chalk.red(`Error: ${error.message}`));
      });
  });
```

---

## 6. Configuration Management Pattern

### Define Single Source of Truth

Create `/src/utils/configManager.js`:

```javascript
/**
 * Centralized configuration management
 * All config read/write goes through this
 */

import * as configModule from './config.js';

export const configManager = {
  /**
   * Read entire configuration
   */
  read() {
    return configModule.readConfig();
  },

  /**
   * Read servers only
   */
  getServers() {
    const config = this.read();
    return config.servers || [];
  },

  /**
   * Read groups only
   */
  getGroups() {
    return configModule.getGroups();
  },

  /**
   * Find server by name or ID
   */
  findServer(nameOrId) {
    const servers = this.getServers();
    return servers.find(s =>
      s.name === nameOrId || s.id === nameOrId
    );
  },

  /**
   * Add or update server
   */
  upsertServer(server) {
    if (!server.name) {
      throw new Error('Server must have a name');
    }
    return configModule.addServer(server);
  },

  /**
   * Remove server by name
   */
  removeServer(name) {
    return configModule.removeServer(name);
  }
};

export default configManager;
```

---

## 7. Plugin/Skill API Preparation

### Define Public API

Create `/src/api/pluginApi.js`:

```javascript
/**
 * Public API for plugins and skills
 * Only expose what plugins need
 */

import configManager from '../utils/configManager.js';
import { format } from '../utils/formatter.js';
import { InstanceManager } from '../utils/instanceManager.js';

export const pluginApi = {
  // Configuration access
  config: {
    getServers: () => configManager.getServers(),
    getGroups: () => configManager.getGroups(),
    findServer: (name) => configManager.findServer(name),
    setCustomLoadPath: (path) => {
      // Implementation
    },
    setCustomSavePath: (path) => {
      // Implementation
    }
  },

  // Output formatting (standardized)
  format: format,

  // Instance management
  instances: {
    getAll: () => InstanceManager.getInstance().getAllInstances(),
    getByServer: (name) => InstanceManager.getInstance().getInstancesByServer(name),
    kill: (id) => InstanceManager.getInstance().killInstance(id),
    register: (...args) => InstanceManager.getInstance().registerInstance(...args)
  },

  // Version info
  getVersion: () => {
    // Return CLI version
  }
};

export default pluginApi;
```

---

## 8. Migration Path for Existing Tests

### Update commands.test.js

```javascript
// Replace top of file
import assert from 'node:assert';
import { describe, it, before, after, beforeEach } from 'node:test';
import fs from 'fs';
import path from 'path';

import { add } from '../src/commands/add.js';
import { remove } from '../src/commands/remove.js';
import { list } from '../src/commands/list.js';
import * as configModule from '../src/utils/config.js';
import { createTestDir, captureConsole, createTestConfig, findInOutput } from './helpers.js';  // ← New helper

// Then update each test to use helpers instead of inline captureConsole
describe('Command Tests', () => {
  let testContext;

  before(() => {
    testContext = createTestDir('mcpz-cmd-test-');
    const configPath = path.join(testContext.dir, '.mcpz', 'config.json');

    configModule.CONFIG.DIR = path.dirname(configPath);
    configModule.CONFIG.PATH = configPath;
  });

  after(() => {
    testContext.cleanup();
  });

  beforeEach(() => {
    createTestConfig(configModule.CONFIG.PATH);
  });

  // ... rest of tests using new helpers
});
```

---

## Success Metrics

After implementing this standardization:

1. **Code duplication** drops from 35% to <15%
2. **Error handling consistency** reaches 95%+
3. **Output formatting consistency** reaches 100%
4. **Test coverage** improves from 57% to 75%+
5. **Plugin API** clearly defined and documented
6. **New contributors** can reference command templates

---

## Timeline Estimate

- **Phase 1 (Infrastructure):** 2-3 days (can be done in parallel)
- **Phase 2 (Refactor):** 3-4 days (sequential)
- **Phase 3 (Tests):** 2-3 days (concurrent with Phase 2)
- **Phase 4 (Missing Tests):** 3-4 days (optional, post-refactor)

**Total:** 10-14 days for complete standardization
**Critical path:** Phases 1-2 (5-7 days) before plugin system

---

## Next Steps

1. Create the three new utility files (validators.js, formatter.js, configManager.js)
2. Update one command as proof-of-concept (recommend `add.js`)
3. Get feedback on patterns
4. Roll out to remaining commands
5. Extract test helpers
6. Add plugin API surface

