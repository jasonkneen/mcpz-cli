# Architecture Documentation Index

Complete architectural analysis for mcpsx.run CLI's upcoming features.

## Quick Navigation

### Start Here
- **[ARCHITECTURE-SUMMARY.md](ARCHITECTURE-SUMMARY.md)** - Executive summary and quick reference (15 min read)
- **[ARCHITECTURE-VISUAL.md](ARCHITECTURE-VISUAL.md)** - Visual diagrams and structure (20 min read)

### Deep Dives
- **[ARCHITECTURE-ANALYSIS.md](ARCHITECTURE-ANALYSIS.md)** - Detailed analysis of current and proposed architecture (60 min read)
- **[ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md)** - Formal ADRs with alternatives considered (45 min read)
- **[IMPLEMENTATION-GUIDE.md](IMPLEMENTATION-GUIDE.md)** - Code examples and implementation patterns (90 min read)

---

## Document Summary

### ARCHITECTURE-SUMMARY.md
**Best for**: Project leads, quick understanding of decisions
- Current architecture assessment (strengths/weaknesses)
- Implementation priority with timelines
- Decision matrix for key choices
- Risk assessment and mitigation
- Success metrics and validation

**Key Sections**:
- Strengths to keep (5 items)
- Weaknesses to fix (3 categories)
- 5-phase implementation roadmap
- Risk: High/Medium/Low assessment
- Next steps checklist

### ARCHITECTURE-VISUAL.md
**Best for**: Understanding structure and data flow
- Current and proposed directory structure
- Dependency graphs (before/after)
- Data flow diagrams for key operations
- Module interaction matrix
- Configuration evolution timeline
- Testing architecture
- Deployment flow

**Key Sections**:
- File structure with [NEW] markers
- Coupling strength analysis
- Responsibility layers
- Test organization
- Visual representations

### ARCHITECTURE-ANALYSIS.md
**Best for**: Deep understanding of architectural decisions
- Current architecture overview (5 sections)
- Compliance check against SOLID principles
- Coupling and cohesion analysis
- Architectural boundaries
- Detailed feature analysis:
  - Groups → Toolbox rename (architectural strategy)
  - Plugin system (design patterns)
  - Skills support (vs plugins distinction)
  - SDK upgrade path (abstraction strategy)
  - Test coverage architecture

**Key Sections**:
- Architecture Overview (5 pages)
- Compliance Analysis (SOLID, coupling)
- Feature Analysis (4 major features)
- Recommendations Summary
- Implementation Roadmap
- Validation Checklist

### ARCHITECTURE-DECISIONS.md
**Best for**: Decision-makers and architects
- 7 formal Architecture Decision Records (ADRs):
  1. Groups → Toolbox Rename Strategy
  2. SDK Abstraction Layer
  3. Plugin System Architecture
  4. Skills vs. Plugins Distinction
  5. Configuration Schema Versioning
  6. Test Architecture for Multi-Version Support
  7. Interactive Mode Refactoring

**Each ADR includes**:
- Status (RECOMMENDED, APPROVED, etc.)
- Context and problem statement
- Decision and rationale
- Alternatives considered (with pros/cons)
- Implementation details
- Success criteria
- Dependency ordering

### IMPLEMENTATION-GUIDE.md
**Best for**: Developers implementing the features
- 6 complete code examples with ~1000 lines of actual code:
  1. SDK Adapter Pattern (200 lines)
  2. Config Schema & Validation (300 lines)
  3. Toolbox Manager (150 lines)
  4. Plugin Manager (350 lines)
  5. Test Patterns (300 lines)
  6. Integration example (combined features)

**Each section includes**:
- Complete, ready-to-use code
- Inline documentation
- Usage examples
- Integration points

---

## Key Findings

### Current Architecture Strengths
- ✓ Clear separation of concerns (commands, config, instance tracking)
- ✓ Modular design with single responsibility per file
- ✓ SOLID principles mostly followed
- ✓ Minimal coupling between components
- ✓ Excellent test coverage patterns

### Current Architecture Weaknesses
- ⚠️ Tight coupling to @modelcontextprotocol/sdk (version dependent)
- ⚠️ No registry abstraction (can't easily swap implementations)
- ⚠️ No config schema validation
- ⚠️ interactive.js spawns child process (circular invocation)
- ⚠️ Missing plugin/skill extensibility system

### Recommended Approach

**Three-Layer Migration for Groups → Toolbox**:
1. Config: Support both `groups` and `toolboxes` keys
2. CLI: New `toolbox` command, hidden `groups` alias
3. User: Optional `mcpz toolbox migrate` command
- **Result**: Zero breaking changes, user-controlled transition

**SDK Abstraction First**:
- Create `/src/utils/sdkAdapter.js` before upgrading SDK
- Isolate SDK-specific code in one module
- Enable testing against multiple SDK versions
- Smooth upgrade path for future versions

**Plugin & Skill Systems**:
- Separate managers (PluginManager, SkillManager)
- Plugins add servers, Skills add tools
- npm registry for plugins, agentskills.io for skills
- Local discovery in `~/.mcpz/plugins/` and `~/.mcpz/skills/`

**Enhanced Testing**:
- Unit tests: Fast, isolated
- Integration tests: Realistic scenarios
- Compatibility tests: Version-specific
- Test data in `/test/fixtures/`

---

## Implementation Timeline

### Phase 1: Foundation (Week 1) - 5-6 hours
```
□ Create /src/utils/sdkAdapter.js (SDK abstraction)
□ Create /src/utils/configSchema.js (validation)
□ Write tests: sdk-compat.test.js, config-migration.test.js
```

### Phase 2: Groups → Toolbox (Week 2) - 4-5 hours
```
□ Create /src/utils/toolboxManager.js
□ Rename: groups.js → toolbox.js
□ Update: /src/index.js (command registration)
□ Migrate: groups.test.js → toolbox.test.js
```

### Phase 3: Plugin System (Week 3-4) - 8-10 hours
```
□ Create /src/utils/pluginManager.js
□ Create /src/commands/plugins.js
□ Create /test/plugins.test.js
□ Update: config.js (getAllServers)
```

### Phase 4: Skills Support (Week 5) - 8-10 hours
```
□ Create /src/utils/skillManager.js
□ Create /src/utils/registryClient.js
□ Create /src/commands/skills.js
□ Create /test/skills.test.js
```

### Phase 5: Polish & Integration (Week 6) - 4-6 hours
```
□ Integration tests (feature composition)
□ Documentation updates
□ Migration guides
□ Release notes
```

**Total Effort**: 4-6 weeks for experienced developer

---

## Files to Create (14 new files)

### Core Utilities (4 files)
- `/src/utils/sdkAdapter.js` - SDK abstraction (200 lines)
- `/src/utils/configSchema.js` - Schema validation (300 lines)
- `/src/utils/toolboxManager.js` - Toolbox operations (150 lines)
- `/src/utils/pluginManager.js` - Plugin management (400 lines)
- `/src/utils/skillManager.js` - Skill management (350 lines)
- `/src/utils/registryClient.js` - Registry abstraction (200 lines)

### Commands (3 files)
- `/src/commands/toolbox.js` - Toolbox CLI commands (200 lines, rename from groups.js)
- `/src/commands/plugins.js` - Plugin CLI commands (200 lines)
- `/src/commands/skills.js` - Skill CLI commands (200 lines)

### Tests (5 files)
- `/test/toolbox.test.js` - Toolbox tests (300 lines, renamed from groups.test.js)
- `/test/sdk-compat.test.js` - SDK compatibility (300 lines)
- `/test/config-migration.test.js` - Config migration (250 lines)
- `/test/plugins.test.js` - Plugin tests (400 lines)
- `/test/skills.test.js` - Skill tests (400 lines)

### Test Fixtures (1 directory)
- `/test/fixtures/` - Test data (old configs, plugin examples)

**Total New Code**: ~4,000 lines across 14 files
**Modified Files**: ~300 lines (primarily /src/index.js and /src/utils/config.js)

---

## How to Use This Documentation

### For Project Leads
1. Read ARCHITECTURE-SUMMARY.md (15 min)
2. Review ARCHITECTURE-VISUAL.md (20 min)
3. Check decision matrix in SUMMARY.md
4. Review timeline and effort estimates
5. Make go/no-go decision

### For Architects
1. Read ARCHITECTURE-ANALYSIS.md (60 min)
2. Review ARCHITECTURE-DECISIONS.md (45 min)
3. Examine ARCHITECTURE-VISUAL.md diagrams
4. Validate against your architecture principles
5. Suggest modifications if needed

### For Developers
1. Skim ARCHITECTURE-SUMMARY.md (10 min)
2. Reference ARCHITECTURE-VISUAL.md for structure
3. Follow IMPLEMENTATION-GUIDE.md for code
4. Refer back to ARCHITECTURE-DECISIONS.md for rationale
5. Run tests as you implement each phase

### For Code Reviewers
1. Read ARCHITECTURE-DECISIONS.md (45 min)
2. Check PRs against implementation patterns in GUIDE.md
3. Verify test coverage matches test architecture
4. Ensure no coupling violations

---

## Key Diagrams & Visual References

### From ARCHITECTURE-VISUAL.md:
- Current vs. Proposed dependency graphs
- Data flow for add server, create toolbox, install plugin
- Module interaction matrix
- Coupling strength analysis (before/after)
- Responsibility layers
- Configuration evolution timeline
- Testing architecture
- Deployment flow

---

## Reference Material Included

### Code Examples (IMPLEMENTATION-GUIDE.md)
- SDK adapter with version detection
- Config schema with JSON schema validation
- Toolbox manager with migration support
- Plugin manager with npm discovery
- Test patterns with temp directory isolation
- Integration example showing combined features

### Decision Records (ARCHITECTURE-DECISIONS.md)
- 7 ADRs with alternatives considered
- Each includes: Context, Decision, Rationale, Alternatives, Implementation, Criteria
- Dependency ordering for implementation
- Review checklist

### Patterns & Best Practices
- Singleton pattern (InstanceManager, PluginManager)
- Manager classes for business logic
- Pure functions for commands
- Schema validation with normalization
- Idempotent migrations
- Backward-compatible config evolution

---

## Questions & Next Steps

### Common Questions Answered
- **Why three-layer migration for groups→toolbox?**
  - Preserves backward compatibility
  - Gives users control over when to migrate
  - Reduces breaking changes to zero

- **Why separate SDK adapter?**
  - Isolates version-specific code
  - Enables testing against multiple versions
  - Smooth upgrade path

- **Why separate plugins from skills?**
  - Different concepts (servers vs. tools)
  - Different registries (npm vs. agentskills.io)
  - Different lifecycle and composition

- **What about performance?**
  - Plugin discovery can be cached
  - Skills loaded lazily
  - Instance tracking efficient with JSON files
  - All addressed in implementation guide

### Next Steps
1. Review ARCHITECTURE-SUMMARY.md (executive overview)
2. Decide: Proceed with implementation?
3. If yes, follow Phase 1 timeline in SUMMARY.md
4. Reference IMPLEMENTATION-GUIDE.md when coding
5. Use ARCHITECTURE-VISUAL.md for testing structure

---

## Document Statistics

| Document | Pages | Read Time | Best For |
|----------|-------|-----------|----------|
| SUMMARY | 12 | 15 min | Quick overview |
| VISUAL | 15 | 20 min | Understanding structure |
| ANALYSIS | 25 | 60 min | Deep understanding |
| DECISIONS | 18 | 45 min | Decision-makers |
| IMPLEMENTATION | 20 | 90 min | Developers |
| **TOTAL** | **~90** | **~230 min** | Complete understanding |

---

## Version History

- **v1.0** - December 2025
  - Initial comprehensive analysis
  - 7 ADRs covering all upcoming features
  - Code examples and implementation guide
  - Visual diagrams and data flows
  - 6-week implementation timeline

---

## Feedback & Updates

These documents are living references. As implementation proceeds:
- Update with actual timelines and estimates
- Add performance metrics
- Document any deviations from recommendations
- Capture lessons learned
- Refine patterns based on implementation experience

---

**Last Updated**: December 19, 2025
**Version**: 1.0
**Status**: READY FOR IMPLEMENTATION

