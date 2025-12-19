# Development Workflow: TDD-First

## Overview
This project follows a Test-Driven Development workflow. Write tests first, then implement to make them pass.

## Workflow Phases

### 1. Spec Phase
- Understand the requirement
- Define acceptance criteria
- Identify edge cases

### 2. Test Phase (RED)
- Write failing tests that specify the expected behavior
- Tests should be specific and focused
- Cover happy path and edge cases
- Run tests to confirm they fail: `npm run test`

### 3. Implementation Phase (GREEN)
- Write minimal code to pass tests
- Focus on correctness, not optimization
- Run tests frequently: `npm run test:single test/filename.test.js`

### 4. Refactor Phase (REFACTOR)
- Clean up code while keeping tests green
- Apply DRY principles
- Improve naming and structure
- Ensure all tests still pass

### 5. Review Phase
- Run full test suite: `npm run test`
- Check linting: `npm run lint`
- Verify build: `npm run build`

## Commands Reference

```bash
# Run all tests
npm run test

# Run single test file
npm run test:single test/filename.test.js

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Lint code
npm run lint

# Build
npm run build
```

## Git Workflow

### Branch Naming
- Features: `feature/<description>`
- Bugs: `fix/<description>`
- Performance: `perf/<description>`

### Commit Messages
```
type(scope): description

- feat: New feature
- fix: Bug fix
- perf: Performance improvement
- test: Adding tests
- refactor: Code refactoring
- docs: Documentation
```

## Quality Gates
Before merging:
1. All tests pass
2. No lint errors
3. Build succeeds
4. Code reviewed

## Performance Testing (Current Focus)
For performance optimization tracks:
1. Establish baseline measurements
2. Identify bottlenecks
3. Implement optimization
4. Measure improvement
5. Document results
