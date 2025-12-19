# Implementation Plan: Full Skills Integration

## Phase 1: Skill Filtering on Run Command

- [x] Task: Add skill filtering options to CLI
  - [x] Add `--skill` and `--skills` options to `run` command in index.js
  - [x] Parse skill filters in server.js start method
  - [x] Store skill filters as `#skillFilters`

- [x] Task: Load skills based on filters
  - [x] Import skills utility in server.js
  - [x] Load filtered skills on server start
  - [x] Store loaded skills in server state

- [x] Task: Conductor - Phase 1 Verification
  - [x] Test: `mcpz run --skill="test"` accepts the option
  - [x] Verify skills are loaded when specified

## Phase 2: Skills as MCP Resources

- [x] Task: Add skills to resource listing
  - [x] Modify `resources/list` handler in server.js
  - [x] Return skill resources with URI format `skill://<name>/instructions`
  - [x] Include skill description in resource metadata

- [x] Task: Implement skill resource reading
  - [x] Add `skill://` URI handler in `resources/read`
  - [x] Return skill instructions when requested
  - [x] Handle skill not found error

- [x] Task: Write tests for skill resources
  - [x] Test resource listing includes skills
  - [x] Test reading skill instructions
  - [x] Test error handling for missing skills

- [x] Task: Conductor - Phase 2 Verification
  - [x] Run test suite
  - [x] Manual test: list resources shows skills
  - [x] Manual test: read skill resource returns instructions

## Phase 3: Skill Install Command

- [x] Task: Create install function in skills.js
  - [x] Parse install source (URL, GitHub shorthand)
  - [x] Download/clone skill to skills directory
  - [x] Validate SKILL.md exists after install
  - [x] Return success/failure status

- [x] Task: Add install command to CLI
  - [x] Add `install` subcommand to `skill` command
  - [x] Accept name/URL argument
  - [x] Call install function and report result

- [x] Task: Write tests for skill installation
  - [x] Test URL parsing
  - [x] Test validation after install
  - [x] Test error handling for invalid sources

- [x] Task: Conductor - Phase 3 Verification
  - [x] Run test suite
  - [x] Manual test: install from GitHub URL

## Phase 4: Skills in Server Capabilities

- [x] Task: Include skills in capabilities
  - [x] Modify server initialization to include skills metadata
  - [x] Add skills array to capabilities object
  - [x] Include name and description for each skill

- [x] Task: Write tests for capabilities
  - [x] Test capabilities include skills array
  - [x] Test skill metadata format

- [x] Task: Conductor - Phase 4 Verification
  - [x] Run full test suite
  - [x] Build verification
  - [x] Lint check

## Phase 5: Final Integration

- [x] Task: Update interactive mode
  - [x] Add `/skills` command to interactive mode
  - [x] Show skills in status bar (optional)

- [x] Task: Update help text and examples
  - [x] Add skill examples to --help output
  - [x] Update documentation comments

- [x] Task: Final verification
  - [x] All 106+ tests pass
  - [x] Build succeeds
  - [x] No lint errors (only pre-existing warnings)
  - [x] Manual end-to-end test
