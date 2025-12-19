# Architecture Analysis Summary - mcpsx.run CLI

## Quick Reference

This document summarizes the architectural analysis and provides actionable next steps.

---

## Current State Assessment

### Strengths (Keep These!)

**Architecture Quality**:
- ✓ Clear separation of concerns (commands, config, instance tracking)
- ✓ Modular design with single responsibility per file
- ✓ SOLID principles mostly followed (especially S, I, L)
- ✓ Minimal coupling between components
- ✓ Excellent test coverage patterns (temp dirs, console mocking)

**Code Organization**:
- ✓ Commands are pure functions (easy to test and reuse)
- ✓ Config layer is centralized (single source of truth)
- ✓ Instance tracking is well isolated (singleton pattern)
- ✓ Clean error handling (console output, consistent logging)

**Extensibility**:
- ✓ New commands can be added without modifying core
- ✓ Config can be extended with new keys
- ✓ Test patterns are reusable

### Weaknesses (Fix These!)

**Coupling Issues**:
- ⚠️ server.js directly imports @modelcontextprotocol/sdk (tight version coupling)
- ⚠️ interactive.js spawns child process running CLI (circular invocation)
- ⚠️ Console output tightly coupled to all commands (hard to parse programmatically)

**Missing Abstractions**:
- ⚠️ No registry abstraction (can't easily swap npm for agentskills.io)
- ⚠️ No config schema validation (can't detect invalid configs early)
- ⚠️ No plugin/skill system (not architected for extensibility)

**Testing Gaps**:
- ⚠️ No compatibility testing across SDK versions
- ⚠️ No migration testing (will be needed for groups→toolbox)
- ⚠️ No multi-version config validation

---

## Implementation Priority

### Phase 1: Foundation (Critical - Do First)
These form the base for all other features.

#### 1a. Create SDK Adapter (`/src/utils/sdkAdapter.js`)
**Why**: SDK 1.25.1 upgrade will break without this
**Time**: 2-3 hours
**Impact**: Unblocks SDK upgrade, reduces refactoring needed elsewhere
```javascript
// File size: ~200 lines
// Key functions: createMcpServer, createToolSchema, convertToolSchema, getSdkVersion
// Tests: sdk-compat.test.js
```

#### 1b. Create Config Schema (`/src/utils/configSchema.js`)
**Why**: Needed for validation and migrations
**Time**: 3-4 hours
**Impact**: Enables safe config evolution, catches user errors
```javascript
// File size: ~300 lines
// Key functions: validateConfig, normalizeConfig, getMigrationPath
// Tests: config-migration.test.js
```

### Phase 2: Rename Feature (Medium Priority)
Depends on Phase 1 foundation.

#### 2a. Create Toolbox Manager (`/src/utils/toolboxManager.js`)
**Why**: Core logic for groups→toolbox migration
**Time**: 2 hours
**Impact**: Zero-breaking-changes rename possible
```javascript
// File size: ~150 lines
// Key functions: add, remove, get, expand, migrateGroupsToToolboxes
// Tests: toolbox.test.js (renamed from groups.test.js)
```

#### 2b. Update CLI Commands
**Why**: Make "toolbox" primary, hide "groups"
**Time**: 1 hour
**Impact**: Clean public API, transparent migration
```javascript
// Changes to: /src/index.js (command registration)
// Changes to: /src/commands/toolbox.js (renamed from groups.js)
// New: /src/commands/toolbox.js with migrate subcommand
```

### Phase 3: Plugin System (Higher Priority)
Depends on Phase 1 foundation.

#### 3a. Create Plugin Manager (`/src/utils/pluginManager.js`)
**Why**: Required for Claude marketplace integration
**Time**: 4-5 hours
**Impact**: Opens extensibility, enables plugin ecosystem
```javascript
// File size: ~400 lines
// Key functions: loadPlugins, discoverNpmPlugins, getPluginServers, installPlugin
// Tests: plugins.test.js
```

#### 3b. Add Plugins Command (`/src/commands/plugins.js`)
**Why**: User interface for plugin management
**Time**: 2 hours
**Impact**: Users can discover and install plugins
```javascript
// File size: ~150 lines
// Commands: list, install, uninstall, enable, disable
```

### Phase 4: Skills Support (Lower Priority Initially)
Depends on Phase 1 foundation, mirrors Phase 3.

#### 4a. Create Skill Manager (`/src/utils/skillManager.js`)
**Why**: Support agentskills.io marketplace
**Time**: 4-5 hours
**Impact**: Composable tool ecosystem
```javascript
// File size: ~350 lines
// Similar structure to PluginManager but for tools
// Tests: skills.test.js
```

#### 4b. Registry Client (`/src/utils/registryClient.js`)
**Why**: Abstract registry access (npm vs agentskills.io)
**Time**: 3 hours
**Impact**: Easy to add new registries
```javascript
// File size: ~200 lines
// Interface: fetch, search, install, uninstall
// Implementations: NpmRegistry, AgentSkillsRegistry
```

### Phase 5: Integration & Polish (Final)
Depends on all above phases.

#### 5a. Test Architecture Reorganization
**Why**: Support multi-version and compatibility testing
**Time**: 2-3 hours
**Impact**: Confidence in upgrades and migrations

#### 5b. Documentation & Migration Guides
**Why**: Users need clear path to new features
**Time**: 2-3 hours
**Impact**: Smooth adoption, fewer support questions

---

## Decision Matrix

### Groups → Toolbox Rename

| Aspect | Recommendation | Rationale |
|--------|---|---|
| **Strategy** | Three-layer migration | Zero breaking changes, user control |
| **Config Key** | Support both `groups` and `toolboxes` | Backward compatibility |
| **CLI** | New `toolbox` command, hidden `groups` alias | Clear primary interface |
| **Migration** | Explicit `mcpz toolbox migrate` command | Transparent, optional |
| **Timeline** | 6 months support for old API | Graceful deprecation |

### Plugin System

| Aspect | Recommendation | Rationale |
|--------|---|---|
| **Discovery** | npm packages (`mcpz-plugin-*`) | Proven ecosystem, standard naming |
| **Local** | `~/.mcpz/plugins/` fallback | Development and non-npm plugins |
| **State** | Stored in config under `plugins` key | Single source of truth |
| **Installation** | `mcpz plugins install <name>` | User-friendly command |
| **Servers** | Added to config.servers dynamically | Seamless integration |

### Skills System

| Aspect | Recommendation | Rationale |
|--------|---|---|
| **Distinct from Plugins** | Separate manager and registry | Clear separation of concerns |
| **Tools not Servers** | Skills add tools, not servers | Different composability model |
| **Registry** | agentskills.io API | Dedicated ecosystem |
| **Local Storage** | `~/.mcpz/skills/` | Similar pattern to plugins |
| **Composition** | Skills can be used by plugins | Flexibility and reuse |

### SDK Upgrade Strategy

| Aspect | Recommendation | Rationale |
|--------|---|---|
| **Abstraction First** | Create adapter before upgrading | Isolate changes, enable testing |
| **Dual Version Support** | Test against both 1.12.0 and 1.25.1 | Confident migration path |
| **Schema Conversion** | Handle draft-07 ↔ draft-2020-12 | Smooth version transition |
| **Gradual** | 1 month of 1.12.0 + 1.25.1 together | Verify nothing breaks |
| **Clean Cutover** | Final release: 1.25.1 only | Clear version boundary |

---

## Files to Create (Ordered by Priority)

### Phase 1 (Foundation)
```
✓ /src/utils/sdkAdapter.js                  ~200 lines - SDK abstraction
✓ /src/utils/configSchema.js                ~300 lines - Schema + validation
```

### Phase 2 (Groups → Toolbox)
```
✓ /src/utils/toolboxManager.js              ~150 lines - Toolbox operations
✓ /src/commands/toolbox.js                  ~200 lines - CLI commands (rename from groups.js)
✓ /test/toolbox.test.js                     ~300 lines - Tests (migrate from groups.test.js)
```

### Phase 3 (Plugins)
```
✓ /src/utils/pluginManager.js               ~400 lines - Plugin discovery & management
✓ /src/commands/plugins.js                  ~200 lines - Plugin CLI commands
✓ /test/plugins.test.js                     ~400 lines - Plugin tests
```

### Phase 4 (Skills)
```
✓ /src/utils/skillManager.js                ~350 lines - Skill management
✓ /src/utils/registryClient.js              ~200 lines - Registry abstraction
✓ /src/commands/skills.js                   ~200 lines - Skill CLI commands
✓ /test/skills.test.js                      ~400 lines - Skill tests
```

### Phase 5 (Polish)
```
✓ /test/sdk-compat.test.js                  ~300 lines - Compatibility tests
✓ /test/config-migration.test.js            ~250 lines - Migration tests
✓ Documentation updates
```

**Total New Code**: ~4,000 lines across 14 files
**Total Modifications**: ~300 lines in existing files (mainly index.js and config.js)

---

## Testing Strategy

### Unit Tests (Fast, Isolated)
- Individual class methods
- Config parsing and validation
- Plugin/skill discovery logic
- Mocked external calls

### Integration Tests (Realistic)
- Full workflow: add server → create toolbox → run
- Plugin installation and registration
- Config migrations
- Real filesystem operations (in temp dirs)

### Compatibility Tests (Version-aware)
- SDK 1.12.0 vs 1.25.1
- Config version migrations (1.0 → 1.3)
- Schema conversions (draft-07 ↔ draft-2020-12)

### CI Recommendations
```yaml
# Run all tests
- unit tests (fast)
- integration tests (medium)
- compat tests against SDK versions
- config migration tests (old to new)
```

---

## Risk Assessment

### High Risk (Requires Careful Planning)

**SDK Schema Conversion** (draft-07 → draft-2020-12)
- **Risk**: Tools stop working after upgrade
- **Mitigation**:
  - Create comprehensive schema conversion function
  - Test against real tool definitions
  - Dual-version testing with both SDK versions
  - Document schema differences
- **Timeline**: Plan 2-3 weeks for thorough testing

**Config Migration** (groups → toolboxes)
- **Risk**: Users lose group definitions
- **Mitigation**:
  - Idempotent migration functions
  - Backup original config
  - Dry-run option for users
  - Comprehensive migration tests
- **Timeline**: Straightforward, lower risk

### Medium Risk (Manageable)

**Plugin Discovery** (scanning node_modules)
- **Risk**: Slow startup if many npm packages
- **Mitigation**:
  - Cache plugin list (invalidate on npm install)
  - Lazy loading of plugins
  - Performance tests with 100+ plugins
- **Timeline**: Address if needed after initial implementation

**Registry Availability** (agentskills.io downtime)
- **Risk**: Users can't install skills if registry is down
- **Mitigation**:
  - Graceful degradation (works offline)
  - Local skill cache
  - Clear error messages
- **Timeline**: Build in from day 1

### Low Risk (Standard Engineering)

**Backward Compatibility** (old "groups" commands)
- **Risk**: Old scripts break
- **Mitigation**: Comprehensive testing of alias commands
- **Timeline**: Well-understood pattern

**Code Organization** (new manager classes)
- **Risk**: Inconsistent patterns
- **Mitigation**: Use InstanceManager as template
- **Timeline**: Established pattern to follow

---

## Success Metrics

After implementation, verify:

- [ ] **Zero breaking changes**: Old `mcpz groups` commands work
- [ ] **SDK upgrade clean**: Seamless migration to 1.25.1
- [ ] **Plugins discoverable**: `mcpz plugins list` shows installed plugins
- [ ] **Skills composable**: Skills appear in tool list
- [ ] **Config migration**: Automatic or one-command upgrade
- [ ] **Tests comprehensive**: >85% code coverage maintained
- [ ] **Performance**: CLI startup <500ms (even with plugins)
- [ ] **Docs clear**: Users understand plugins vs skills
- [ ] **No regressions**: All existing features work
- [ ] **Help updated**: CLI help reflects new commands

---

## Quick Start - Next Steps

### Week 1: Foundation
```bash
# Create SDK adapter
touch /src/utils/sdkAdapter.js
touch /test/sdk-compat.test.js

# Create config schema
touch /src/utils/configSchema.js
touch /test/config-migration.test.js

# Verify tests pass
npm run test
```

### Week 2: Groups → Toolbox
```bash
# Create toolbox manager
touch /src/utils/toolboxManager.js
cp /src/commands/groups.js /src/commands/toolbox.js
cp /test/groups.test.js /test/toolbox.test.js

# Update command registration
# Edit /src/index.js to add 'toolbox' and hide 'groups'

# Verify backward compat
npm run test
```

### Week 3-4: Plugins
```bash
# Create plugin system
touch /src/utils/pluginManager.js
touch /src/commands/plugins.js
touch /test/plugins.test.js

# Verify plugin discovery works
npm run test
```

### Week 5-6: Skills & Polish
```bash
# Mirror plugin system for skills
touch /src/utils/skillManager.js
touch /src/utils/registryClient.js
touch /src/commands/skills.js

# Final integration and documentation
npm run test
```

---

## References

- **ARCHITECTURE-ANALYSIS.md** - Detailed analysis of each architectural decision
- **ARCHITECTURE-DECISIONS.md** - Formal ADRs with alternatives considered
- **IMPLEMENTATION-GUIDE.md** - Code examples and patterns for each feature
- **CLAUDE.md** - Project-specific development guidelines

---

## Questions & Discussion Points

1. **Timeline**: Is 6-week implementation timeline realistic?
   - Depends on team size and available time
   - Can be parallelized (plugins and skills in parallel)

2. **Backward Compatibility**: How long to support old "groups" API?
   - Recommendation: 6 months to 1 year
   - Phase out via deprecation warnings

3. **Registry Strategy**: Start with npm-only or support custom registries?
   - Recommendation: npm + agentskills.io first
   - Custom registry support in v2.0

4. **Testing Coverage**: Should we maintain >80% coverage?
   - Recommendation: Yes, especially for migrations and config
   - New features: 85%+ target

5. **Documentation**: Update README or separate plugin guide?
   - Recommendation: Both
   - README: Quick overview
   - Separate guide: Detailed plugin development

---

## Conclusion

The current CLI architecture is **solid and extensible**. The recommended approach:

1. **Minimal disruption**: Three-layer migration for groups→toolbox
2. **Foundation first**: SDK adapter and config schema before features
3. **Clear patterns**: Follow existing InstanceManager pattern for plugins/skills
4. **Thorough testing**: Multi-version testing and comprehensive migrations
5. **User-focused**: Transparent APIs, graceful transitions, clear documentation

**Estimated Total Effort**: 4-6 weeks for experienced developer
**Risk Level**: Low to Medium (well-architected, clear patterns to follow)
**Recommendation**: **Proceed with implementation** following suggested roadmap

