# Specification: Full Skills Integration

## Overview

Complete the integration of Agent Skills (agentskills.io) into mcpz so that skills are:
1. Filterable via CLI options like servers/tools/toolboxes
2. Exposed through the MCP server as resources
3. Installable via CLI command
4. Included in server capabilities for client discovery

## Functional Requirements

### FR1: Skill Filtering on Run Command
- Add `--skill` and `--skills` options to `mcpz run`
- Skills should be loadable alongside server/tool/toolbox filters
- Example: `mcpz run --skill="my-skill" --toolbox="python-stack"`

### FR2: Skills as MCP Resources
- Expose skills as MCP resources that clients can request
- Resource URI format: `skill://<skill-name>/instructions`
- Return skill instructions (SKILL.md body) when requested
- List available skills in resource listing

### FR3: Skill Install Command
- Add `mcpz skill install <name|url>` command
- Support installing from:
  - Direct URL to skill directory/repo
  - GitHub shorthand (user/repo/path)
- Clone/download skill to `~/.mcpz/skills/<name>/`
- Validate SKILL.md exists and is valid after install

### FR4: Skill Metadata in Capabilities
- Include skill metadata in MCP server capabilities
- Clients can discover available skills at connection time
- Format: `{ skills: [{ name, description }] }`

## Acceptance Criteria

1. **AC1**: `mcpz run --skill="test-skill"` loads and makes skill available
2. **AC2**: MCP clients can list skills via `resources/list` request
3. **AC3**: MCP clients can read skill instructions via `resources/read` request
4. **AC4**: `mcpz skill install github:user/repo/skill` downloads and installs skill
5. **AC5**: Server capabilities include skills metadata
6. **AC6**: All existing tests continue to pass
7. **AC7**: New functionality has test coverage

## Out of Scope

- Skill marketplace browsing (handled separately)
- Skill versioning and updates
- Skill dependency management
- Skill script execution (skills provide instructions only)
