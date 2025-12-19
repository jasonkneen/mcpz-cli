# Product Context: mcpz CLI

## Vision
A powerful, developer-friendly command line interface for managing Model Context Protocol (MCP) servers and tools, enabling seamless integration of AI capabilities into development workflows.

## Target Users
1. **Developers using MCP** - Primary users integrating MCP servers into their AI-powered applications and workflows
2. **MCP Server Authors** - Developers building and testing MCP servers who need tooling for management and debugging

## Core Value Proposition
- **Unified Management**: Single CLI to manage multiple MCP server configurations
- **Flexible Execution**: Run servers individually, in groups, or with specific tool filtering
- **Cross-Platform**: Works as standalone CLI or integrates with VSCode extension
- **Developer Experience**: Intuitive commands, helpful output, and easy configuration

## Key Features

### Server Management
- Add/remove MCP server configurations
- List available servers with their status
- Use specific servers on demand

### Group Management
- Create logical groups of servers (e.g., "ai-models", "data-tools")
- Run entire groups with a single command
- Combine groups with individual servers

### Runtime Options
- Start as stdio server for VSCode integration
- Filter to specific servers or tools
- Environment variable management
- Instance tracking and cleanup

### Configuration
- JSON-based configuration at `~/.mcpz/config.json`
- Load/save configs for different environments
- Shared config with VSCode extension

## Current State (v1.0.33)
- Stable CLI with core functionality
- Interactive TUI using Ink (React-based)
- MCP SDK integration for protocol compliance
- Test suite with Node.js native test runner

## Strategic Focus: Performance Optimization
The next phase focuses on:
- Reducing startup time
- Improving server connection efficiency
- Optimizing instance management
- Minimizing resource usage

## Success Metrics
- Startup time < 500ms for common operations
- Memory footprint optimization
- Reliable server lifecycle management
- Zero-config experience for standard use cases
