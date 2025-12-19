# Tech Stack: mcpz CLI

## Runtime
- **Node.js** - JavaScript runtime (ES Modules)
- **Package Type**: `"type": "module"` (ESM)

## Core Dependencies

### CLI Framework
- **Commander.js** (^13.0.0) - CLI argument parsing and command routing
- **Chalk** (^5.4.1) - Terminal styling and colors
- **Boxen** (^8.0.1) - Terminal box drawing

### Interactive UI
- **Ink** (^5.1.0) - React-based terminal UI framework
- **React** (^18.3.1) - Component model for TUI
- **Ink-link** (^4.1.0) - Clickable links in terminal
- **Ink-spinner** (^5.0.0) - Loading spinners
- **Ink-text-input** (^6.0.0) - Text input components

### MCP Integration
- **@modelcontextprotocol/sdk** (^1.12.0) - Official MCP SDK

### Utilities
- **Fuse.js** (^7.0.0) - Fuzzy search
- **Log-update** (^6.1.0) - Terminal log updates
- **Term-size** (^3.0.2) - Terminal dimensions
- **UUID** (^11.0.3) - Unique identifiers

## Development Tools

### Build
- Custom build script (`src/build.js`)
- **JavaScript-obfuscator** (^4.1.1) - Code obfuscation for distribution

### Testing
- **Node.js native test runner** (`node:test`)
- Test files in `/test/*.test.js`
- Commands:
  - `npm run test` - Run all tests
  - `npm run test:single` - Run single test file
  - `npm run test:watch` - Watch mode
  - `npm run test:coverage` - Coverage report

### Code Quality
- **ESLint** (^9.16.0) - Linting
- **Husky** (^9.1.7) - Git hooks
- **Lint-staged** (^15.2.10) - Pre-commit linting

## Project Structure
```
cli/
├── src/
│   ├── index.js          # Entry point
│   ├── server.js         # MCP server logic
│   ├── build.js          # Build script
│   ├── commands/         # CLI commands
│   │   ├── add.js
│   │   ├── config.js
│   │   ├── groups.js
│   │   ├── help.js
│   │   ├── interactive.js
│   │   ├── list.js
│   │   ├── remove.js
│   │   ├── tools.js
│   │   ├── update.js
│   │   └── use.js
│   └── utils/
│       ├── config.js
│       ├── console.js
│       ├── instanceManager.js
│       ├── log.js
│       └── updateChecker.js
├── test/                 # Test files
├── dist/                 # Build output
└── package.json
```

## Configuration
- **Config Location**: `~/.mcpz/config.json`
- **Instance Tracking**: `~/.mcpsx/instances/`

## Distribution
- Published to npm as `@mcpz/cli`
- Multiple binary aliases: `mcps`, `mcpz`, `mcpsx`, `mz`
- Supports both global install and npx usage

## Key Patterns
- ES Modules throughout
- Async/await for all I/O
- Commander.js for command structure
- Ink/React for interactive UIs
- Modular command architecture
