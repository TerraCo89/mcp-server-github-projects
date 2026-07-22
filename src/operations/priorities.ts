import { z } from 'zod';
import { GraphQLClient } from '../common/utils.js';
import { createGitHubError } from '../common/errors.js';
import { resolveGithubProjectId } from '../common/utils.js';

// Schema for priority assessment criteria
export const PriorityAssessmentSchema = z.object({
  project_id: z.string().optional(),
  item_id: z.string(),
  priority_field_name: z.string().default('Priority'),
  criteria: z.object({
    business_value: z.enum(['high', 'medium', 'low']),
    technical_complexity: z.enum(['high', 'medium', 'low']),
    client_priority: z.enum(['urgent', 'high', 'normal', 'low'])
  })
});

// Schema for batch priority updates
export const BatchPriorityUpdateSchema = z.object({
  project_id: z.string().optional(),
  priority_field_name: z.string().default('Priority'),
  items: z.array(z.object({
    item_id: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  }))
});

const PRIORITY_FIELD_QUERY = `
  query GetPriorityField($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 100) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options { id name }
            }
          }
        }
      }
    }
  }
`;

const UPDATE_PRIORITY = `
  mutation UpdateProjectItemPriority($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item { id }
    }
  }
`;

async function getPriorityField(client: GraphQLClient, projectId: string, fieldName: string) {
  const response = await client.request(PRIORITY_FIELD_QUERY, { projectId });
  const fields = response?.data?.node?.fields?.nodes ?? [];
  const field = fields.find((candidate: { name?: string }) =>
    candidate.name?.toLowerCase() === fieldName.toLowerCase());
  if (!field?.id || !Array.isArray(field.options)) {
    throw new Error(`Single-select field '${fieldName}' was not found in the project`);
  }
  return field as { id: string; options: Array<{ id: string; name: string }> };
}

async function updatePriority(
  client: GraphQLClient,
  projectId: string,
  itemId: string,
  field: { id: string; options: Array<{ id: string; name: string }> },
  priority: string
) {
  const option = field.options.find((candidate) => candidate.name.toLowerCase() === priority.toLowerCase());
  if (!option) throw new Error(`Priority option '${priority}' was not found`);
  await client.request(UPDATE_PRIORITY, {
    input: {
      projectId,
      itemId,
      fieldId: field.id,
      value: { singleSelectOptionId: option.id },
    }
  });
}

export async function assessItemPriority(
  client: GraphQLClient,
  args: z.infer<typeof PriorityAssessmentSchema>
) {
  const projectId = await resolveGithubProjectId({ projectId: args.project_id });
  const priority = calculateOverallPriority(args.criteria);

  try {
    const field = await getPriorityField(client, projectId, args.priority_field_name);
    await updatePriority(client, projectId, args.item_id, field, priority);

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
  const projectId = await resolveGithubProjectId({ projectId: args.project_id });
  const results = [];
  const field = await getPriorityField(client, projectId, args.priority_field_name);
  
  for (const item of args.items) {
    try {
      await updatePriority(client, projectId, item.item_id, field, item.priority);

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
