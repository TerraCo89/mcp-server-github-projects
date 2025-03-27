import { z } from 'zod';
import { GraphQLClient } from '../common/utils.js';
import { createGitHubError } from '../common/errors.js';

// Schema for priority assessment criteria
export const PriorityAssessmentSchema = z.object({
  project_id: z.string(),
  item_id: z.string(),
  criteria: z.object({
    business_value: z.enum(['high', 'medium', 'low']),
    technical_complexity: z.enum(['high', 'medium', 'low']),
    client_priority: z.enum(['urgent', 'high', 'normal', 'low'])
  })
});

// Schema for batch priority updates
export const BatchPriorityUpdateSchema = z.object({
  project_id: z.string(),
  items: z.array(z.object({
    item_id: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  }))
});

/**
 * Assess and update the priority of a project item based on multiple criteria
 */
export async function assessItemPriority(
  client: GraphQLClient,
  args: z.infer<typeof PriorityAssessmentSchema>
) {
  // Calculate overall priority based on criteria
  const priority = calculateOverallPriority(args.criteria);
  
  // Update the priority field in the project
  const mutation = `
    mutation UpdateProjectItemPriority($projectId: ID!, $itemId: ID!, $priority: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: "priority" # This would need to be dynamically fetched
          value: { text: $priority }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `;

  try {
    await client.request(mutation, {
      projectId: args.project_id,
      itemId: args.item_id,
      priority
    });

    return { success: true, priority };
  } catch (error) {
    if (error instanceof Error) {
      throw createGitHubError(500, { message: error.message });
    }
    throw createGitHubError(500, { message: 'Failed to update item priority' });
  }
}

/**
 * Update priorities for multiple items in a batch
 */
export async function batchUpdatePriorities(
  client: GraphQLClient,
  args: z.infer<typeof BatchPriorityUpdateSchema>
) {
  const results = [];
  
  for (const item of args.items) {
    try {
      const mutation = `
        mutation UpdateProjectItemPriority($projectId: ID!, $itemId: ID!, $priority: String!) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $projectId
              itemId: $itemId
              fieldId: "priority" # This would need to be dynamically fetched
              value: { text: $priority }
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `;

      await client.request(mutation, {
        projectId: args.project_id,
        itemId: item.item_id,
        priority: item.priority
      });

      results.push({ item_id: item.item_id, success: true });
    } catch (error) {
      results.push({ 
        item_id: item.item_id, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  return results;
}

// Helper function to calculate overall priority
function calculateOverallPriority(criteria: z.infer<typeof PriorityAssessmentSchema>['criteria']) {
  const scores = {
    business_value: { high: 3, medium: 2, low: 1 },
    technical_complexity: { high: 1, medium: 2, low: 3 },
    client_priority: { urgent: 4, high: 3, normal: 2, low: 1 }
  };

  const score = 
    scores.business_value[criteria.business_value] +
    scores.technical_complexity[criteria.technical_complexity] +
    scores.client_priority[criteria.client_priority];

  // Calculate weighted average priority
  if (score >= 8) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}