import { z } from 'zod';
import { createServer } from './common/create-server.js';

// Import operations
import * as projects from './operations/projects.js';
import * as projectItems from './operations/project-items.js';
import * as projectViews from './operations/project-views.js';
import * as priorities from './operations/priorities.js';
import * as dependencies from './operations/dependencies.js';
import * as metrics from './operations/metrics.js';

// Create and export the MCP server
export const server = createServer({
  name: 'github-projects',
  version: '0.1.0',
  description: 'GitHub Projects API operations for MCP',
  operations: {
    // Project Item Operations
    listProjectItems: {
      description: 'List items in a GitHub Project',
      input: projectItems.ListProjectItemsSchema,
      handler: async ({ input, context }) => {
        return projectItems.listProjectItems(input.project_id, {
          page: input.page,
          per_page: input.per_page
        });
      },
    },
    addProjectItem: {
      description: 'Add an issue or pull request to a GitHub Project',
      input: projectItems.AddProjectItemSchema,
      handler: async ({ input, context }) => {
        return projectItems.addProjectItem(
          input.project_id,
          input.content_id
        );
      },
    },
    deleteProjectItem: {
      description: 'Delete an item from a GitHub Project',
      input: projectItems.DeleteProjectItemSchema,
      handler: async ({ input, context }) => {
        return projectItems.deleteProjectItem(input.project_id, input.item_id);
      },
    },
    getProjectFields: {
      description: 'Get fields for a GitHub Project',
      input: projects.GetProjectFieldsSchema,
      handler: async ({ input, context }) => {
        return projects.getProjectFields(input.owner, input.project_number);
      },
    },
    updateProjectField: {
      description: 'Update a field on a GitHub Project item',
      input: projects.UpdateProjectFieldSchema,
      handler: async ({ input, context }) => {
        return projects.updateProjectField(
          input.project_id,
          input.item_id,
          input.field_id,
          input.value
        );
      },
    },

    // Project Views Operations
    createProjectView: {
      description: 'Create a new view in a GitHub Project',
      input: projectViews.CreateProjectViewSchema,
      handler: async ({ input, context }) => {
        return projectViews.createProjectView(
          input.project_id,
          input.name,
          input.layout
        );
      },
    },
    updateProjectView: {
      description: 'Update an existing view in a GitHub Project',
      input: projectViews.UpdateProjectViewSchema,
      handler: async ({ input, context }) => {
        return projectViews.updateProjectView(
          input.project_id,
          input.view_id,
          {
            name: input.name,
            layout: input.layout
          }
        );
      },
    },
    deleteProjectView: {
      description: 'Delete a view from a GitHub Project',
      input: projectViews.DeleteProjectViewSchema,
      handler: async ({ input, context }) => {
        return projectViews.deleteProjectView(
          input.project_id,
          input.view_id
        );
      },
    },
    listProjectViews: {
      description: 'List all views in a GitHub Project',
      input: projectViews.ListProjectViewsSchema,
      handler: async ({ input, context }) => {
        return projectViews.listProjectViews(
          input.project_id,
          {
            page: input.page,
            per_page: input.per_page
          }
        );
      },
    },

    // Priority Operations
    assessItemPriority: {
      description: 'Assess and update the priority of a project item',
      input: priorities.PriorityAssessmentSchema,
      handler: async ({ input, context }) => {
        return priorities.assessItemPriority(context.client, input);
      },
    },
    batchUpdatePriorities: {
      description: 'Update priorities for multiple items in batch',
      input: priorities.BatchPriorityUpdateSchema,
      handler: async ({ input, context }) => {
        return priorities.batchUpdatePriorities(context.client, input);
      },
    },

    // Dependency Operations
    manageItemDependencies: {
      description: 'Manage dependencies between project items',
      input: dependencies.DependencyManagementSchema,
      handler: async ({ input, context }) => {
        return dependencies.manageItemDependencies(context.client, input);
      },
    },
    analyzeDependencies: {
      description: 'Analyze dependencies in a project',
      input: dependencies.DependencyAnalysisSchema,
      handler: async ({ input, context }) => {
        return dependencies.analyzeDependencies(context.client, input);
      },
    },

    // Metrics Operations
    generateProjectMetrics: {
      description: 'Generate metrics for a project',
      input: metrics.ProjectMetricsSchema,
      handler: async ({ input, context }) => {
        return metrics.generateProjectMetrics(context.client, input);
      },
    },
  },
});

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen();
}
