# Spec: Fix All Review Issues

## Overview
Address all security, performance, and code quality issues identified in the comprehensive code review. This track fixes 12 security vulnerabilities, 6 performance bottlenecks, and reduces code complexity by standardizing patterns.

## Functional Requirements

### P1 Critical Security Fixes
1. **Command Injection in updateChecker.js** (lines 47, 77)
   - Replace `exec()` with `execFile()` for npm commands
   - Validate package name before use

2. **Arbitrary Command Execution in use.js** (line 39)
   - Implement command whitelist validation
   - Use absolute paths for spawned processes

3. **Command Injection in interactive.js** (lines 286-289)
   - Replace naive string split with proper argument parsing
   - Sanitize user input before spawn

### P1 Critical Performance Fixes
4. **Blocking npm Update Check** (index.js lines 234-241)
   - Add 2-second timeout to npm registry call
   - Make check fully async (fire-and-forget)

5. **Disabled Settings Cache** (server.js line 75)
   - Change `#cacheTTL = 0` to `#cacheTTL = 5000`
   - Add cache invalidation on save

6. **Unbounded Health Check Subprocess Spawning** (instanceManager.js lines 289-336)
   - Batch resource queries into single `ps` command
   - Defer resource collection to background

### P2 High Priority Fixes
7. **Environment Variable Injection** (add.js lines 59-60)
   - Implement env var whitelist

8. **Unsafe PID-Based Process Killing** (instanceManager.js lines 353-378)
   - Verify process ownership before kill

9. **Missing File Permission Validation** (config.js lines 56-73)
   - Check config file permissions (not world-writable)

10. **Command Injection in Resource Usage** (instanceManager.js line 249)
    - Validate PID is numeric before use in `ps` command

11. **Duplicate Synchronous File Reads** (index.js lines 12-92)
    - Cache version in module scope
    - Consolidate path resolution

### P3 Medium Priority Fixes
12. **Missing Input Validation** (add.js lines 41-79)
    - Validate server names (alphanumeric only)
    - Check command paths for traversal

13. **Sensitive Data in Error Messages** (server.js lines 998, 1006, 1139)
    - Truncate JSON payloads in logs

14. **Instance Files Stored Unencrypted** (instanceManager.js lines 59-66)
    - Set file permissions to 0o600

### Code Quality Improvements
15. **Standardize Error Handling** (7 different patterns found)
    - Create unified error handling utility

16. **Reduce Code Duplication** (35% duplication)
    - Extract validators.js for input validation
    - Extract formatter.js for output formatting

## Acceptance Criteria
- [ ] All `exec()` calls replaced with `execFile()` or properly sanitized
- [ ] CLI startup time reduced by 50%+ (target < 200ms)
- [ ] Settings cache enabled with 5s TTL
- [ ] Health checks batch subprocess calls
- [ ] Config files created with restrictive permissions (0o600)
- [ ] All tests pass
- [ ] No new ESLint warnings introduced

## Out of Scope
- SDK upgrade (1.12.0 → 1.25.1) - separate track
- Groups → Toolbox rename - separate track
- Plugin system architecture - separate track
- Skills integration - separate track
- Interactive mode rewrite (simplification) - separate track
