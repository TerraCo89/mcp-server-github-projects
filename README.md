# MCP Server for GitHub Projects

A Model Context Protocol server for interacting with GitHub Projects API.

## Installation

```bash
npm install @terraco89/mcp-server-github-projects
```

## Usage

### Environment Variables

Set your GitHub Personal Access Token:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here
```

### Running the Server

```bash
npx @terraco89/mcp-server-github-projects --stdio
```

### Available Tools

- `list_organization_projects` - List projects in an organization
- `list_user_projects` - List projects for the authenticated user
- `create_project` - Create a new project
- `get_project_fields` - Get fields for a project
- `update_project_field` - Update a project field
- `add_project_item` - Add an item to a project
- `delete_project_item` - Delete an item from a project
- `list_project_items` - List items in a project
- `create_project_view` - Create a new project view
- `update_project_view` - Update a project view
- `delete_project_view` - Delete a project view
- `list_project_views` - List views in a project
- `assess_item_priority` - Assess and update priority of project items
- `manage_item_dependencies` - Manage dependencies between project items
- `analyze_dependencies` - Analyze project dependencies
- `generate_project_metrics` - Generate project metrics

## n8n Integration

This server can be used with n8n's MCP Client nodes. Configure the MCP Client node with:

- Command: `npx`
- Arguments: `@terraco89/mcp-server-github-projects --stdio`
- Environment: Set `GITHUB_PERSONAL_ACCESS_TOKEN`

## License

MIT