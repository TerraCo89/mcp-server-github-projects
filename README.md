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

## Usage

### As a Library

```typescript
import { server } from '@terraco89/mcp-server-github-projects';

// Start the server
server.listen();
```

### As a CLI

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

## License

MIT