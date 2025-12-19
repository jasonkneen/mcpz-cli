# Testing Style Guide

## Framework
- Node.js native test runner (`node:test`)
- No external test frameworks required

## File Structure
- Test files in `/test/` directory
- Naming: `*.test.js`
- One test file per module/feature

## Test Structure

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'

describe('ModuleName', () => {
  beforeEach(() => {
    // Setup
  })

  afterEach(() => {
    // Cleanup
  })

  describe('functionName', () => {
    it('should do expected behavior', async () => {
      // Arrange
      const input = 'test'

      // Act
      const result = await functionName(input)

      // Assert
      assert.strictEqual(result, expected)
    })

    it('should handle edge case', async () => {
      // Test edge case
    })
  })
})
```

## Assertions
- Use `node:assert` module
- Prefer `strictEqual` over `equal`
- Use `deepStrictEqual` for objects

```javascript
import assert from 'node:assert'

assert.strictEqual(actual, expected)
assert.deepStrictEqual(actualObj, expectedObj)
assert.ok(value)
assert.rejects(async () => await failingFn())
assert.throws(() => throwingFn())
```

## Naming Conventions
- Describe blocks: noun (the thing being tested)
- It blocks: "should..." (expected behavior)
- Be specific about what's being tested

```javascript
describe('ConfigManager', () => {
  describe('load', () => {
    it('should return default config when file not found')
    it('should parse valid JSON config')
    it('should throw on invalid JSON')
  })
})
```

## Test Data
- Use minimal, focused test data
- Create helper functions for complex setup
- Isolate tests from each other

## Mocking
- Mock external dependencies (filesystem, network)
- Use temp directories for file tests
- Clean up mocks in afterEach

```javascript
import { mock } from 'node:test'
import fs from 'node:fs/promises'

// Mock a module
const readFileMock = mock.fn(async () => '{}')
mock.method(fs, 'readFile', readFileMock)

// Restore after test
afterEach(() => {
  mock.restoreAll()
})
```

## Async Testing
- Always await async operations
- Test both success and failure paths
- Use assert.rejects for promise rejections

```javascript
it('should reject on invalid input', async () => {
  await assert.rejects(
    async () => await processInput(null),
    { message: /invalid input/i }
  )
})
```

## Coverage
- Run with: `npm run test:coverage`
- Aim for meaningful coverage, not 100%
- Cover critical paths and edge cases

## Best Practices
- Each test should be independent
- Tests should not depend on console output
- Use temp directories for file operations
- Clean up resources after tests
