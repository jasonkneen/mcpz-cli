
![mcpzit](https://github.com/user-attachments/assets/984d5570-b3c2-4648-b4a2-abd4f4d8be14)


# mcpz cli

Command line interface for mcpz (Model Context Protocol Server eXecutable), allowing you to manage, query, and interact with Model Context Protocol (MCP) servers and tools.

## Installation

```bash
# Install globally
npm install -g @mcpz/cli

# Or use with npx
npx @mcpz/cli
```

## Usage

The CLI can be accessed using any of these commands:
- `mcps` (primary command)
- `mcpz` (extended alias)

```bash
# Show help
mcpz help

# Start mcps as a stdio server
mcpz run

# Start with specific servers and tools
mcpz run --server="sleep"
mcpz run --servers="python,pytorch" --tool="predict"

# Server group management
mcpz groups add "python-stack" --servers="python,pytorch,huggingface"
mcpz run --servers="python-stack"

# Add a new MCP configuration
mcpz add "My Server" --command "node" --args "server.js"

# List MCP configurations
mcpz list

# Remove an MCP configuration
mcpz remove "My Server"

# Use a specific MCP configuration
mcpz use "My Server"
```

## Key Features

mcpz CLI provides powerful capabilities for working with Model Context Protocol servers:

1. **Run Servers & Tools**: Start MCP servers and tools individually or in combination
2. **Add & Remove**: Easily manage your MCP configurations
3. **Query & List**: View available servers and tools at any time
4. **Grouping**: Create and manage groups of servers and tools for simplified workflows
5. **Flexible Filtering**: Run specific servers, tools, or combinations

## Commands

### `stdio`

Start mcps as a stdio server. This is the main command used by the VSCode extension to communicate with MCP servers.

```bash
mcpz run [options]
```

Options:
- `-s, --server <n>` - Load only a specific server
- `-S, --servers <names>` - Load only specific servers (comma-separated)
- `-t, --tool <n>` - Load only a specific tool
- `-T, --tools <names>` - Load only specific tools (comma-separated)

Examples:
```bash
# Load all servers and tools
mcpz run

# Load only the 'sleep' server
mcpz run --server="sleep"

# Load multiple servers
mcpz run --servers="python,pytorch"

# Load specific tools from specific servers
mcpz run --servers="python" --tools="predict,generate"

# Use a server group
mcpz run --servers="python-stack"
```

### `groups`

Manage server and tool groups. Groups allow you to create collections of MCP servers and tools that can be used together.

```bash
mcpz groups <command>
```

Subcommands:

#### `groups add`

Create a new server group.

```bash
mcpz groups add <n> --servers="server1,server2,..."
```

Example:
```bash
# Create a 'python-stack' group containing multiple servers
mcpz groups add "python-stack" --servers="python,pytorch,huggingface"

# Create a 'favorites' group
mcpz groups add "favorites" --servers="openai,anthropic"
```

#### `groups remove`

Remove a server group.

```bash
mcpz groups remove <n>
```

#### `groups list`

List all server groups.

```bash
mcpz groups list
```

## Server & Tool Groups

Groups allow you to create collections of MCP servers and tools that can be used together. This is useful for organizing related components and simplifying command-line usage.

Groups act as "virtual MCPs" - when you reference a group name with `--servers` or `--tools`, it expands to include all servers or tools in that group.

Example workflow:

```bash
# Create groups for different use cases
mcpz groups add "ai-models" --servers="openai,anthropic,llama"
mcpz groups add "data-tools" --servers="pandas,numpy,sklearn"

# Use a specific group
mcpz run --servers="ai-models"

# Combine groups with individual servers/tools
mcpz run --servers="ai-models,custom-server" --tools="predict"
```

### `add`

Add a new MCP configuration.

```bash
mcpz add <n> [options]
```

Options:
- `-c, --command <command>` - Command to run the MCP server
- `-a, --args <args>` - Arguments for the command (comma-separated)
- `-e, --env <env>` - Environment variables (key=value,key2=value2)

Example:
```bash
mcpz add "my server name" --command "node" --args "server.js,--port=3000" --env "API_KEY=abc123,DEBUG=true"
```

### `remove`

Remove an MCP configuration.

```bash
mcpz remove <n>
```

### `list`

List all MCP configurations.

```bash
mcpz list
```

### `use`

Use a specific MCP configuration.

```bash
mcpz use <n>
```

### `help`

Display help information.

```bash
mcpz help
```

## Configuration

mcpz CLI uses the configuration file located at `~/.mcpz/config.json`. This file is shared with the mcpz VSCode extension.

You can manage your configuration with the `config` command:

```bash
# View current configuration
mcpz config

# Use custom config file
mcpz config --load /path/to/config.json

# Save to custom location
mcpz config --save /path/to/config.json
```

This is especially useful for:
- Testing: Use a separate config file for testing
- Migration: Easily migrate configurations between systems
- Backup: Create backup copies of your configuration
- Syncing: Store configurations in shared locations

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/mcpsx/cli.git
cd cli

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm run test
```

### Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the GNU GPLv3 - see the [LICENSE](LICENSE) file for details.


```
███████████████████████████████████████████████████████████████████████████████████████████████████████████████
█        ███        ██████            ██               ███               █████████      ███      █████████    █
█                    ███              ██                ██               █████████░░░░░░███░░░░░░     ████░░░░█
█░░░░░░░░░░░░░░░░░░░░██░░░░░░░░░░░░░░░██░░░░░░░░░░░░░░░░██░░░░▓░░░░░░░░░ ██████████████████▒▒▒▒▒▒▒▒▒▒▒████░░░░█
█░░░░▒██▒░░░░██▒░░░░░██░░░░▒▒▒▒▒▒▒▒▒▒▒██░░░░░░▒██▒░░░░░░██▒▒███░░░░▒▒▒▒███████████░░░░░░███▒▒▒▒▒▒▒▒▒▒▒████▒▒▒▒█
█▒▒▒▒▒██▒▒▒▒▒██▒▒▒▒▒▒██▒▒▒▒▒▒▒██████████▒▒▒▒▒▒▒██▒▒▒▒▒▒▒█████░░▒▒▒▒▒▒█████  ░░▒███░░░░░░███▒▒▒▒▒██████████▒▒▒▒█
█▒▒▒▒▒██▒▒▒▒▒██▒▒▒▒▒▒██▒▒▒▒▒▒▒░░░░░░░░██▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒███░░░▒▒▒▒▒▒▒██████ ▒▒▓▓███▒▒▒▒▒▒███▒▒▒▒▒░░░░░░████▒▒▒▒█
█▒▒▒▒▒██▒▒▒▒▒██▒▒▒▒▒▒██▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒██▒▒▒▒▒▒▒▒▒▒▒▒▒▒████▒▒▒▒▒▒▒▒▒░░░░░░█▓▓▓▓████▒▒▒▒▒▒███▒▒▒▒▒▒▒▒▒▒▒█████████
█▒▒▒▒▒██▒▒▒▒▒██▒▒▒▒▒▒███▒▒▒▒▒▒▒▒▒▒▒▒▒▒██▒▒▒▒▒▒▒███████████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█████████▒▒▒▒▒▒████▒▒▒▒▒▒▒▒▒▒████░░░░█
█▒▒▒▒▒██▒▒▒▒▒██▒▒▒▒▒▒█████▒▒▒▒▒▒▒▒▒▒▒▒██▒▒▒▒▒▒▒███████████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█████████▒▒▒▒▒▒█████▒▒▒▒▒▒▒▒▒████▒▒▒▒█
███████████████████████████████████████████████████████████████████████████████████████████████████████████████
```
