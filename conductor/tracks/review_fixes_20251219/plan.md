# Implementation Plan: Fix All Review Issues

## Phase 1: P1 Critical Security Fixes
- [x] Task: Fix command injection in updateChecker.js
  - [x] Replace `exec()` with `execFile()` on line 47
  - [x] Replace `exec()` with `execFile()` on line 77
  - [x] Add 2-second timeout to execFile calls
  - [x] Add package name validation

- [x] Task: Fix arbitrary command execution in use.js
  - [x] Create command whitelist (node, python, npm, npx, uvx, uv, deno, bun, ruby, java, dotnet)
  - [x] Validate command against whitelist before spawn
  - [x] Block shell metacharacters and path traversal

- [x] Task: Fix command injection in interactive.js
  - [x] Replace `command.split(' ')` with proper argument parsing (parseCommandArgs)
  - [x] Add input validation (validateCommandInput) for dangerous patterns
  - [x] Handle quoted strings properly

- [x] Task: Conductor - Phase 1 Verification
  - [x] Run test suite - All 106 tests pass

## Phase 2: P1 Critical Performance Fixes
- [x] Task: Make npm update check non-blocking
  - [x] Add timeout to execFile call (2000ms)
  - [x] Add maxBuffer limit (10KB)

- [x] Task: Enable settings cache
  - [x] Change `#cacheTTL = 0` to `#cacheTTL = 5000` in server.js:75

- [x] Task: Optimize health check subprocess spawning
  - [x] Create `#getBatchedResourceUsage(pids)` method
  - [x] Single `ps` command for all PIDs
  - [x] Use setImmediate() to defer collection
  - [x] Add PID validation before subprocess call

- [x] Task: Conductor - Phase 2 Verification
  - [x] Run test suite - All tests pass

## Phase 3: P2 High Priority Security Fixes
- [x] Task: Fix environment variable injection in add.js
  - [x] Create BLOCKED_ENV_VARS blocklist (PATH, LD_LIBRARY_PATH, etc.)
  - [x] Create validateEnv() function using blocklist approach
  - [x] Apply validation in add command
  - [x] Warn users when env vars are blocked

- [x] Task: Fix unsafe PID-based process operations
  - [x] Add PID validation (#isValidPid - positive integer check)
  - [x] Validate PIDs before subprocess calls

- [x] Task: Add config file permission validation
  - [x] Check file mode for world-writable bits (0o002)
  - [x] Check file mode for group-writable bits (0o020)
  - [x] Warn on insecure permissions (don't block, maintain usability)

- [x] Task: Fix command injection in resource usage check
  - [x] Validate PID is positive integer
  - [x] Use execFile with explicit arguments array
  - [x] Filter invalid PIDs before batch query

- [x] Task: Conductor - Phase 3 Verification
  - [x] Run full test suite - All 106 tests pass

## Phase 4: P3 Medium Priority Fixes
- [x] Task: Add input validation for server configuration
  - [x] Create validateServerName() - alphanumeric, underscore, dash, space only
  - [x] 64 character limit
  - [x] Block path traversal characters

- [x] Task: Secure instance file storage
  - [x] Set file permissions to 0o600 in saveInstance()
  - [x] Set file permissions to 0o600 in writeConfig()

- [x] Task: Conductor - Phase 4 Verification
  - [x] Run full test suite - All tests pass

## Phase 5: Code Quality Improvements
- [x] Task: Implement validators in-place
  - [x] validateServerName() in add.js
  - [x] validateCommand() in use.js
  - [x] validateEnv() in add.js
  - [x] #isValidPid() in instanceManager.js
  - [x] parseCommandArgs() in interactive.js
  - [x] validateCommandInput() in interactive.js
  - [x] validatePackageName() in updateChecker.js

- [x] Task: Standardize error handling
  - [x] Consistent validation-before-execution pattern
  - [x] Clear error messages with reasons

- [x] Task: Conductor - Phase 5 Verification
  - [x] Run full test suite - 106 tests pass
  - [x] Run ESLint - 11 warnings (pre-existing), 0 errors

## Phase 6: Final Verification
- [x] Task: Full integration testing
  - [x] All 106 tests pass
  - [x] No test failures

- [x] Task: Security verification
  - [x] Command injection prevented (execFile, input validation)
  - [x] File permissions secured (0o600)
  - [x] PID validation implemented
  - [x] Env var blocklist implemented

## Summary of Changes

### Files Modified:
1. **src/utils/updateChecker.js** - exec→execFile, package name validation, timeout
2. **src/commands/use.js** - Command whitelist, shell metacharacter blocking
3. **src/commands/interactive.js** - Proper argument parsing, input validation
4. **src/server.js** - Enabled cache (TTL 0→5000)
5. **src/utils/instanceManager.js** - Batched subprocess calls, PID validation, secure file write
6. **src/commands/add.js** - Server name validation, env var blocklist
7. **src/utils/config.js** - File permission checking, secure file write

### Security Improvements:
- 3 command injection vulnerabilities fixed
- Environment variable injection prevented
- PID validation added
- File permissions secured to 0o600
- Input validation throughout

### Performance Improvements:
- Settings cache enabled (was disabled with TTL=0)
- Health checks batched (N calls → 1 call)
- Background processing with setImmediate()
