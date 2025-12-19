# mcpsx.run CLI - Architectural Analysis & Recommendations

## Executive Summary

The CLI has a **well-structured, modular architecture** with clear separation of concerns. However, several upcoming features require thoughtful architectural decisions to maintain this quality. This analysis examines the current design and provides specific recommendations for implementing the "groups → toolbox" rename, plugin system, skill support, and SDK upgrade.

---

## 1. Current Architecture Overview

### 1.1 Command Structure

**Pattern**: Command-per-file modular design using Commander.js

**Location**: `/src/commands/`
- `index.js` - Command registration (routes to subcommands)
- `add.js` - Add MCP configuration
- `remove.js` - Remove MCP configuration
- `list.js` - List configurations
- `use.js` - Select active configuration
- `tools.js` - List available tools
- `groups.js` - Manage server groups (primary focus for rename)
- `config.js` - Manage configuration paths
- `help.js` - Display help
- `interactive.js` - TUI with Ink/React
- `update.js` - Check/install updates

**Architecture Pattern**: Each command is a pure function that reads config, performs action, and outputs result via `console.info()`.

**Strengths**:
- ✓ Single responsibility per file
- ✓ No circular dependencies
- ✓ Easy to test (pure functions)
- ✓ CLI framework agnostic (minimal Commander.js coupling)

### 1.2 Configuration Management

**Location**: `/src/utils/config.js`

**Core Functions**:
- `readConfig()` / `writeConfig()` - Primary serialization
- `getGroups()` / `addGroup()` / `removeGroup()` - Group operations
- `expandServerOrGroup()` - Expand group name to server list
- `setCustomLoadPath()` / `setCustomSavePath()` - Test/migration support

**Config Structure**:
```json
{
  "servers": [
    {
      "name": "string",
      "command": "string",
      "args": ["string"],
      "env": { "key": "value" }
    }
  ],
  "groups": {
    "groupName": ["server1", "server2"]
  }
}
```

**Strengths**:
- ✓ Centralized configuration access (single import point)
- ✓ Supports custom load/save paths (testing, migration)
- ✓ Group expansion logic (groups are "virtual MCPs")
- ✓ No config caching issues (reads fresh each time)

### 1.3 Server Lifecycle Management

**Location**: `/src/utils/instanceManager.js` and `/src/server.js`

**InstanceManager**:
- Singleton pattern with lazy initialization
- Tracks running processes in `~/.mcpz/instances/`
- Health check mechanism (validates running PIDs)
- Event emission for status changes

**SettingsManager** (in server.js):
- Manages tool allowlists and auto-approval
- Provides tool-to-server mapping
- Handles tool filtering for "always allow" and "auto approve" lists

**Strengths**:
- ✓ Persistent instance tracking (survives CLI restarts)
- ✓ Singleton ensures one authoritative instance registry
- ✓ JSON file-based persistence (easy backup, inspection)

### 1.4 Build & Distribution

**Location**: `/src/build.js`

**Process**:
1. Transpile TypeScript (if used) / copy JS files to `dist/`
2. Obfuscate with JavaScriptObfuscator
3. Copy package.json to dist/
4. Publish to npm with version

**Strengths**:
- ✓ Obfuscation prevents reverse engineering
- ✓ Separates source from distribution
- ✓ npm bin entries support multiple aliases (mcps, mcpz, mcpsx, mz)

### 1.5 Test Coverage Architecture

**Location**: `/test/`

**Test Files**:
- `config.test.js` - Config reading/writing
- `groups.test.js` - Group operations
- `commands.test.js` - Command execution
- `instanceManager.test.js` - Instance tracking
- `tools.test.js` - Tool listing/filtering
- `log.test.js` - Logging behavior

**Testing Pattern**:
- Node.js native test runner (`node:test`)
- Temp directories for isolation (`os.tmpdir()`)
- Console mocking for assertion
- Config module mocking to use test paths

**Strengths**:
- ✓ No external test framework dependencies
- ✓ Good isolation (temp directories)
- ✓ Test config override pattern (can be reused)

---

## 2. Architectural Compliance Analysis

### 2.1 SOLID Principles Evaluation

#### Single Responsibility (S)
- **Status**: ✓ **COMPLIANT**
- `/src/commands/add.js` - Only handles adding servers
- `/src/utils/config.js` - Only manages config I/O
- `/src/utils/instanceManager.js` - Only tracks running instances
- No god objects or responsibility overlap

#### Open/Closed (O)
- **Status**: ✓ **MOSTLY COMPLIANT** with notes
- **Open for extension**: New commands can be added without modifying `index.js` (dynamic imports)
- **Closed for modification**: Command interface is stable (single function pattern)
- **Note**: Adding new features like plugins/skills requires careful extension points

#### Liskov Substitution (L)
- **Status**: ✓ **N/A** (No inheritance hierarchy)
- Functions as contracts rather than class hierarchies

#### Interface Segregation (I)
- **Status**: ✓ **COMPLIANT**
- Config API is minimal: `readConfig()`, `writeConfig()`, specific getters
- Commands don't expose internal state
- InstanceManager exposes focused API: `register()`, `list()`, `cleanup()`

#### Dependency Inversion (D)
- **Status**: ⚠️ **PARTIAL**
- **Good**: Commands depend on config abstraction, not file system directly
- **Issue**: Server lifecycle code imports `@modelcontextprotocol/sdk` directly (tight coupling to MCP SDK version)
- **Recommendation**: Create abstraction layer for SDK interactions

### 2.2 Coupling & Cohesion Analysis

**Dependency Graph**:
```
index.js (entry point)
├── commands/* (pure functions)
│   ├── add.js, remove.js, list.js → config.js
│   ├── groups.js → config.js
│   ├── tools.js → server.js, config.js
│   └── interactive.js → config.js, instanceManager.js
├── server.js
│   ├── instanceManager.js
│   ├── config.js (SettingsManager reads config)
│   └── @modelcontextprotocol/sdk (TIGHT COUPLING)
└── utils/*
    ├── config.js (core, no dependencies)
    ├── instanceManager.js (standalone)
    └── updateChecker.js (standalone)
```

**Coupling Issues Identified**:
1. ⚠️ **SDK Coupling** (`server.js` directly imports @modelcontextprotocol/sdk)
   - Tight version dependency makes upgrades risky
   - Tool registration tightly coupled to SDK types
   - Recommendation: Create abstraction layer

2. ⚠️ **Console Output Coupling** (all commands use `console.info()`)
   - Makes programmatic output parsing difficult
   - Recommendation: Add output formatter abstraction

3. ⚠️ **Interactive Command Coupling** (`interactive.js` spawns child process running CLI)
   - Creates circular invocation (CLI calls itself)
   - Recommendation: Move core logic to shared module, reuse from interactive

### 2.3 Architectural Boundaries

**Clear Boundaries**:
- ✓ Commands layer (stateless, pure functions)
- ✓ Config layer (single source of truth)
- ✓ Instance tracking layer (process management)
- ✓ CLI layer (Command.js integration)

**Unclear Boundaries**:
- ⚠️ Server startup logic (in server.js) vs. instance tracking (instanceManager.js)
- ⚠️ Tool filtering logic (in server.js SettingsManager) vs. config layer

---

## 3. Upcoming Feature Analysis

### 3.1 Feature: "Groups" → "Toolbox" Rename

**Goal**: Rename "groups" to "toolbox/toolboxes" while maintaining backward compatibility

#### Current Implementation Points

**Config Storage** (`config.js`):
```javascript
config.groups = { "groupName": ["server1", "server2"] }
```

**CLI Commands** (`index.js`):
```javascript
program.command('groups')
  .addCommand(new Command('add'))
  .addCommand(new Command('remove'))
  .addCommand(new Command('list'))
```

**Expansion Logic** (`config.js`):
```javascript
export function expandServerOrGroup(name) {
  const groups = getGroups()
  if (groups[name]) return groups[name]
  return [name]
}
```

#### Architectural Recommendation

**Strategy**: Three-layer migration approach

**Layer 1: Config Compatibility** (`config.js`)
```javascript
// Maintain backward compatibility during transition
export function getToolboxes() {
  const config = readConfig()
  // Support both 'groups' (legacy) and 'toolboxes' (new)
  return config.toolboxes || config.groups || {}
}

export function addToolbox(name, servers) {
  const config = readConfig()
  if (!config.toolboxes) config.toolboxes = {}
  config.toolboxes[name] = servers

  // During transition: also update groups for backward compat
  if (!config.groups) config.groups = {}
  config.groups[name] = servers

  return writeConfig(config)
}

export function migrateGroupsToToolboxes() {
  const config = readConfig()
  if (config.groups && !config.toolboxes) {
    config.toolboxes = config.groups
    delete config.groups
    writeConfig(config)
  }
}

// Aliases for backward compatibility
export const addGroup = addToolbox
export const removeGroup = removeToolbox
export const getGroups = getToolboxes
```

**Layer 2: CLI Command Aliases** (`index.js`)
```javascript
// New primary command
program
  .command('toolbox')
  .description('Manage MCP toolboxes')
  .addCommand(new Command('add')...)
  .addCommand(new Command('remove')...)
  .addCommand(new Command('list')...)

// Backward-compatible alias (hidden from help)
program
  .command('groups')
  .description('(deprecated: use \'toolbox\') Manage MCP groups')
  .addCommand(new Command('add')...)  // Routes to same handler
  .addCommand(new Command('remove')...)
  .addCommand(new Command('list')...)

// Mark as hidden in help (Commander.js v10+ supports this)
program.commands.find(c => c._name === 'groups').hideHelp()
```

**Layer 3: Content Updates**
- Rename `/src/commands/groups.js` → `/src/commands/toolbox.js`
- Update CLI help/documentation to reference "toolbox"
- Deprecation notice in help for "groups" command

**Advantages of This Approach**:
- ✓ **Zero Breaking Changes**: Existing scripts using `mcpz groups` continue working
- ✓ **Graceful Transition**: Users can migrate at their own pace
- ✓ **Clean Config Storage**: New installations use 'toolboxes' key
- ✓ **No Data Loss**: Automatic migration path available

### 3.2 Feature: Plugin System for Claude Marketplace

**Requirement**: Support installing plugins from Claude marketplace

#### Architectural Constraints

Current architecture **does not support plugin loading**. All servers are stored in config file.

**Plugin Model Options**:

**Option A: Package-Based (Recommended)**
- Plugins are npm packages with `mcpz-plugin-*` naming
- Install via `npm install -g mcpz-plugin-myfeature`
- Entry point: `package.json` defines export path
- Plugin registers servers via config modification

**Option B: Directory-Based**
- Plugins stored in `~/.mcpz/plugins/`
- Each plugin in its own directory with manifest
- Plugin manifest describes servers to register

**Option C: Registry-Based**
- Central registry (like npm) of plugins
- `mcpz marketplace search/install/update`
- Plugins fetched and installed automatically

#### Recommendation: **Hybrid Approach (A + Minimal B)**

```
Architecture:
┌─────────────────────────────────────────────┐
│ Plugin Manager (new)                        │
├─────────────────────────────────────────────┤
│ - Discover packages (node_modules scan)     │
│ - Load manifests (package.json plugins key) │
│ - Register servers in config                │
│ - Manage lifecycle (enable/disable)         │
└─────────────────────────────────────────────┘
          ↓                          ↓
    package.json              ~/.mcpz/plugins/
    plugins: [...]            manifest.json
          ↓
    Config.js (extended)
    - servers[] (mixed: built-in + plugin)
    - plugins { id, enabled, version }
```

**New File: `/src/utils/pluginManager.js`**
```javascript
export class PluginManager {
  constructor() {
    this.plugins = new Map()
    this.loadPlugins()
  }

  /**
   * Discover plugins from node_modules and ~/.mcpz/plugins
   */
  loadPlugins() {
    // 1. Scan node_modules for mcpz-plugin-* packages
    const npmPlugins = this.#scanNodeModules()

    // 2. Scan ~/.mcpz/plugins for local manifests
    const localPlugins = this.#scanLocalPlugins()

    // 3. Register both types
    ;[...npmPlugins, ...localPlugins].forEach(plugin => {
      this.plugins.set(plugin.id, plugin)
    })
  }

  /**
   * Get all registered servers from enabled plugins
   */
  getPluginServers() {
    const servers = []
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        servers.push(...(plugin.servers || []))
      }
    }
    return servers
  }

  /**
   * Enable/disable a plugin
   */
  togglePlugin(pluginId, enabled) {
    const plugin = this.plugins.get(pluginId)
    if (plugin) {
      plugin.enabled = enabled
      this.#savePluginState()
    }
  }

  #scanNodeModules() { /* ... */ }
  #scanLocalPlugins() { /* ... */ }
  #savePluginState() { /* ... */ }
}
```

**New Command: `/src/commands/plugins.js`**
```javascript
export function listPlugins() {
  const manager = new PluginManager()
  // Display installed plugins, versions, enabled status
}

export function installPlugin(pluginName) {
  // Run npm install -g mcpz-plugin-<pluginName>
  // Run npm uninstall -g mcpz-plugin-<pluginName>
  // Reload plugins
}
```

**Config Evolution**:
```json
{
  "servers": [...],
  "toolboxes": {...},
  "plugins": {
    "mcpz-plugin-github": {
      "enabled": true,
      "version": "1.0.0"
    }
  }
}
```

**Integration with Config Layer**:
```javascript
// In config.js
export function getAllServers() {
  const config = readConfig()
  const builtInServers = config.servers || []

  const pluginManager = new PluginManager()
  const pluginServers = pluginManager.getPluginServers()

  return [...builtInServers, ...pluginServers]
}
```

### 3.3 Feature: Skill Support (agentskills.io)

**Requirement**: Support loading skills from agentskills.io marketplace

#### Understanding Skills vs. Plugins

- **Plugins**: Full server implementations (register new servers)
- **Skills**: Reusable tool definitions that can be composed into servers

**Architectural Difference**:
- Plugins modify `/servers` list
- Skills modify `/tools` list (tool definitions, not running processes)

#### Recommendation: **Separate Skill Manager**

**New File: `/src/utils/skillManager.js`**
```javascript
export class SkillManager {
  constructor() {
    this.skills = new Map()
    this.loadSkills()
  }

  /**
   * Fetch skill metadata from agentskills.io registry
   */
  async fetchSkillRegistry() {
    // GET https://agentskills.io/api/registry
    // Returns: { skills: [{ id, name, tools: [...] }] }
  }

  /**
   * Install a skill locally (~/.mcpz/skills/)
   */
  async installSkill(skillId) {
    // 1. Fetch skill definition from registry
    // 2. Save to ~/.mcpz/skills/{skillId}/manifest.json
    // 3. Register in config
  }

  /**
   * Get all installed skill tools
   */
  getSkillTools() {
    const skillTools = []
    for (const skill of this.skills.values()) {
      if (skill.enabled) {
        skillTools.push(...(skill.tools || []))
      }
    }
    return skillTools
  }

  /**
   * Convert skill tool to MCP tool schema
   */
  skillToolToMcpTool(skillTool) {
    // Map skill tool definition to @modelcontextprotocol/sdk tool format
    // This is crucial for compatibility
  }

  #loadSkills() { /* ... */ }
  #saveSkills() { /* ... */ }
}
```

**New Command: `/src/commands/skills.js`**
```javascript
export function listSkills() { /* ... */ }
export function installSkill(skillId) { /* ... */ }
export function searchSkills(query) { /* ... */ }
```

**Config Evolution**:
```json
{
  "servers": [...],
  "toolboxes": {...},
  "plugins": {...},
  "skills": {
    "skill-github-search": {
      "enabled": true,
      "version": "1.0.0"
    }
  }
}
```

**Key Integration Point - Tool Filtering**:
```javascript
// In server.js SettingsManager
getAvailableTools() {
  // Current: get tools from running servers
  const serverTools = this.#getServerTools()

  // New: add skill-provided tools
  const skillManager = new SkillManager()
  const skillTools = skillManager.getSkillTools()

  return [...serverTools, ...skillTools]
}
```

### 3.4 SDK Upgrade: @modelcontextprotocol/sdk 1.12.0 → 1.25.1

**Current Usage** (in `/src/server.js`):
```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js'
```

#### Breaking Changes Analysis

**Version Jump**: 1.12.0 → 1.25.1 is significant (13 minor versions)

Likely breaking changes:
1. **Tool Schema Format**: MCP spec evolved (draft-07 → draft-2020-12)
2. **Server/Client API**: Method signatures may have changed
3. **Resource Handling**: New resource template features
4. **Sampling**: New message sampling/cost tracking APIs

#### Mitigation Strategy

**Phase 1: Compatibility Layer** (New file `/src/utils/sdkAdapter.js`)
```javascript
// Abstract SDK version-specific code
export const SDK_VERSION = getPackageVersion('@modelcontextprotocol/sdk')

export async function createMcpServer(name, version) {
  if (SDK_VERSION.startsWith('1.12')) {
    return importFrom('1.12', () => new Server({...}))
  } else if (SDK_VERSION.startsWith('1.25')) {
    return importFrom('1.25', () => new Server({...}))
  }
}

export function convertToolSchema(tool) {
  // Convert tool schemas between SDK versions
  // Example: draft-07 input_schema → draft-2020-12
}

// Version-specific imports
function importFrom(version, factory) {
  try {
    return factory()
  } catch (error) {
    console.error(`SDK version ${version} compatibility error: ${error.message}`)
    throw error
  }
}
```

**Phase 2: Incremental Migration**
```
Step 1: Add SDK 1.25.1 to package.json alongside 1.12.0
Step 2: Test with adapter layer (route to correct version)
Step 3: Gradually migrate server.js to new SDK APIs
Step 4: Run comprehensive tests
Step 5: Drop 1.12.0 support, update to SDK 1.25.1 only
```

**Phase 3: Test Coverage**
```javascript
// In test/sdk-compat.test.js
describe('SDK Compatibility', () => {
  it('converts tool schema from draft-07 to draft-2020-12', () => {
    const oldSchema = { /* ... */ }
    const newSchema = convertToolSchema(oldSchema)
    // Verify schema is valid for new SDK
  })

  it('handles server creation in both SDK versions', () => {
    const server = createMcpServer('test', '1.0.0')
    assert(server instanceof Server)
  })
})
```

**Recommendation**: Create dedicated `/src/utils/sdkAdapter.js` before upgrading.

---

## 4. Architectural Recommendations Summary

### Priority 1: Before Implementation

1. **Create Abstraction Layer for SDK** (`/src/utils/sdkAdapter.js`)
   - Decouples server lifecycle from SDK version
   - Enables smoother upgrades
   - Allows testing against multiple SDK versions

2. **Extract Server Startup Logic** (refactor `/src/server.js`)
   - Move core MCP server setup into `/src/server/mcpServer.js`
   - Leave instance tracking in `/src/server.js`
   - Allows `interactive.js` to reuse logic directly

3. **Create Config Schema** (`/src/utils/configSchema.js`)
   - Define valid config structure (JSON schema)
   - Validate on read/write
   - Document config evolution for migrations

### Priority 2: For "Groups → Toolbox" Rename

1. **Backward Compatibility First**
   - Add new `getToolboxes()` / `addToolbox()` functions
   - Keep old `getGroups()` as aliases
   - Update config reader to support both keys

2. **Gradual Command Migration**
   - Add new `toolbox` command
   - Hide `groups` command from help
   - Document deprecation

3. **Config Migration Utility**
   - Add `mcpz toolbox migrate` command
   - Automatically convert `groups` → `toolboxes`
   - One-time operation, idempotent

### Priority 3: For Plugin & Skill Systems

1. **Separate Manager Classes**
   - `/src/utils/pluginManager.js` - manages server plugins
   - `/src/utils/skillManager.js` - manages tool skills
   - Both follow same pattern as InstanceManager

2. **Extend Config Schema**
   - Add `plugins` and `skills` keys to config
   - Version the config format (add `configVersion`)
   - Migration utilities for old formats

3. **API Registry Pattern**
   - Create abstraction for registry access (npm, agentskills.io)
   - Mock for testing
   - Support offline mode

### Priority 4: Testing Architecture

1. **Enhanced Test Isolation**
   - Use separate temp directories per test
   - Mock registry calls (don't hit real APIs in tests)
   - Test config migrations independently

2. **SDK Version Testing**
   - Run tests against SDK 1.12.0 and 1.25.1
   - Create compatibility matrix test
   - CI should test both versions

3. **Integration Tests**
   - Test plugin discovery and loading
   - Test skill installation flow
   - Test command pipelining (add server → create toolbox → run)

---

## 5. File Structure Proposal

```
/src
├── commands/
│   ├── index.js (unchanged - routes)
│   ├── add.js (unchanged)
│   ├── remove.js (unchanged)
│   ├── list.js (unchanged)
│   ├── use.js (unchanged)
│   ├── tools.js (unchanged)
│   ├── groups.js (RENAME → toolbox.js)
│   ├── toolbox.js (new - primary)
│   ├── plugins.js (new)
│   ├── skills.js (new)
│   ├── config.js (unchanged)
│   ├── help.js (updated - add plugin/skill docs)
│   ├── interactive.js (refactored)
│   └── update.js (unchanged)
├── server/
│   └── (NEW subdirectory)
│   ├── mcpServer.js (extracted from server.js)
│   └── index.js (main server entry, instance tracking)
├── utils/
│   ├── config.js (EXTENDED - add toolbox functions)
│   ├── configSchema.js (new)
│   ├── instanceManager.js (unchanged)
│   ├── pluginManager.js (new)
│   ├── skillManager.js (new)
│   ├── sdkAdapter.js (new)
│   ├── registryClient.js (new - abstract registry access)
│   ├── console.js (unchanged)
│   ├── log.js (unchanged)
│   └── updateChecker.js (unchanged)
├── index.js (entry point - unchanged)
├── build.js (unchanged)
└── server.js (REFACTORED - routes to server/index.js)

/test
├── groups.test.js (RENAME → toolbox.test.js)
├── toolbox.test.js (moved content)
├── plugins.test.js (new)
├── skills.test.js (new)
├── sdk-compat.test.js (new)
├── config-migration.test.js (new)
├── (other test files - unchanged)
└── fixtures/
    └── (test data - new)
```

---

## 6. Risk Analysis

### Identified Risks

**High Risk**:
- ⚠️ **SDK Upgrade Breaking Change**: Tool schema format change (draft-07 → draft-2020-12)
  - **Mitigation**: Adapter layer, comprehensive testing

- ⚠️ **Plugin Discovery**: Scanning node_modules may be slow
  - **Mitigation**: Cache results, lazy load plugins

**Medium Risk**:
- ⚠️ **Backward Compatibility**: Old "groups" config must work
  - **Mitigation**: Dual-key support in config, migration utility

- ⚠️ **Registry Availability**: agentskills.io may be down
  - **Mitigation**: Graceful degradation, local skill cache

**Low Risk**:
- ✓ **Command Naming**: "Toolbox" is clear and distinct
- ✓ **Test Isolation**: Temp directories prevent side effects

### Mitigated by Current Architecture

- ✓ **Loose Coupling**: Config changes isolated to one module
- ✓ **Modular Commands**: New commands don't break old ones
- ✓ **Test Patterns**: Established patterns for mocking/isolation

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1)
```
1. Create sdkAdapter.js (abstraction layer)
2. Create configSchema.js (config validation)
3. Create registryClient.js (abstract registry calls)
4. Update tests for new modules
```

### Phase 2: Groups → Toolbox (Week 2)
```
1. Extend config.js with getToolboxes/addToolbox functions
2. Rename groups.js → toolbox.js
3. Update index.js command registration
4. Update help and README
5. Add toolbox.test.js (migrated from groups.test.js)
6. Add config migration test
```

### Phase 3: Plugin System (Week 3)
```
1. Create pluginManager.js
2. Create plugins.js command
3. Update config schema to include plugins
4. Add plugin discovery tests
5. Update getAllServers() in config.js
```

### Phase 4: Skills Support (Week 4)
```
1. Create skillManager.js
2. Create skills.js command
3. Create registryClient implementation for agentskills.io
4. Update tool filtering in server.js
5. Add skill integration tests
```

### Phase 5: SDK Upgrade (Week 5)
```
1. Update package.json to SDK 1.25.1
2. Implement sdkAdapter.js fully
3. Update server.js to use adapter
4. Run all tests, fix breaking changes
5. Update SDK-specific tool schema conversion
```

### Phase 6: Integration & Polish (Week 6)
```
1. Integration tests (plugin discovery + tool schema)
2. Performance testing (plugin scanning)
3. Documentation updates
4. Interactive mode enhancements
5. Release notes and migration guide
```

---

## 8. Validation Checklist

Before implementing each phase:

- [ ] No breaking changes to CLI commands (backward compat verified)
- [ ] All existing tests pass
- [ ] New modules have test coverage (>80%)
- [ ] Config migrations are idempotent
- [ ] Error handling includes user-facing messages
- [ ] Documentation is updated
- [ ] Registry calls have offline fallback
- [ ] SDK adapter tested against both versions

---

## 9. Conclusion

The current CLI architecture provides a solid foundation for these enhancements. The main recommendations are:

1. **Create abstraction layers** (SDK, Registry) before adding complexity
2. **Maintain backward compatibility** throughout the transition
3. **Follow existing patterns** (InstanceManager model for PluginManager, SkillManager)
4. **Separate concerns** clearly (Plugins add servers, Skills add tools)
5. **Test thoroughly** especially around config migrations and SDK compatibility

The modular command structure will scale well to accommodate plugins and skills. The config layer needs modest extensions to support the new subsystems, but no fundamental redesign is required.

