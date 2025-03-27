import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GraphQLClient } from './common/utils.js';
import { createGitHubError } from './common/errors.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Import operations
import * as projects from './operations/projects.js';
import * as projectItems from './operations/project-items.js';
import * as projectViews from './operations/project-views.js';
import * as priorities from './operations/priorities.js';
import * as dependencies from './operations/dependencies.js';
import * as metrics from './operations/metrics.js';

// Create GraphQL client
const client = new GraphQLClient();

// Create server instance
const server = new Server(
  {
    name: "github-projects-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_organization_projects",
        description: "List projects in an organization",
        inputSchema: zodToJsonSchema(projects.ListProjectsSchema),
      },
      {
        name: "list_user_projects",
        description: "List projects for the authenticated user",
        inputSchema: zodToJsonSchema(projects.ListUserProjectsSchema),
      },
      {
        name: "create_project",
        description: "Create a new project",
        inputSchema: zodToJsonSchema(projects.CreateProjectSchema),
      },
      {
        name: "get_project_fields",
        description: "Get fields for a project",
        inputSchema: zodToJsonSchema(projects.GetProjectFieldsSchema),
      },
      {
        name: "update_project_field",
        description: "Update a project field",
        inputSchema: zodToJsonSchema(projects.UpdateProjectFieldSchema),
      },
      {
        name: "add_project_item",
        description: "Add an item to a project",
        inputSchema: zodToJsonSchema(projectItems.AddProjectItemSchema),
      },
      {
        name: "delete_project_item",
        description: "Delete an item from a project",
        inputSchema: zodToJsonSchema(projectItems.DeleteProjectItemSchema),
      },
      {
        name: "list_project_items",
        description: "List items in a project",
        inputSchema: zodToJsonSchema(projectItems.ListProjectItemsSchema),
      },
      {
        name: "create_project_view",
        description: "Create a new project view",
        inputSchema: zodToJsonSchema(projectViews.CreateProjectViewSchema),
      },
      {
        name: "update_project_view",
        description: "Update a project view",
        inputSchema: zodToJsonSchema(projectViews.UpdateProjectViewSchema),
      },
      {
        name: "delete_project_view",
        description: "Delete a project view",
        inputSchema: zodToJsonSchema(projectViews.DeleteProjectViewSchema),
      },
      {
        name: "list_project_views",
        description: "List views in a project",
        inputSchema: zodToJsonSchema(projectViews.ListProjectViewsSchema),
      },
      {
        name: "assess_item_priority",
        description: "Assess and update the priority of a project item based on multiple criteria",
        inputSchema: zodToJsonSchema(priorities.PriorityAssessmentSchema),
      },
      {
        name: "manage_item_dependencies",
        description: "Manage dependencies between project items",
        inputSchema: zodToJsonSchema(dependencies.DependencyManagementSchema),
      },
      {
        name: "analyze_dependencies",
        description: "Analyze dependencies in a project",
        inputSchema: zodToJsonSchema(dependencies.DependencyAnalysisSchema),
      },
      {
        name: "generate_project_metrics",
        description: "Generate metrics for a project",
        inputSchema: zodToJsonSchema(metrics.ProjectMetricsSchema),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "list_organization_projects": {
        const args = projects.ListProjectsSchema.parse(request.params.arguments);
        const { organization, ...options } = args;
        const result = await projects.listOrganizationProjects(organization, options);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_user_projects": {
        const args = projects.ListUserProjectsSchema.parse(request.params.arguments);
        const result = await projects.listUserProjects(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_project": {
        const args = projects.CreateProjectSchema.parse(request.params.arguments);
        const { owner, ...options } = args;
        const result = await projects.createProject(owner, options);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_project_fields": {
        const args = projects.GetProjectFieldsSchema.parse(request.params.arguments);
        const result = await projects.getProjectFields(args.owner, args.project_number);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_project_field": {
        const args = projects.UpdateProjectFieldSchema.parse(request.params.arguments);
        const result = await projects.updateProjectField(
          args.project_id,
          args.item_id,
          args.field_id,
          args.value
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "add_project_item": {
        const args = projectItems.AddProjectItemSchema.parse(request.params.arguments);
        const result = await projectItems.addProjectItem(
          args.project_id,
          args.content_id,
          args.content_type
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_project_item": {
        const args = projectItems.DeleteProjectItemSchema.parse(request.params.arguments);
        const result = await projectItems.deleteProjectItem(args.project_id, args.item_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_project_items": {
        const args = projectItems.ListProjectItemsSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const result = await projectItems.listProjectItems(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_project_view": {
        const args = projectViews.CreateProjectViewSchema.parse(request.params.arguments);
        const result = await projectViews.createProjectView(
          args.project_id,
          args.name,
          args.layout
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_project_view": {
        const args = projectViews.UpdateProjectViewSchema.parse(request.params.arguments);
        const result = await projectViews.updateProjectView(
          args.project_id,
          args.view_id,
          args.name,
          args.layout
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_project_view": {
        const args = projectViews.DeleteProjectViewSchema.parse(request.params.arguments);
        const result = await projectViews.deleteProjectView(args.project_id, args.view_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_project_views": {
        const args = projectViews.ListProjectViewsSchema.parse(request.params.arguments);
        const result = await projectViews.listProjectViews(args.project_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "assess_item_priority": {
        const args = priorities.PriorityAssessmentSchema.parse(request.params.arguments);
        const result = await priorities.assessItemPriority(
          args.project_id,
          args.item_id,
          args.criteria
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "manage_item_dependencies": {
        const args = dependencies.DependencyManagementSchema.parse(request.params.arguments);
        const result = await dependencies.manageItemDependencies(
          args.project_id,
          args.item_id,
          args.dependencies,
          args.operation
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "analyze_dependencies": {
        const args = dependencies.DependencyAnalysisSchema.parse(request.params.arguments);
        const result = await dependencies.analyzeDependencies(args.project_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "generate_project_metrics": {
        const args = metrics.ProjectMetricsSchema.parse(request.params.arguments);
        const result = await metrics.generateProjectMetrics(args.project_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    throw createGitHubError(error);
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.listen(transport);
}

runServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
