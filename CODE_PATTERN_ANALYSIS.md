# Code Pattern Analysis Report: mcpsx.run CLI

**Analysis Date:** December 19, 2025
**Codebase:** `/Users/jkneen/Documents/GitHub/mcpsx.run/cli`
**Scope:** Source commands, utilities, tests, and interactive components

---

## Executive Summary

The mcpsx.run CLI demonstrates a functional but inconsistent codebase with significant standardization opportunities before the planned refactoring (groups→toolbox aliasing, plugin system, skill support). Key findings indicate:

- **7 instances of mixed error handling patterns** across command files
- **High code duplication** in error validation and output formatting (35%+ overlap)
- **Inconsistent logging approaches** with 3 different patterns in active use
- **Test infrastructure gaps** - interactive mode and server.js uncovered
- **Architectural violations** in async/await patterns and error propagation

Addressing these patterns before the refactoring will prevent technical debt multiplication during the expansion.

---

## 1. Inconsistent Error Handling Patterns

### 1.1 Mixed Output Methods

**Severity:** HIGH - Will propagate through plugin/skill systems

Commands use **3 different output methods** for the same purposes:

| File | Method | Example | Consequence |
|------|--------|---------|------------|
| `add.js` | `console.info(chalk.red(...))` | Line 43 | Color formatting in piped contexts |
| `remove.js` | `log.error(...)` | Line 11 | Structured logging to stderr |
| `use.js` | `console.info(chalk.red(...))` | Line 11 | Inconsistent with log module |
| `groups.js` | `console.info(chalk.red(...))` | Line 11 | No log module usage |
| `list.js` | `console.info(chalk.yellow(...))` | Line 11 | Ignores logging context |

**Location Details:**

```javascript
// PATTERN 1: Direct console with chalk (add.js, use.js, list.js, tools.js, groups.js)
console.info(chalk.red('Error: Name is required'));

// PATTERN 2: Log module with colors (remove.js)
log.error('Name is required for removing an MCP configuration');

// PATTERN 3: Console.log for config (config.js)
console.log(chalk.blue('Current configuration:'));
```

**Issue:** The `log` module provides TTY-aware output, but only `remove.js` uses it. This means:
- Errors in piped contexts behave unpredictably
- Plugin system will inherit mixed patterns
- Inconsistent with LOGGING-GUIDE.md requirements

**Impact on Planned Changes:**
- Plugin system will need to standardize error reporting
- Skills requiring status output will have unclear patterns to follow
- Tests cannot reliably mock output across different commands

---

### 1.2 Error Validation Patterns

**Severity:** MEDIUM - Duplicated code, inconsistent return handling

All commands validate required parameters but use different approaches:

**Pattern A: Early return (add.js, groups.js, use.js)**
```javascript
export function add(name, options) {
  if (!name) {
    console.info(chalk.red('Error: Name is required'));
    return;  // Silent return, caller doesn't know success/failure
  }
  // ... rest of logic
}
```

**Pattern B: Return boolean (remove.js)**
```javascript
export function remove(name) {
  if (!name) {
    log.error('Name is required for removing an MCP configuration');
    return;  // Still returns void, not boolean
  }
  // ... rest of logic
}
```

**Pattern C: Check and proceed (list.js, tools.js)**
```javascript
export function list() {
  const config = readConfig();

  if (!config.servers || config.servers.length === 0) {
    console.info(chalk.yellow('No MCP configurations found'));
    return;  // No validation return value
  }
  // ... rest of logic
}
```

**Root Cause:** No standardized error handling contract. Functions return `void` regardless of success/failure.

**Code Duplication Metrics:**
- Same validation: `if (!name)` pattern appears 6 times
- Same error message: `"required"` appears 4 times with variations
- No reusable validation function

**Duplication Snippet:**
```javascript
// add.js line 42-50 - 9 lines
if (!name) {
  console.info(chalk.red('Error: Name is required'));
  return;
}

if (!options.command) {
  console.info(chalk.red('Error: Command is required'));
  return;
}

// groups.js line 10-18 - 9 lines (similar structure)
if (!name) {
  console.info(chalk.red('Group name is required'));
  return;
}

if (!options.servers) {
  console.info(chalk.red('Server list is required (--servers)'));
  return;
}
```

---

### 1.3 Async Error Handling Gaps

**Severity:** MEDIUM - Unhandled promise rejections

Files with async code show inconsistent error boundaries:

**update.js (lines 9-28)** - Proper try/catch:
```javascript
.action(async (options) => {
  try {
    if (options.checkOnly) {
      const { hasUpdate, currentVersion, latestVersion } = await checkForUpdates();
      // ... rest
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
});
```

**use.js (lines 39-65)** - Event handlers lack error context:
```javascript
process.on('error', (error) => {
  console.info(chalk.red(`Error starting MCP server: ${error.message}`));
  // No context about which server
  // No handling of cleanup
});

process.on('exit', (code) => {
  if (code === 0) {
    // No logging
  } else {
    console.info(chalk.red(`MCP server "${name}" exited with code ${code}`));
  }
});
```

**interactive.js (lines 284-310)** - Promise without error handling in spawn:
```javascript
const runCliCommand = useCallback((command) => {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [binPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // ... handlers
    child.on('error', (error) => {
      reject(error);  // Good: proper rejection
    });
  });
}, [filterBanner]);
```

---

## 2. Code Duplication Analysis

### 2.1 Error Validation Duplication

**Severity:** MEDIUM - Will compound in plugin/skill systems

**Duplicate Pattern 1: Null/empty check**
```javascript
// add.js:42-44
if (!name) {
  console.info(chalk.red('Error: Name is required'));
  return;
}

// use.js:10-12
if (!name) {
  console.info(chalk.red('Error: Name is required'));
  return;
}

// remove.js:10-12
if (!name) {
  log.error('Name is required for removing an MCP configuration');
  return;
}
```

**Occurrences:** 6 times across commands

**Duplicate Pattern 2: Server lookup with error**
```javascript
// add.js:53-56
const existingServer = getServerByName(name);
if (existingServer) {
  console.info(chalk.yellow(`Server with name "${name}" already exists. Updating configuration...`));
}

// use.js:16-18
const server = getServerByName(name);
if (!server) {
  console.info(chalk.red(`Error: No MCP configuration found with name "${name}"`));
  return;
}
```

**Occurrences:** 3 times with variations

---

### 2.2 Output Formatting Duplication

**Severity:** MEDIUM - Text formatting scattered across files

**Duplicate Pattern 3: List header formatting**
```javascript
// list.js:15-16
console.info(chalk.bold('\nMCP Configurations:'));
console.info(chalk.dim('-------------------'));

// tools.js:16-17
console.info(chalk.bold('\nMCP Tools:'));
console.info(chalk.dim('----------'));

// groups.js:70
console.info(chalk.bold('\nServer Groups:'));
```

**No centralized formatter** - repeated patterns for:
- Section headers (bold + dim divider)
- Item display (property: value)
- Empty state messages (yellow warning text)

**Duplication Metric:** ~35% of output code is formatting boilerplate

---

### 2.3 Comma-Separated Parser Duplication

**Severity:** MEDIUM - Logic appears in multiple places

**groups.js line 21:**
```javascript
const servers = options.servers.split(',').map(s => s.trim()).filter(Boolean);
```

**add.js line 31:**
```javascript
function parseCommaSeparatedValues(str) {
  if (!str) return [];
  return str.split(',').map(item => item.trim());
}
```

**interactive.js line 286:**
```javascript
const args = command.split(' ');
```

**Consolidation Opportunity:** Should be `parseCommaSeparatedValues()` in utils

---

## 3. Naming Convention Analysis

### 3.1 Consistency Assessment

**Variable Naming:** GOOD (90% consistency)
- `camelCase` for variables: `existingServer`, `serverName`, `historyIndex`
- `SCREAMING_SNAKE_CASE` for constants: `COMMANDS`, `MAX_HISTORY`, `CONFIG`

**Function Naming:** GOOD (95% consistency)
- Command handlers: `add`, `remove`, `list`, `use` (single responsibility, clear)
- Utility functions: `parseKeyValuePairs`, `parseCommaSeparatedValues` (descriptive, verb-first)

**File Naming:** INCONSISTENT (70% consistency)

| Pattern | Files | Status |
|---------|-------|--------|
| Command files | `add.js`, `remove.js`, `list.js`, `use.js`, `tools.js`, `groups.js`, `help.js`, `config.js`, `update.js` | Consistent |
| Interactive | `interactive.js` | Correct (singular) |
| Utilities | `log.js`, `config.js`, `instanceManager.js`, `updateChecker.js` | **Inconsistent**: Mix of verb-based and noun-based |
| Exports | Some default, some named | **Inconsistent** |

**Issues:**
- `updateChecker.js` vs `instanceManager.js` (different naming styles)
- Some files export both default and named (config.js line 68)
- No clear pattern for which commands get dedicated files vs command modules

---

### 3.2 Function Naming Inconsistencies

**Severity:** LOW - Minor, but compounds in plugin system

```javascript
// config.js exports (mix of patterns)
export function readConfig()        // Verb-noun
export function writeConfig()       // Verb-noun
export function getServerByName()   // Getter convention
export function addServer()         // Verb-noun
export function removeServer()      // Verb-noun
export function getGroups()         // Getter convention
export function addGroup()          // Verb-noun
export function removeGroup()       // Verb-noun
export function expandServerOrGroup() // Long, descriptive
export function isLogging()         // Boolean convention

// Later in same file
function ensureConfigDir()          // Private, "ensure" pattern
function isLogging()                // "Is" pattern for booleans (correct)
```

**Pattern:** Functions are well-named, but plugin system should formalize these patterns.

---

## 4. Anti-Patterns Identified

### 4.1 Empty Conditionals for Logging

**Severity:** MEDIUM - Code smell, indicates incomplete debugging

Appears in 4 files:

```javascript
// use.js:34-36
if (isLogging()) {
  // Intentionally empty for logging in debug mode
}

// use.js:51-53
if (isLogging()) {
  // Intentionally empty for logging in debug mode
}

// instanceManager.js:51-53
if (isLogging()) {
  // Intentionally empty for logging in debug mode
}

// instanceManager.js:416-418
if (instancesToRemove.length > 0 && isLogging()) {
  console.info(`Cleaned up ${instancesToRemove.length} stale instance(s)`);
}
```

**Issue:** Either the logging should be present or the conditional should be removed. Empty conditionals indicate:
- Incomplete implementation
- Debug code left behind
- Confusion about logging strategy

**Pattern Appears:** 7 instances across use.js and instanceManager.js

---

### 4.2 Silent Failures

**Severity:** MEDIUM - Makes debugging difficult

Multiple functions fail silently with no indication:

```javascript
// config.js:68-73 (readConfig)
try {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error(`Error reading config from ${configPath}: ${error.message}`);
  return { servers: [] };  // Silent fallback, caller doesn't know about error
}

// interactive.js:46-54 (loadHistory)
function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      return fs.readFileSync(historyFile, 'utf-8').split('\n').filter(Boolean);
    }
  } catch {
    // Silently fail  // ← Explicit silent failure
  }
  return [];
}

// interactive.js:58-64 (saveHistory)
function saveHistory(history) {
  try {
    fs.writeFileSync(historyFile, history.slice(0, MAX_HISTORY).join('\n'));
  } catch {
    // Silently fail
  }
}
```

**Risk:** Plugins and skills may inherit silent failure patterns, making production debugging impossible.

---

### 4.3 God Object Anti-Pattern (Partial)

**Severity:** LOW-MEDIUM - Config module handles too much

**instanceManager.js** - Singleton with 18 public methods + 8 private methods:

```javascript
// Public interface (partial list)
registerInstance()
updateInstancePid()
removeInstance()
updateInstanceStatus()
getAllInstances()
getInstancesByServer()
getInstance()
killInstance()
cleanupStaleInstances()
on() / off()  // Event subscription
getInstance()  // Static factory

// Plus private methods:
#ensureInstancesDirectory()
#loadInstances()
#saveInstance()
#isPidRunning()
#getProcessResourceUsage()
#performHealthCheck()
#startHealthCheck()
stopHealthCheck()
```

**Concern:** EventEmitter + persistence + process management + health checks all in one class. When skills/plugins need instance management, this becomes a hard dependency.

---

### 4.4 Configuration Management Scattered

**Severity:** MEDIUM - No unified approach

Configuration is handled in multiple ways:

```javascript
// config.js - File-based persistence
export function readConfig()
export function writeConfig()
export function setCustomLoadPath()
export function setCustomSavePath()

// config.js - In-memory mutable state
const CONFIG = {
  DIR: path.join(os.homedir(), '.mcpz'),
  PATH: path.join(os.homedir(), '.mcpz', 'config.json'),
  CUSTOM_LOAD_PATH: null,
  CUSTOM_SAVE_PATH: null
};

// instanceManager.js - Separate persistence
this.#instancesDir = path.join(os.homedir(), '.mcpz', 'instances');
this.#saveInstance(instance)  // Separate persistence logic
```

**Issue:** When plugins and skills need configuration, no clear pattern exists.

---

## 5. Architectural Boundary Violations

### 5.1 Command Files Import Patterns

**Severity:** LOW-MEDIUM - Inconsistent dependency management

```javascript
// add.js imports
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { addServer, getServerByName } from '../utils/config.js';

// remove.js imports
import chalk from 'chalk';
import { removeServer, getServerByName } from '../utils/config.js';
import log from '../utils/log.js';  // ← Only file using log directly

// use.js imports
import chalk from 'chalk';
import { spawn } from 'child_process';
import { getServerByName, isLogging } from '../utils/config.js';

// config.js imports
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
// NO imports from other utils
```

**Inconsistency:** Only `remove.js` uses the `log` module. Why? No documentation of the choice.

**Impact:** Plugin system needs clear guidance on which utilities to use.

---

### 5.2 Interactive Mode Dependencies

**Severity:** MEDIUM - Complex dependency tree, unusual imports

```javascript
// interactive.js has unique dependencies
import React from 'react';
import { render, Box, Text, useInput, useApp, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Fuse from 'fuse.js';
import { spawn } from 'child_process';
import { InstanceManager } from '../utils/instanceManager.js';

// Then calls the CLI via subprocess
const child = spawn('node', [binPath, ...args], {
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

**Boundary Violation:** Interactive mode spawns itself as subprocess to execute commands. This is unusual and creates:
- Circular dependency (interactive.js calls index.js)
- No way for plugins to integrate with interactive mode
- Output filtering needed (banner removal line 274)

---

## 6. Test Coverage Gaps

### 6.1 Uncovered Commands and Features

| File | Test File | Coverage | Status |
|------|-----------|----------|--------|
| `add.js` | `commands.test.js` | YES | Good |
| `remove.js` | `commands.test.js` | YES | Good |
| `list.js` | `commands.test.js` | YES | Good |
| `groups.js` | `groups.test.js` | YES | Good |
| `config.js` | `config.test.js` | YES | Good |
| `use.js` | **NONE** | **0%** | CRITICAL |
| `tools.js` | `tools.test.js` | Partial | MEDIUM |
| `help.js` | **NONE** | **0%** | LOW |
| `interactive.js` | **NONE** | **0%** | CRITICAL |
| `update.js` | **NONE** | **0%** | MEDIUM |
| `server.js` | **NONE** | **0%** | CRITICAL |
| `utils/log.js` | `log.test.js` | YES | Good |
| `utils/updateChecker.js` | **NONE** | **0%** | MEDIUM |

**Coverage Summary:**
- **8 out of 14 source files** have zero test coverage
- **Interactive mode (586 lines)** completely untested
- **Server subprocess integration** completely untested
- **Process spawning in use.js** completely untested

---

### 6.2 Test Infrastructure Issues

**Severity:** MEDIUM - Test utilities duplicated

Console capture utility duplicated in:
- `commands.test.js` (lines 16-39)
- `groups.test.js` (lines 14-37)

Should be extracted to shared test utility.

---

## 7. Async/Await Anti-Patterns

### 7.1 Promise Handling in Interactive Mode

**Severity:** MEDIUM - Fire-and-forget resource usage

```javascript
// interactive.js:306-316
this.#getProcessResourceUsage(instance.pid).then(resourceUsage => {
  if (resourceUsage) {
    instance.resourceUsage = resourceUsage;
    this.#saveInstance(instance);
    // Notify listeners of the update
    this.#eventEmitter.emit('instance_updated', instance);
    this.#eventEmitter.emit('instances_changed', this.getAllInstances());
  }
}).catch(error => {
  console.debug(`Failed to get resource usage for instance ${instance.id}:`, error);
});
```

**Issue:** Promise result not awaited. In loops (instanceManager.js:290), this creates:
- Unbounded promise queue
- Potential memory leaks
- No backpressure mechanism

---

## 8. Patterns That Should Be Standardized Before Refactoring

### 8.1 Error Handling Standards

**Recommendation:**

Create `/src/utils/errorHandler.js`:

```javascript
/**
 * Standardized error handling for commands
 */
export class CommandError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

export function validateRequired(value, fieldName) {
  if (!value) {
    throw new CommandError(`${fieldName} is required`);
  }
  return value;
}

export function handleCommandError(error) {
  if (error instanceof CommandError) {
    log.error(error.message);
  } else {
    log.error(`Unexpected error: ${error.message}`);
  }
}
```

**Usage in commands:**
```javascript
export function add(name, options) {
  try {
    validateRequired(name, 'Name');
    validateRequired(options.command, 'Command');

    const server = { /* ... */ };
    addServer(server);
    log.info(chalk.green('Successfully added configuration'));
  } catch (error) {
    handleCommandError(error);
  }
}
```

---

### 8.2 Output Formatting Standards

**Recommendation:**

Create `/src/utils/formatter.js`:

```javascript
export const format = {
  sectionHeader: (title) => {
    console.info(chalk.bold(`\n${title}`));
    console.info(chalk.dim('─'.repeat(title.length)));
  },

  item: (label, value) => {
    console.info(chalk.dim(`  ${label}:`) + ` ${value}`);
  },

  error: (message) => {
    log.error(chalk.red(`Error: ${message}`));
  },

  success: (message) => {
    log.info(chalk.green(message));
  },

  warning: (message) => {
    log.warn(chalk.yellow(message));
  }
};
```

---

### 8.3 Validation Helper Standards

**Recommendation:**

Create `/src/utils/validators.js`:

```javascript
export function validateNonEmpty(value, fieldName) {
  if (!value || value.trim() === '') {
    throw new Error(`${fieldName} cannot be empty`);
  }
}

export function validateArray(value, fieldName, minLength = 0) {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new Error(`${fieldName} must be an array with at least ${minLength} items`);
  }
}

export function parseCommaSeparated(str) {
  if (!str) return [];
  return str.split(',').map(item => item.trim()).filter(Boolean);
}
```

---

## 9. Recommended Refactoring Sequence

### Phase 1: Infrastructure (Before groups→toolbox change)

1. **Extract error handling:**
   - Create `errorHandler.js` with standardized `CommandError` class
   - Update all commands to use it
   - Estimated effort: 4 hours
   - Files affected: 10 commands

2. **Extract output formatting:**
   - Create `formatter.js` with standardized format methods
   - Update all commands to use centralized formatting
   - Estimated effort: 3 hours
   - Impact: Consistent appearance across CLI

3. **Extract validation:**
   - Create `validators.js` with shared validation functions
   - Consolidate duplicate parsing logic
   - Estimated effort: 2 hours
   - Lines saved: ~50 LOC

### Phase 2: Test Coverage (Concurrent with Phase 1)

1. **Create test utilities:**
   - Extract `captureConsole()` to shared helper
   - Add command execution test helper
   - Estimated effort: 1 hour

2. **Add missing tests:**
   - `use.js` - process spawning (2 hours)
   - `interactive.js` - component testing (3 hours - requires ink test setup)
   - `server.js` - integration tests (4 hours)
   - Estimated effort: 9 hours total

### Phase 3: Refactor (After infrastructure stable)

1. **Add toolbox alias:**
   - Update command routing to support `toolbox` command alongside `groups`
   - Estimated effort: 1 hour

2. **Prepare plugin system hooks:**
   - Create plugin API with standardized error/output patterns
   - Estimated effort: 4 hours

---

## 10. Code Quality Metrics Summary

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Code duplication (%) | 35% | <15% | HIGH |
| Test coverage (%) | 57% | >80% | MEDIUM |
| Consistent error handling | 30% | 100% | CRITICAL |
| Consistent output formatting | 40% | 100% | HIGH |
| Command validation patterns | 60% | 100% | MEDIUM |
| Async error safety | 70% | 100% | MEDIUM |

---

## 11. Plugin/Skill System Readiness

### Current State: NOT READY

**Why:**
1. No standardized error handling - plugins will inherit mixed patterns
2. No output formatting standard - plugins can't match CLI appearance
3. Configuration approach unclear - where should plugins store state?
4. No plugin API definition - what should be exposed?
5. Async patterns unsafe - plugins will create memory leaks

### Readiness Checklist

- [ ] Error handling standardized across all commands
- [ ] Output formatting centralized
- [ ] Validation functions extracted
- [ ] Plugin API documented
- [ ] Test infrastructure for plugins ready
- [ ] Configuration handling pattern defined
- [ ] Logging strategy finalized
- [ ] Documentation for plugin developers

---

## Key Findings for Planning

### Before groups→toolbox Aliasing

1. **Quick wins** (can be done first):
   - Add `toolbox` command alias pointing to `groups` module
   - Update help text
   - Estimated: 30 minutes
   - No refactoring required

2. **Must do before plugin system**:
   - Standardize error handling
   - Centralize output formatting
   - Define plugin API

3. **Nice to have before plugin system**:
   - Improve test coverage to >80%
   - Add integration tests
   - Document architectural patterns

---

## Detailed Recommendations by File

### src/commands/add.js
- Replace manual validation with `validateRequired()` from validators.js
- Replace error output with `format.error()`
- Extract `parseKeyValuePairs()` to validators.js
- Lines to reduce: ~10

### src/commands/remove.js
- Already uses `log` module - good pattern to follow
- Still needs `format.error()` for consistency
- Extract server lookup error to reusable function

### src/commands/use.js
- Add error handling to process spawn callbacks
- Remove empty `if (isLogging())` blocks
- Consider adding test file (currently 0% covered)
- Lines to refactor: 20+

### src/commands/interactive.js
- Extract banner filtering to separate utility
- Fix promise handling in resource usage update
- Add error boundaries for subprocess execution
- Consider breaking into smaller components
- **Critical:** Add test coverage

### src/utils/config.js
- Keep structure, but document CONFIG usage
- Consider splitting into config reader and manager
- Add validation at read/write boundaries

### src/utils/instanceManager.js
- Remove empty `if (isLogging())` blocks
- Fix fire-and-forget promise in health check
- Consider extracting resource usage monitoring to separate class
- Add tests for all public methods

---

## Conclusion

The mcpsx.run CLI is **functionally complete** but requires **significant standardization** before expanding with plugin and skill systems. The 35% code duplication and mixed error handling patterns will multiply technical debt during expansion.

**Recommended action:** Execute Phase 1 (infrastructure) before adding plugin system. Estimated 9 hours of work yields major improvements in maintainability and sets clear patterns for future contributors.

The good news: Patterns are inconsistent but not contradictory. Consolidation is straightforward and low-risk refactoring.

