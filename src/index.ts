import { z } from 'zod';
import { createServer } from './common/create-server.js';

import * as projects from './operations/projects.js';
import * as projectItems from './operations/project-items.js';
import * as projectViews from './operations/project-views.js';
import * as priorities from './operations/priorities.js';
import * as dependencies from './operations/dependencies.js';
import * as metrics from './operations/metrics.js';
import * as issues from './operations/issues.js';
import { createResourceRegistrations } from './resources/index.js';

export const server = createServer({
  name: 'github-projects',
  version: '0.1.0',
  description: 'GitHub Projects API operations for MCP',
  operations: {
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
    generateProjectMetrics: {
      description: 'Generate metrics for a project',
      input: metrics.ProjectMetricsSchema,
      handler: async ({ input, context }) => {
        return metrics.generateProjectMetrics(context.client, input);
      },
    },
    createDraftIssue: {
      description: 'Create a draft issue directly in a GitHub Project',
      input: issues.CreateDraftIssueSchema,
      handler: async ({ input, context }) => {
        return issues.createDraftIssue(input.project_id, input.title, input.body);
      },
    },
    updateDraftIssue: {
      description: 'Update a draft issue title and/or body in a GitHub Project',
      input: issues.UpdateDraftIssueSchema,
      handler: async ({ input, context }) => {
        return issues.updateDraftIssue(input.item_id, input.title, input.body);
      },
    },
    updateIssue: {
      description: 'Update an existing issue title, body, or state',
      input: issues.UpdateIssueSchema,
      handler: async ({ input, context }) => {
        return issues.updateIssue(input.issue_id, input.title, input.body, input.state);
      },
    },
    createIssue: {
      description: 'Create a new issue in a repository and optionally add to a project',
      input: issues.CreateIssueSchema,
      handler: async ({ input, context }) => {
        return issues.createIssue(
          input.repo_owner,
          input.repo_name,
          input.title,
          input.body,
          input.project_id
        );
      },
    },
    listOrganizationProjects: {
      description: 'List projects for an organization or user',
      input: projects.ListProjectsSchema,
      handler: async ({ input, context }) => {
        return projects.listOrganizationProjects(input.organization, {
          page: input.page,
          per_page: input.per_page
        });
      },
    },
    createProject: {
      description: 'Create a new GitHub Project',
      input: projects.CreateProjectSchema,
      handler: async ({ input, context }) => {
        return projects.createProject(input.owner, {
          title: input.title,
          description: input.description,
        });
      },
    },
    listUserProjects: {
      description: 'List projects for the authenticated user',
      input: projects.ListUserProjectsSchema,
      handler: async ({ input, context }) => {
        return projects.listUserProjects({
          page: input.page,
          per_page: input.per_page
        });
      },
    },
  },
  resources: createResourceRegistrations(),
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen();
}
