# MCP Server GitHub Projects

A Model Context Protocol server implementation for the GitHub Projects API. This package provides operations for managing GitHub Project views, priorities, dependencies, and metrics.

## Installation

```bash
npm install @terraco89/mcp-server-github-projects
```

## Configuration

Set the following environment variables:

```bash
GITHUB_TOKEN=your_github_personal_access_token
```

The token needs the following permissions:
- `project` (read/write)
- `repo` (read)

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

### Docker

```json
{
  "mcpServers": {
    "github-projects": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_TOKEN",
        "mcp/github-projects"
      ],
      "env": {
        "GITHUB_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "github-projects": {
      "command": "npx",
      "args": [
        "-y",
        "@terraco89/mcp-server-github-projects"
      ],
      "env": {
        "GITHUB_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## Usage as a Library

```typescript
import { server } from '@terraco89/mcp-server-github-projects';

// Start the server
server.listen();
```

## Usage as a CLI

```bash
mcp-server-github-projects
```

## Available Operations

### Project Views
- `createProjectView` - Create a new view in a GitHub Project
- `updateProjectView` - Update an existing view
- `deleteProjectView` - Delete a view
- `listProjectViews` - List all views in a project

### Priorities
- `assessItemPriority` - Assess and update item priority
- `batchUpdatePriorities` - Update multiple item priorities

### Dependencies
- `manageItemDependencies` - Manage item dependencies
- `analyzeDependencies` - Analyze project dependencies

### Metrics
- `generateProjectMetrics` - Generate project metrics

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch
```

## Build

Docker build:

```bash
docker build -t mcp/github-projects -f Dockerfile .
```

## License

MIT