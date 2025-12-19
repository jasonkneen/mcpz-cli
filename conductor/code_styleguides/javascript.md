# JavaScript Style Guide

## Module System
- Use ES Modules (`import`/`export`)
- File extension: `.js`
- Use named exports for utilities, default exports for main classes

```javascript
// Named exports
export { loadConfig, saveConfig }

// Default export
export default class ConfigManager {}
```

## Imports
- Group imports: built-in → external → internal
- Sort alphabetically within groups
- Use relative paths with `./` prefix

```javascript
// Built-in
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// External
import chalk from 'chalk'
import { Command } from 'commander'

// Internal
import { loadConfig } from './utils/config.js'
import { log } from './utils/log.js'
```

## Naming Conventions
- **Variables/functions**: camelCase
- **Classes**: PascalCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Files**: kebab-case or camelCase (consistent within project)

## Functions
- Prefer arrow functions for callbacks
- Use async/await over raw promises
- Add JSDoc for public functions

```javascript
/**
 * Loads configuration from the specified path
 * @param {string} configPath - Path to config file
 * @returns {Promise<Object>} Parsed configuration
 */
export async function loadConfig(configPath) {
  const content = await readFile(configPath, 'utf-8')
  return JSON.parse(content)
}
```

## Error Handling
- Use try/catch for async operations
- Throw descriptive errors
- Handle errors at appropriate boundaries

```javascript
try {
  const config = await loadConfig(path)
} catch (error) {
  if (error.code === 'ENOENT') {
    log.warn('Config not found, using defaults')
    return defaultConfig
  }
  throw error
}
```

## Async Patterns
- Always use async/await
- Handle promise rejections
- Use Promise.all for parallel operations

```javascript
// Good
const [config, servers] = await Promise.all([
  loadConfig(),
  listServers()
])

// Avoid
loadConfig().then(config => {
  listServers().then(servers => {})
})
```

## Code Organization
- One responsibility per function
- Keep functions under 50 lines
- Extract reusable logic into utils

## Comments
- Prefer self-documenting code
- Comment "why", not "what"
- Use JSDoc for public APIs
