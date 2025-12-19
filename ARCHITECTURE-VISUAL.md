# Architecture Visual Guide - mcpsx.run CLI

## Current Directory Structure

```
/src
├── index.js                    # Entry point, command registration
├── server.js                   # MCP server lifecycle management
├── build.js                    # Build and obfuscation script
│
├── commands/
│   ├── add.js                 # Add MCP server
│   ├── remove.js              # Remove MCP server
│   ├── list.js                # List servers
│   ├── use.js                 # Use specific server
│   ├── tools.js               # List available tools
│   ├── groups.js              # Manage groups (OLD)
│   ├── config.js              # Manage config paths
│   ├── help.js                # Display help
│   ├── interactive.js         # TUI with Ink/React
│   ├── update.js              # Check for updates
│   └── [NEW: toolbox.js]      # Manage toolboxes (renamed)
│       [NEW: plugins.js]      # Manage plugins
│       [NEW: skills.js]       # Manage skills
│
├── utils/
│   ├── config.js              # Config I/O and access
│   ├── instanceManager.js     # Track running instances
│   ├── console.js             # Console utilities
│   ├── log.js                 # Logging
│   ├── updateChecker.js       # Update checking
│   ├── [NEW: sdkAdapter.js]   # SDK abstraction layer
│   ├── [NEW: configSchema.js] # Schema validation
│   ├── [NEW: toolboxManager.js]  # Toolbox operations
│   ├── [NEW: pluginManager.js]   # Plugin management
│   ├── [NEW: skillManager.js]    # Skill management
│   └── [NEW: registryClient.js]  # Registry abstraction

/test
├── config.test.js
├── groups.test.js             # OLD - rename to toolbox.test.js
├── commands.test.js
├── instanceManager.test.js
├── tools.test.js
├── log.test.js
├── [NEW: toolbox.test.js]     # Renamed from groups.test.js
├── [NEW: sdk-compat.test.js]  # SDK compatibility tests
├── [NEW: config-migration.test.js]  # Migration tests
├── [NEW: plugins.test.js]     # Plugin tests
├── [NEW: skills.test.js]      # Skill tests
└── [NEW: fixtures/]           # Test data
    ├── old-config-1.0.json
    ├── old-config-1.1.json
    └── plugin-example/

/docs
├── ARCHITECTURE-ANALYSIS.md   # Detailed analysis (THIS FILE)
├── ARCHITECTURE-DECISIONS.md  # Formal ADRs
├── IMPLEMENTATION-GUIDE.md    # Code examples
├── ARCHITECTURE-SUMMARY.md    # Quick reference
└── ARCHITECTURE-VISUAL.md     # Visual guide (THIS FILE)
```

---

## Dependency Graph - Current State

```
┌─────────────────────────────────────────────┐
│         CLI Entry Point (index.js)          │
│     - Command registration (Commander)     │
│     - Routes to command handlers           │
└──────────────┬──────────────────────────────┘
               │
      ┌────────┴────────┬──────────────┐
      │                 │              │
      ▼                 ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Commands    │  │  Server      │  │  Utils       │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ add.js       │  │ server.js    │  │ config.js    │
│ remove.js    │  │              │  │ instanceMgr  │
│ list.js      │  │ (SettingsMgr)  │ console.js   │
│ use.js       │  │              │  │ log.js       │
│ tools.js     │  │ ↑            │  │ updateCheck  │
│ groups.js    │  │ @modelctx/sdk│  │ [NEW...]     │
│ config.js    │  │              │  │              │
│ help.js      │  │ InstanceMgr  │  │              │
│ interactive  │  │              │  │              │
│ update.js    │  └──────────────┘  └──────────────┘
└──────────────┘
      ▲
      │ (all use)
      └──────────── config.js (central hub)
                    instanceManager.js
```

**Issues with Current State**:
- ⚠️ Tight coupling to @modelcontextprotocol/sdk (server.js line 8)
- ⚠️ No abstraction for tool schema or SDK version
- ⚠️ No plugin or skill system

---

## Proposed Architecture After Implementation

```
┌────────────────────────────────────────────────┐
│           CLI Entry Point (index.js)           │
│    - Command registration (Commander.js)      │
│    - Routes to all command handlers           │
└──────────────┬─────────────────────────────────┘
               │
    ┌──────────┼──────────┬────────────┬──────────┐
    │          │          │            │          │
    ▼          ▼          ▼            ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Config │ │ Server │ │Toolbox │ │Plugin  │ │ Skill  │
│Commands│ │Commands│ │Commands│ │Commands│ │Commands│
└────────┘ └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘
               │           │          │          │
               ▼           ▼          ▼          ▼
         ┌─────────────────────────────────────────────┐
         │      Config Layer (single source truth)    │
         ├─────────────────────────────────────────────┤
         │ config.js                                  │
         │  - readConfig() / writeConfig()            │
         │  - getServers() / addServer()              │
         │  - getToolboxes() / addToolbox()    [NEW]  │
         │  - getAllServers()                 [NEW]   │
         │    (includes plugin servers)               │
         └──┬──┬──┬──────────────────────────┬────────┘
            │  │  │                          │
            │  │  └──────────────┬───────────┘
            │  │                 ▼
            │  │         ┌──────────────────┐
            │  │         │ Config Managers  │
            │  │         ├──────────────────┤
            │  │         │ToolboxManager[NEW]
            │  │         │PluginManager[NEW]
            │  │         │ SkillManager[NEW]
            │  │         └──────────────────┘
            │  │
            │  ▼
      ┌────────────────────┐
      │ Schema Validation  │
      ├────────────────────┤
      │ configSchema.js[NEW]
      │  - validateConfig()
      │  - normalizeConfig()
      └────────────────────┘
            │
            ▼
    ┌──────────────────────┐
    │  Core Abstraction    │
    ├──────────────────────┤
    │ sdkAdapter.js [NEW]  │
    │  - createMcpServer() │
    │  - createToolSchema()│
    │  - convertSchema()   │
    └──────────────────────┘
            │
            ├─────────────────────────┐
            ▼                         ▼
    ┌──────────────┐        ┌──────────────────┐
    │ SDK v1.12.0  │        │ SDK v1.25.1      │
    │ (old)        │   OR   │ (new)            │
    └──────────────┘        └──────────────────┘
            │                       │
            └─────────┬─────────────┘
                      ▼
            ┌──────────────────────┐
            │  Running Processes   │
            ├──────────────────────┤
            │ instanceManager.js   │
            │  - register()        │
            │  - list()            │
            │  - cleanup()         │
            └──────────────────────┘

┌─────────────────────────────────────────────────┐
│         External Integration Points [NEW]       │
├─────────────────────────────────────────────────┤
│ registryClient.js - abstract registry access   │
│  ├─ NpmRegistry (mcpz-plugin-*)                │
│  ├─ AgentSkillsRegistry (agentskills.io)       │
│  └─ LocalRegistry (~/.mcpz/)                   │
└─────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Adding a Server (Existing)

```
User Input: mcpz add "My Server" --command "node" --args "server.js"
                     │
                     ▼
           add.js (command handler)
           - Parse arguments
           - Get server name and options
           - Create server object
                     │
                     ▼
           config.js (addServer)
           - Read current config
           - Add new server to servers[]
           - Write back to file
                     │
                     ▼
         ~/.mcpz/config.json (updated)
                     │
                     ▼
           User sees: "Server added successfully"
```

### Creating a Toolbox (New)

```
User Input: mcpz toolbox add "python-stack" --servers="python,numpy,scipy"
                     │
                     ▼
       toolbox.js (command handler) [NEW]
       - Parse arguments
       - Validate server names exist
       - Create toolbox definition
                     │
                     ▼
       ToolboxManager.add()  [NEW]
       - Read current config
       - Add to toolboxes object
       - Write back to file
                     │
                     ▼
       ~/.mcpz/config.json
       {
         "toolboxes": {
           "python-stack": ["python", "numpy", "scipy"]
         }
       }
                     │
                     ▼
       User sees: "Toolbox 'python-stack' created"
```

### Installing a Plugin (New)

```
User Input: mcpz plugins install github
                     │
                     ▼
     plugins.js (command handler) [NEW]
     - Parse plugin name
     - Normalize to mcpz-plugin-github
                     │
                     ▼
     PluginManager.installPlugin()  [NEW]
     - Run: npm install -g mcpz-plugin-github
     - Reload plugin discovery
                     │
                     ▼
      PluginManager.loadPlugins()  [NEW]
      - Scan node_modules/
      - Find mcpz-plugin-github/
      - Load manifest.json
      - Extract servers list
                     │
                     ▼
     register servers in config.servers[]
     (auto-merged by getAllServers())
                     │
                     ▼
     User sees: "Plugin installed, 3 servers available"
```

### Running with Toolbox (Combined)

```
User Input: mcpz run --toolbox python-stack --tools "predict,generate"
                     │
                     ▼
         server.js (run handler)
         - Get toolbox name: "python-stack"
         - Expand via config.expandServerOrGroup()
                     │
                     ▼
      ToolboxManager.expand("python-stack")  [NEW]
      Returns: ["python", "numpy", "scipy"]
                     │
                     ▼
      Get all servers (built-in + plugins)
      config.getAllServers()  [NEW]
      - reads config.servers[]
      - calls pluginManager.getPluginServers()
      - merges both lists
                     │
                     ▼
      Filter to servers: ["python", "numpy", "scipy"]
      Filter tools: ["predict", "generate"]
                     │
                     ▼
      Load tool skills (add to available tools)
      skillManager.getSkillTools()  [NEW]
                     │
                     ▼
      Start MCP server with filtered servers/tools
      via sdkAdapter.createMcpServer()  [NEW]
                     │
                     ▼
      InstanceManager.register(...)
      Track running instance
                     │
                     ▼
      Server running with combined capabilities
```

---

## Module Interaction Matrix

Shows which modules interact with each other:

```
                add  remove list  tools groups toolbox plugin skill sdkAdapt config instMgr
add.js           ·     │    │      ·      ·      ·       ·      ·     ·       ✓      ·
remove.js        │     ·    │      ·      ·      ·       ·      ·     ·       ✓      ·
list.js          │     │    ·      ·      ·      ·       ·      ·     ·       ✓      ·
tools.js         ·     ·    ·      ·      ·      ·       ·      ·     ·       ✓      ·
groups.js        ·     ·    ·      ·      ·      ✓       ·      ·     ·       ✓      ·
toolbox.js[NEW]  ·     ·    ·      ·      ·      ·       ·      ·     ·       ✓      ·
plugins.js[NEW]  ·     ·    ·      ·      ·      ·       ·      ·     ·       ✓      ✓
skills.js[NEW]   ·     ·    ·      ·      ·      ·       ·      ·     ·       ✓      ·
server.js        ·     ·    ·      ✓      ·      ·       ✓      ✓     ✓       ✓      ✓
interactive.js   ✓     ✓    ✓      ✓      ·      ✓       ✓      ✓     ·       ✓      ✓
─────────────────────────────────────────────────────────────────────────────────────
configSchema.js· │      │    ·      ·      ·      ·       ·      ·     ·       ·      ·
pluginManager[NEW] ·    ·    ·      ·      ·      ·       ·      ·     ·       ✓      ·
skillManager[NEW]  ·    ·    ·      ·      ·      ·       ·      ·     ·       ✓      ·
sdkAdapter[NEW]    ·    ·    ·      ✓      ·      ·       ·      ·     ·       ·      ✓
registryClient[NEW]·    ·    ·      ·      ·      ·       ✓      ✓     ·       ·      ·

Legend:
·  = no interaction
│  = may read
✓  = direct dependency/interaction
```

---

## Coupling Strength Analysis

Lower is better. Shows how tightly modules are coupled:

### Current State (Before Refactoring)

```
Coupling Strength (0=none, 10=tightly coupled):

server.js ↔ @modelctx/sdk:        [████████████████] 9/10  (PROBLEM!)
server.js ↔ config.js:            [██████████] 6/10
server.js ↔ instanceManager.js:   [████] 3/10
commands/* ↔ config.js:           [██████████] 6/10
interactive.js ↔ CLI process:     [████████████] 8/10  (subprocess spawn)
```

### After Refactoring (Proposed)

```
Coupling Strength (0=none, 10=tightly coupled):

server.js ↔ sdkAdapter.js:        [██] 2/10  (GOOD!)
sdkAdapter ↔ @modelctx/sdk:      [████████████████] 9/10  (isolated here)
server.js ↔ config.js:            [████] 3/10
server.js ↔ instanceManager.js:   [████] 3/10
server.js ↔ pluginManager.js:     [██] 2/10
server.js ↔ skillManager.js:      [██] 2/10
commands/* ↔ config.js:           [████] 3/10  (improved from 6/10)
interactive.js ↔ commands:        [████] 3/10  (direct import, no subprocess)
registryClient ↔ npm/agentskills: [████████] 8/10  (isolated here)
```

---

## Responsibility Layers

Clear separation from data to presentation:

```
┌─────────────────────────────────────────────────┐
│           User Interaction Layer               │
│   index.js (Commander.js) → CLI parsing        │
│   interactive.js → TUI (Ink/React)             │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│          Command Handler Layer                 │
│   add.js, remove.js, list.js, ...              │
│   toolbox.js [NEW], plugins.js [NEW], ...      │
│   Pure functions - input validation only       │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│        Management & Business Logic Layer       │
│   ToolboxManager [NEW] → toolbox operations    │
│   PluginManager [NEW] → plugin discovery       │
│   SkillManager [NEW] → skill management        │
│   InstanceManager → process tracking           │
│   Registry client [NEW] → registry abstraction │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│        Configuration & Schema Layer            │
│   config.js → read/write operations            │
│   configSchema.js [NEW] → validation           │
│   sdkAdapter.js [NEW] → SDK abstraction        │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│          External Integration Layer            │
│   @modelctx/sdk → MCP protocol                 │
│   npm/agentskills API → registries             │
│   Filesystem → ~/.mcpz/ directories            │
│   Child process → npm commands                 │
└─────────────────────────────────────────────────┘
```

Each layer depends only on layers below it. No upward dependencies.

---

## Configuration Evolution

How config structure evolves with new features:

```
Version 1.0 (Initial)
─────────────────
{
  "servers": [...]
}

Version 1.1 (Groups Added)
──────────────────────────
{
  "servers": [...],
  "groups": {
    "groupName": ["server1", "server2"]
  }
}

Version 1.2 (Toolbox + Plugins) [NEW]
──────────────────────────────────────
{
  "servers": [...],
  "toolboxes": {           ← renamed from "groups"
    "toolboxName": [...]
  },
  "plugins": {             ← NEW
    "mcpz-plugin-id": {
      "enabled": true,
      "version": "1.0.0"
    }
  }
}

Version 1.3 (Skills Added) [NEW]
─────────────────────────────────
{
  "servers": [...],
  "toolboxes": {...},
  "plugins": {...},
  "skills": {              ← NEW
    "skill-id": {
      "enabled": true,
      "version": "1.0.0"
    }
  },
  "configVersion": "1.3"   ← explicit version tracking
}
```

Migration path is automatic or one-command:
- 1.0 → 1.1: groups added (no migration needed)
- 1.1 → 1.2: `mcpz toolbox migrate` (renames groups→toolboxes)
- 1.2 → 1.3: automatic (plugins key empty until plugins installed)

---

## Testing Architecture

How tests organize to cover all layers:

```
Unit Tests (Fast)
────────────────
/test/unit/
├── configSchema.test.js      ← Validate schema rules
├── toolboxManager.test.js    ← Individual manager methods
├── pluginManager.test.js
├── skillManager.test.js
└── sdkAdapter.test.js        ← SDK abstraction

Integration Tests (Medium Speed)
────────────────────────────────
/test/integration/
├── config-migration.test.js  ← Version upgrade paths
├── feature-composition.test.js ← Combined features
└── end-to-end.test.js        ← Full workflows

Compatibility Tests (Version-specific)
──────────────────────────────────────
/test/compat/
├── sdk-1.12.0.test.js        ← SDK version testing
├── sdk-1.25.1.test.js
└── schema-conversion.test.js  ← Draft-07 ↔ draft-2020-12

Test Fixtures
─────────────
/test/fixtures/
├── old-config-1.0.json       ← Test data
├── old-config-1.1.json
├── plugin-example/           ← Mock plugins
└── skill-example/            ← Mock skills
```

---

## Deployment & Release Flow

How changes flow through the system:

```
Developer commits code
        │
        ▼
GitHub PR (automated checks)
├─ lint: ESLint
├─ tests: unit + integration
├─ coverage: >85%
└─ compat: SDK 1.12.0 + 1.25.1
        │
        ▼ (if all pass)
Merge to main
        │
        ▼
Build process (build.js)
├─ Copy files to /dist
├─ Obfuscate JS
├─ Copy package.json
└─ Ready for publish
        │
        ▼
npm publish
├─ @mcpz/cli@X.Y.Z (public)
└─ @mcpz/cli@X.Y.Z-dev (optional dev version)
        │
        ▼
Users: npm install -g @mcpz/cli
       npm update -g @mcpz/cli
       npx @mcpz/cli
```

---

## Conclusion

The proposed architecture maintains the CLI's strengths while adding:
- **Clear abstraction layers** (SDK, config, registry)
- **Extensibility** (plugins, skills)
- **Backward compatibility** (groups→toolbox migration)
- **Type safety** (config validation)
- **Testability** (multi-layer testing strategy)

All without breaking existing functionality or creating circular dependencies.

