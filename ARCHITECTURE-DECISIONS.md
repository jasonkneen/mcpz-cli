# Architecture Decision Records (ADRs) - mcpsx.run CLI

Decision records for major architectural choices related to upcoming features.

---

## ADR-001: Groups → Toolbox Rename Strategy

**Status**: RECOMMENDED

**Context**:
- Current naming ("groups") is ambiguous with other grouping concepts
- Need to rename to "toolbox/toolboxes" without breaking existing installations
- Multiple versions of mcpz CLI in the wild

**Decision**:
Implement three-layer migration strategy:
1. **Config Layer**: Support both `groups` and `toolboxes` keys; new writes use `toolboxes`
2. **CLI Layer**: New command `toolbox`, old `groups` command hidden but functional
3. **User Layer**: Automatic migration tool available (`mcpz toolbox migrate`)

**Rationale**:
- **Zero breaking changes**: Existing scripts continue working
- **Clean transition**: Users migrate at their own pace
- **Forward compatible**: New installations use only `toolboxes`
- **Discoverable**: Migration command makes path obvious
- **Idempotent**: Can be run multiple times safely

**Alternatives Considered**:

1. **Cold cut - remove groups entirely**
   - ❌ Breaks existing scripts
   - ❌ Poor user experience
   - ✓ Cleaner codebase

2. **Dual commands side-by-side**
   - ✓ Simple to implement
   - ❌ Confuses users (which to use?)
   - ❌ Doubles maintenance burden

3. **Version-based compatibility**
   - ✓ Clear migration path
   - ❌ Complex versioning logic
   - ❌ Hard to test all combinations

**Selected**: Three-layer approach

**Implementation**:
- File: `/src/utils/toolboxManager.js` - Core logic
- File: `/src/commands/toolbox.js` - CLI commands
- File: `/test/toolbox.test.js` - Tests including migration
- Update: `/src/index.js` - Register new command and hidden alias

**Success Criteria**:
- [ ] Old `mcpz groups` commands still work
- [ ] New `mcpz toolbox` command is primary interface
- [ ] `mcpz toolbox migrate` works correctly
- [ ] Config stored with `toolboxes` key (new installations)
- [ ] No data loss during migration
- [ ] All tests pass for both old and new APIs

---

## ADR-002: SDK Abstraction Layer

**Status**: RECOMMENDED (BEFORE upgrading to 1.25.1)

**Context**:
- Current server.js tightly coupled to `@modelcontextprotocol/sdk@1.12.0`
- Need to upgrade to 1.25.1 (major version jump, likely breaking changes)
- Tool schema format changed (draft-07 → draft-2020-12)
- Multiple uses of SDK throughout codebase

**Decision**:
Create `/src/utils/sdkAdapter.js` that abstracts all SDK interactions. Pattern:

```javascript
// Instead of:
import { Server } from '@modelcontextprotocol/sdk/...'

// Use:
import { createMcpServer, createToolSchema } from './utils/sdkAdapter.js'
const server = await createMcpServer('name', '1.0.0')
```

**Rationale**:
- **Version independence**: Can upgrade SDK without touching server.js
- **Schema conversion**: Handle draft-07 ↔ draft-2020-12 conversion
- **Testable**: Test adapter against multiple SDK versions
- **Maintainable**: All SDK-specific code in one place
- **Reversible**: Easy to support multiple SDK versions if needed

**Alternatives Considered**:

1. **Direct upgrade - no abstraction**
   - ✓ Simpler initially
   - ❌ Scattered changes across codebase
   - ❌ Harder to test compatibility
   - ❌ Risky upgrade path

2. **Dependency injection pattern**
   - ✓ Very flexible
   - ❌ Complex for this use case
   - ❌ Overkill for abstracting one dependency

3. **Adapter with version detection**
   - ✓ Supports multiple SDK versions simultaneously
   - ❌ More complex adapter logic
   - ✓ Selected for initial implementation

**Selected**: SDK Adapter with version detection

**Implementation**:
- File: `/src/utils/sdkAdapter.js` - Abstraction layer
- Updates: `/src/server.js` - Use adapter instead of direct imports
- Tests: `/test/sdk-compat.test.js` - Verify compatibility
- Schema conversion: Handle draft-07 ↔ draft-2020-12

**Success Criteria**:
- [ ] No direct SDK imports in server.js
- [ ] All SDK imports routed through adapter
- [ ] Tool schema conversion working in both directions
- [ ] Tests pass against SDK 1.12.0 and 1.25.1
- [ ] Upgrade to 1.25.1 involves only changing adapter

**Upgrade Timeline**:
1. Create adapter (test against 1.12.0)
2. Refactor server.js to use adapter
3. Add SDK 1.25.1 to package.json (alongside 1.12.0)
4. Update adapter to support both versions
5. Test thoroughly
6. Update adapter to use 1.25.1 as primary
7. Remove 1.12.0 support

---

## ADR-003: Plugin System Architecture

**Status**: RECOMMENDED

**Context**:
- Need to support Claude marketplace plugins
- Plugins should provide additional servers
- Users should be able to install/uninstall plugins
- Plugins are separate from core servers
- Need clear boundary between built-in and plugin servers

**Decision**:
Implement PluginManager class that:
1. **Discovers** plugins in two locations:
   - npm: `mcpz-plugin-*` packages installed globally
   - Local: `~/.mcpz/plugins/*/manifest.json` files
2. **Loads** plugin metadata (servers, tools, config)
3. **Manages** plugin state (enabled/disabled)
4. **Registers** plugin servers in combined server list

```
PluginManager (Singleton)
├── #discoverNpmPlugins() → scan node_modules
├── #discoverLocalPlugins() → scan ~/.mcpz/plugins
├── getPluginServers() → combined server list
└── togglePlugin(id, enabled)
```

**Rationale**:
- **Discoverable**: Plugins follow standard naming convention
- **Installable**: Use npm for distribution (proven ecosystem)
- **Local fallback**: Can install from filesystem for development
- **Isolated**: Plugin metadata separate from core config
- **Extensible**: Easy to add new plugin types later
- **Consistent**: Follows InstanceManager and SkillManager patterns

**Alternatives Considered**:

1. **Registry-based (like VSCode)**
   - ✓ Centralized discovery
   - ❌ Requires separate service
   - ❌ Dependencies on external system

2. **Directory-based only**
   - ✓ Self-contained
   - ❌ Poor discoverability
   - ❌ No version management

3. **Manifest file in ~/.mcpz**
   - ✓ Centralized tracking
   - ❌ Complex state management
   - ❌ Difficult to keep in sync with npm

**Selected**: npm + local fallback discovery

**Implementation**:
- File: `/src/utils/pluginManager.js` - Core class
- File: `/src/commands/plugins.js` - CLI commands (install, list, enable/disable)
- Update: `/src/index.js` - Register `plugins` command
- Update: `/src/utils/config.js` - add `getAllServers()` that includes plugin servers

**Plugin Manifest Format** (in package.json or manifest.json):
```json
{
  "name": "mcpz-plugin-github",
  "version": "1.0.0",
  "mcpz": {
    "servers": [
      {
        "name": "github-api",
        "command": "node",
        "args": ["server.js"]
      }
    ]
  }
}
```

**Success Criteria**:
- [ ] Plugins discoverable from npm packages
- [ ] Local plugin directory supported
- [ ] Plugin state persisted in config
- [ ] `mcpz plugins list` shows all plugins
- [ ] `mcpz plugins install <name>` works
- [ ] `mcpz plugins uninstall <name>` works
- [ ] Plugin servers available in `mcpz run`
- [ ] Tests cover discovery, loading, state management

---

## ADR-004: Skills vs. Plugins Distinction

**Status**: RECOMMENDED

**Context**:
- Need to support both Claude plugins (servers) and agentskills.io skills (tools)
- Skills are tool definitions, plugins provide server implementations
- Need clear architectural boundary between the two
- Skill registry (agentskills.io) is different from npm

**Decision**:
Create separate managers with different responsibilities:

**PluginManager**:
- Discovers: npm packages (`mcpz-plugin-*`)
- Manages: Server implementations
- Outputs: Additional servers added to config.servers
- Registry: npm

**SkillManager**:
- Discovers: Local skills in `~/.mcpz/skills/`
- Manages: Tool definitions (not servers)
- Outputs: Additional tools for use in servers
- Registry: agentskills.io API

**Key Distinction**:
```
Plugin (adds servers):     Skill (adds tools):
┌──────────────────┐       ┌──────────────────┐
│ Plugin Server    │       │ Tool Definition  │
│ - command        │       │ - inputSchema    │
│ - args           │       │ - outputSchema   │
│ - env vars       │       │ - description    │
└──────────────────┘       └──────────────────┘
     ↓                             ↓
  runs independently          used by servers
  implements MCP               provides tools
```

**Rationale**:
- **Separation**: Clear distinction in mental model
- **Composition**: Plugins provide services, skills enhance tools
- **Lifecycle**: Different update/version management
- **Registries**: Different sources (npm vs agentskills.io)
- **Config**: Both stored in config but separate keys

**Alternatives Considered**:

1. **Unified system - "Extensions"**
   - ✓ Single abstraction
   - ❌ Conflates two distinct concepts
   - ❌ Confusing mental model

2. **Skills as special plugins**
   - ✓ Reuse plugin infrastructure
   - ❌ Breaks separation of concerns
   - ❌ Hard to model tool composition

**Selected**: Separate managers with clear roles

**Implementation**:
- File: `/src/utils/pluginManager.js` - Servers
- File: `/src/utils/skillManager.js` - Tools
- File: `/src/commands/plugins.js` - Plugin commands
- File: `/src/commands/skills.js` - Skill commands
- Both: Follow singleton pattern
- Both: Persist state in config under `plugins` and `skills` keys

**Config Structure**:
```json
{
  "servers": [...],
  "toolboxes": {...},
  "plugins": {
    "mcpz-plugin-github": { "enabled": true, "version": "1.0.0" }
  },
  "skills": {
    "skill-web-search": { "enabled": true, "version": "1.0.0" }
  }
}
```

**Success Criteria**:
- [ ] PluginManager and SkillManager are independent
- [ ] Plugins add to servers list
- [ ] Skills add to tools list
- [ ] Config properly separates plugins and skills
- [ ] Tests verify distinction and composition
- [ ] Help text clearly explains difference

---

## ADR-005: Configuration Schema Versioning

**Status**: RECOMMENDED

**Context**:
- Config structure changing with new features (groups→toolboxes, plugins, skills)
- Need to support config migrations
- Don't want to break old configs
- Need validation and clear error messages

**Decision**:
Implement config versioning with:
1. **Schema definition**: JSON Schema for each version
2. **Validation**: Validate on read/write
3. **Migrations**: Functions to upgrade from version N to N+1
4. **Idempotency**: Migrations safe to run multiple times

**Config versions**:
- `1.0`: Initial (servers only)
- `1.1`: Added groups
- `1.2`: Renamed groups→toolboxes, added plugins
- `1.3`: Added skills

**Rationale**:
- **Clarity**: Explicit versions prevent confusion
- **Validation**: Catch config errors early
- **Automation**: Migrations can be transparent
- **Rollback**: Can detect and handle version mismatches
- **Documentation**: Version comments explain changes

**Alternatives Considered**:

1. **No versioning**
   - ✓ Simpler initially
   - ❌ Hard to handle schema evolution
   - ❌ No way to validate config

2. **Single schema (always forward-compatible)**
   - ✓ Simple
   - ❌ Doesn't handle breaking changes
   - ❌ Schema becomes messy with optional fields

**Selected**: Explicit versioning with JSON schemas

**Implementation**:
- File: `/src/utils/configSchema.js` - Schema definitions and validators
- Update: `/src/utils/config.js` - Add validation on read/write
- Add: `/src/utils/configMigrator.js` - Migration functions
- Tests: `/test/config-migration.test.js` - Test all migration paths

**Success Criteria**:
- [ ] Config version detected and validated
- [ ] Migrations are idempotent
- [ ] Old config formats supported
- [ ] Validation prevents invalid configs
- [ ] Error messages guide users
- [ ] All migration paths tested

---

## ADR-006: Test Architecture for Multi-Version Support

**Status**: RECOMMENDED

**Context**:
- Need to test against multiple SDK versions
- Need to test config migrations
- Need to test plugin discovery
- Don't want to mock external registry calls in unit tests

**Decision**:
Use three-tier test architecture:

**Tier 1: Unit Tests** (Isolated, no external deps)
- Test individual classes/functions
- Mock external calls (registry, filesystem) where needed
- Use temp directories for config isolation
- Fast execution

**Tier 2: Integration Tests** (Realistic scenarios)
- Test combinations of features
- Use real config files (in temp directories)
- Test plugin discovery from filesystem
- Mock only network calls

**Tier 3: Compatibility Tests** (Version verification)
- Test against multiple SDK versions
- Test config migrations from old to new
- Test schema conversions

**File structure**:
```
/test
├── unit/
│   ├── config.test.js
│   ├── toolboxManager.test.js
│   ├── pluginManager.test.js
│   └── skillManager.test.js
├── integration/
│   ├── sdk-compat.test.js
│   ├── config-migration.test.js
│   └── feature-composition.test.js
├── fixtures/
│   ├── old-config-1.0.json
│   ├── old-config-1.1.json
│   └── plugin-example/
└── helpers.js
```

**Rationale**:
- **Maintainability**: Clear test organization
- **Speed**: Unit tests run fast, integration tests run less often
- **Confidence**: Multiple levels catch different issues
- **Isolation**: Temp directories prevent test pollution
- **Mocking**: Strategy depends on test type

**Alternatives Considered**:

1. **All integration tests**
   - ✓ Tests realistic scenarios
   - ❌ Slow to run
   - ❌ Hard to debug failures

2. **All unit tests with heavy mocking**
   - ✓ Fast
   - ❌ May not catch real issues
   - ❌ Tests mock, not actual behavior

**Selected**: Three-tier architecture

**Implementation**:
- Reorganize `/test` with subdirectories
- Update test commands in package.json
- Add `test:unit`, `test:integration`, `test:compat`
- Add test helpers in `/test/helpers.js`

**Success Criteria**:
- [ ] Tests organized by type
- [ ] Unit tests run in <5s
- [ ] Integration tests realistic
- [ ] Compatibility tests cover version migrations
- [ ] CI runs all test tiers
- [ ] Config temp directories don't leak

---

## ADR-007: Interactive Mode Refactoring

**Status**: RECOMMENDED (as part of larger refactoring)

**Context**:
- Current interactive.js spawns child process running CLI
- Creates circular invocation
- Replicates command logic
- Hard to maintain code shared between interactive and CLI

**Decision**:
Extract core command logic from CLI and make available for reuse:

**Before**:
```
interactive.js → spawn('mcpz add ...') → index.js/commands/add.js
```

**After**:
```
index.js (CLI) → commands/add.js
            ↖️
interactive.js → commands/add.js (direct import)
```

**Rationale**:
- **No duplication**: Logic lives in one place
- **No spawning**: Direct function calls faster
- **Easier testing**: Can test interactive mode directly
- **Maintainability**: Changes to commands apply everywhere

**Alternatives Considered**:

1. **Keep spawning**
   - ✓ Isolation
   - ❌ Slow
   - ❌ Duplicated logic

2. **Expose HTTP API**
   - ✓ Decoupled
   - ❌ Overkill for this use case
   - ❌ Adds complexity

**Selected**: Direct command reuse

**Implementation**:
- No changes needed initially (optional future enhancement)
- Commands already designed as reusable functions
- Interactive.js can import and call commands directly

---

## Decision Dependency Map

```
ADR-002 (SDK Adapter)
  ↓ (required before)
ADR-004 (Skills vs Plugins)
  ↓
ADR-005 (Config Versioning)

ADR-001 (Groups → Toolbox)
  ↓
ADR-003 (Plugin System)
  ↓
ADR-006 (Test Architecture)
  ↓
ADR-007 (Interactive Refactoring)
```

**Recommended Implementation Order**:
1. ADR-002: SDK Adapter (foundation)
2. ADR-005: Config Versioning (enables migrations)
3. ADR-001: Groups → Toolbox (leverages config versioning)
4. ADR-003: Plugin System (reuses patterns)
5. ADR-004: Skills System (mirrors plugin system)
6. ADR-006: Test Architecture (covers all above)
7. ADR-007: Interactive Refactoring (polish)

---

## Review & Approval

- [ ] Reviewed by architecture team
- [ ] Consensus on approach
- [ ] No unresolved conflicts
- [ ] Approved for implementation

