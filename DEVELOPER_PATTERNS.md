# Quick Reference: Code Patterns for CLI Developers

**Use this guide when writing new commands, utilities, or updating existing code.**

---

## Error Handling

### DO: Use structured error handling

```javascript
import { validateRequired } from '../utils/validators.js';
import { format } from '../utils/formatter.js';

export function myCommand(name, options) {
  try {
    validateRequired(name, 'Name');
    validateRequired(options.value, 'Value');

    // ... command logic ...

    format.success('Command completed successfully');
  } catch (error) {
    format.error(error.message);
  }
}
```

### DON'T: Mix error output methods

```javascript
// ❌ BAD: Inconsistent output
if (!name) {
  console.info(chalk.red('Error: Name is required'));
  return;
}

if (!options.value) {
  log.error('Value is required');
  return;
}

console.info('Success');
```

---

## Output Formatting

### DO: Use centralized formatter

```javascript
import { format } from '../utils/formatter.js';

// Section headers
format.sectionHeader('My Servers');

// Item display
format.item('Name', 'my-server');
format.item('Command', 'node server.js');

// Messages
format.success('Server added successfully');
format.error('Server not found');
format.warning('This will override existing config');
format.info('Processing, please wait...');

// Lists
format.list('Available Servers', servers.map(s => s.name));

// Tables
format.table(servers, ['name', 'command', 'enabled']);
```

### DON'T: Use chalk directly in commands

```javascript
// ❌ BAD
console.info(chalk.green('Success'));
console.info(chalk.red(`Error: ${message}`));

// ❌ BAD: Inconsistent colors
console.log(chalk.blue('Info'));
console.info(chalk.cyan('Info'));
console.info('Plain text');
```

---

## Input Validation

### DO: Use validators

```javascript
import {
  validateRequired,
  validateNonEmpty,
  parseCommaSeparated,
  parseKeyValuePairs
} from '../utils/validators.js';

export function myCommand(name, options) {
  try {
    // Simple required check
    validateRequired(name, 'Server name');

    // Check for non-empty string
    validateNonEmpty(options.command, 'Command');

    // Parse comma-separated values
    const args = parseCommaSeparated(options.args);
    const env = parseKeyValuePairs(options.env);

    // Now use validated inputs
  } catch (error) {
    format.error(error.message);
  }
}
```

### DON'T: Validate inline

```javascript
// ❌ BAD: Duplicated validation
if (!name) {
  console.info(chalk.red('Error: Name is required'));
  return;
}

if (!options.command) {
  console.info(chalk.red('Error: Command is required'));
  return;
}

// ❌ BAD: Manual parsing
const args = options.args
  ? options.args.split(',').map(a => a.trim())
  : [];
```

---

## Configuration Access

### DO: Use configManager

```javascript
import configManager from '../utils/configManager.js';

// Read servers
const servers = configManager.getServers();

// Find a server
const server = configManager.findServer('my-server');

// Get groups
const groups = configManager.getGroups();

// Add or update server
try {
  configManager.upsertServer({
    id: uuid(),
    name: 'new-server',
    command: 'node server.js'
  });
} catch (error) {
  format.error(error.message);
}
```

### DON'T: Import config directly in commands

```javascript
// ❌ BAD: Direct config access
import { readConfig, addServer } from '../utils/config.js';

export function myCommand(name, options) {
  const config = readConfig();
  const servers = config.servers;
  // ...
}
```

---

## Testing Commands

### DO: Use test helpers and templates

```javascript
import assert from 'node:assert';
import { describe, it, before, after, beforeEach } from 'node:test';
import { myCommand } from '../src/commands/myCommand.js';
import { createTestDir, captureConsole, createTestConfig, findInOutput } from './helpers.js';
import * as configModule from '../src/utils/config.js';

describe('myCommand', () => {
  let testContext;

  before(() => {
    testContext = createTestDir('test-prefix-');
    configModule.CONFIG.DIR = testContext.dir;
    configModule.CONFIG.PATH = `${testContext.dir}/config.json`;
  });

  after(() => {
    testContext.cleanup();
  });

  beforeEach(() => {
    createTestConfig(configModule.CONFIG.PATH);
  });

  it('should handle valid input', () => {
    const capture = captureConsole();

    try {
      myCommand('test', { value: 'test-value' });
    } finally {
      capture.restore();
    }

    assert(findInOutput(capture.logs, 'success'), 'Should show success message');
  });

  it('should validate required fields', () => {
    const capture = captureConsole();

    try {
      myCommand(null, {}); // Missing name
    } finally {
      capture.restore();
    }

    assert(findInOutput(capture.logs, 'required'), 'Should show validation error');
  });
});
```

### DON'T: Use inline test utilities

```javascript
// ❌ BAD: Duplicated utilities
function captureConsole() {
  const logs = { /* ... */ };
  // ... repeated in multiple test files
}

describe('myCommand', () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ servers: [] }));
    // ... repeated test setup
  });
});
```

---

## Command Structure Template

```javascript
/**
 * /src/commands/myCommand.js
 * Description of what this command does
 */

import {
  validateRequired,
  validateNonEmpty,
  parseCommaSeparated
} from '../utils/validators.js';
import { format } from '../utils/formatter.js';
import configManager from '../utils/configManager.js';

/**
 * Do something with the CLI
 * @param {string} name - Name of the thing
 * @param {Object} options - Command options
 * @param {string} options.value - Value option
 * @throws {Error} Never throws, handles errors internally
 */
export function myCommand(name, options) {
  try {
    // 1. Validate inputs
    validateRequired(name, 'Name');
    validateRequired(options.value, 'Value');

    // 2. Get data (if needed)
    const servers = configManager.getServers();
    const server = configManager.findServer(name);

    // 3. Perform action
    const result = performAction(name, options);

    // 4. Report success
    format.success(`Successfully completed action for "${name}"`);

  } catch (error) {
    // Errors are automatically logged to stderr
    format.error(error.message);
  }
}

// Export both named and default
export default myCommand;
```

---

## Process Handling

### DO: Proper error handling for spawned processes

```javascript
import { spawn } from 'child_process';
import { format } from '../utils/formatter.js';

export function runServer(name, server) {
  try {
    const process = spawn(server.command, server.args || [], {
      env: { ...process.env, ...(server.env || {}) },
      stdio: 'inherit'
    });

    // Handle errors
    process.on('error', (error) => {
      format.error(`Failed to start "${name}": ${error.message}`);
    });

    // Handle exit
    process.on('exit', (code) => {
      if (code !== 0) {
        format.warning(`Server "${name}" exited with code ${code}`);
      }
    });

    // Handle SIGINT gracefully
    process.on('SIGINT', () => {
      format.info(`Shutting down "${name}"...`);
      process.kill();
    });

  } catch (error) {
    format.error(`Error starting server: ${error.message}`);
  }
}
```

### DON'T: Incomplete error handling

```javascript
// ❌ BAD: Missing context
process.on('error', (error) => {
  console.error(error.message);  // Which server? When?
});

// ❌ BAD: Silent failures
process.on('exit', (code) => {
  if (code !== 0) {
    // No error message
  }
});
```

---

## Async Patterns

### DO: Await promises or handle with callbacks

```javascript
// Option 1: Use async/await
export async function runUpdate(options) {
  try {
    const result = await checkForUpdates();
    format.success(`Update available: ${result.version}`);
  } catch (error) {
    format.error(`Update check failed: ${error.message}`);
  }
}

// Option 2: Proper promise handling
export function updateInBackground() {
  checkForUpdates()
    .then(result => {
      format.success(`Update available: ${result.version}`);
    })
    .catch(error => {
      format.error(`Update check failed: ${error.message}`);
    });
}
```

### DON'T: Fire-and-forget promises

```javascript
// ❌ BAD: Promise not awaited, error not handled
getResourceUsage(pid).then(usage => {
  instance.resourceUsage = usage;
  saveInstance(instance);
  // What if this throws?
});

// ❌ BAD: Promise in loop creates queue
for (const instance of instances) {
  updateInstance(instance);  // Fire and forget!
}
```

---

## Logging

### DO: Use the log module

```javascript
import log from '../utils/log.js';

// Error (always shown)
log.error('Something went wrong');

// Info (shown in TTY or when --debug is set)
log.info('Processing...');

// Warning (shown in TTY or when --debug is set)
log.warn('This might override existing data');

// Debug (shown only when --debug is set)
log.debug('Detailed diagnostic info');

// Structured data (JSON output)
log.structured({ servers: 5, running: 2 });
```

### DON'T: Use console directly for logging

```javascript
// ❌ BAD: Direct console
console.log('Info message');
console.error('Error message');

// ❌ BAD: Inconsistent with TTY checking
if (isLogging()) {
  // This is confusing - what should happen?
}
```

---

## Configuration Structure

### DO: Follow this pattern

```javascript
// Config is always stored as JSON at ~/.mcpz/config.json
{
  "servers": [
    {
      "id": "uuid-here",
      "name": "my-server",
      "command": "node server.js",
      "args": ["--port", "3000"],
      "env": { "NODE_ENV": "production" },
      "enabled": true,
      "type": "process"
    }
  ],
  "groups": {
    "python-stack": ["python-server", "pytorch-server"],
    "ml-tools": ["predict-tool", "generate-tool"]
  }
}
```

### DON'T: Create new config patterns

```javascript
// ❌ BAD: Multiple config files
~/.mcpz/config.json
~/.mcpz/servers.json
~/.mcpz/plugins.json

// ❌ BAD: Different structure
{
  "mycmd": {
    "args": []
  }
}
```

---

## File Organization

### DO: Organize by feature

```
src/
  commands/
    add.js       ← Commands that modify config
    remove.js
    list.js
    use.js
    groups.js
    config.js
    tools.js
    help.js
    update.js
    interactive.js
  utils/
    config.js         ← Core functionality
    log.js
    validators.js     ← New standardized utilities
    formatter.js
    configManager.js  ← New abstraction layer
    instanceManager.js
    updateChecker.js
  server.js          ← Server entry point
  index.js           ← CLI entry point
```

### DON'T: Create scattered files

```javascript
// ❌ BAD: Mixing concerns
src/
  utilities/
    validation.js
    formatting.js
    errors.js
    output.js
    config/
      loader.js
      saver.js
      manager.js
```

---

## Common Tasks Checklist

### Adding a new command

- [ ] Create `/src/commands/mycommand.js`
- [ ] Use standardized template from DEVELOPER_PATTERNS.md
- [ ] Import only: validators, formatter, configManager
- [ ] Add to `/src/index.js` command registration
- [ ] Create test file `/test/commands/mycommand.test.js`
- [ ] Use test helpers from `/test/helpers.js`
- [ ] Test both success and error cases

### Adding a new utility

- [ ] Create `/src/utils/myutil.js`
- [ ] Document all exported functions with JSDoc
- [ ] Export both named and default if applicable
- [ ] Create test file `/test/utils/myutil.test.js`
- [ ] Avoid importing from commands
- [ ] Keep pure functions when possible

### Updating existing code

- [ ] Replace direct console with formatter
- [ ] Extract validation to validators.js
- [ ] Use configManager for config access
- [ ] Add error handling with try/catch + format.error
- [ ] Update tests to use helpers
- [ ] Don't leave debug code (empty if statements)

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Solution |
|---|---|---|
| `if (isLogging()) { }` | Debug code leftover | Remove the condition or add actual logging |
| Mix of console.* methods | Inconsistent behavior | Use format module |
| Early return on error | Caller doesn't know why | Use try/catch + format.error |
| Direct file I/O in commands | Hard to test | Use configManager |
| Fire-and-forget promises | Memory leaks possible | Await or add error handler |
| Silent failures | Makes debugging hard | Always log errors |
| Manual string parsing | Duplicated code | Use validators module |
| Process spawn without error handling | Unclear failures | Implement error/exit handlers |

---

## Quick Help

**Q: I need to validate a required field**
A: Use `validateRequired(value, 'Field Name')` from validators.js

**Q: I need to show an error to the user**
A: Use `format.error('Your message')` from formatter.js

**Q: I need to read the config**
A: Use `configManager.getServers()` from configManager.js

**Q: I need to parse comma-separated values**
A: Use `parseCommaSeparated(string)` from validators.js

**Q: I need to test my command**
A: Copy template from code-pattern-analysis.md and use helpers from test/helpers.js

**Q: I'm unsure about a pattern**
A: Check STANDARDIZATION_GUIDE.md for examples

---

## Getting Help

1. **For patterns:** See CODE_PATTERN_ANALYSIS.md
2. **For implementation:** See STANDARDIZATION_GUIDE.md
3. **For quick answers:** See this file (DEVELOPER_PATTERNS.md)
4. **For templates:** Check existing commands that follow the standard

**Questions?** Open an issue with pattern questions.

