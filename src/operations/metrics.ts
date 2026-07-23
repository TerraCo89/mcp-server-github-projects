import { z } from 'zod';
import { GraphQLClient, resolveGithubProjectId } from '../common/utils.js';
import { createGitHubError } from '../common/errors.js';

export const ProjectMetricsSchema = z.object({
  project_id: z.string().optional(),
  metrics: z.array(z.enum([
    'backlog_health',
    'dependency_status',
    'priority_distribution',
    'completion_rate',
    'cycle_time'
  ]))
});

type DependencyIssue = { id: string; state: string };
type ProjectItem = {
  fieldValues: { nodes: Array<{ name: string; field: { name: string } | null }> };
  content: {
    __typename: string;
    id: string;
    state: string;
    createdAt: string;
    closedAt: string | null;
    blockedBy?: { nodes: DependencyIssue[] };
  } | null;
};

const metricsQuery = `
  query GetProjectMetrics($projectId: ID!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            fieldValues(first: 100) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField { name }
                  }
                }
              }
            }
            content {
              __typename
              ... on Issue {
                id state createdAt closedAt
              }
              ... on PullRequest {
                id state createdAt closedAt
              }
            }
          }
        }
      }
    }
  }
`;

const blockedByQuery = `
  query GetIssueBlockedBy($issueId: ID!, $after: String) {
    node(id: $issueId) {
      ... on Issue {
        blockedBy(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { id state }
        }
      }
    }
  }
`;

function itemsFrom(data: any): ProjectItem[] {
  return (data?.data?.node?.items?.nodes ?? []) as ProjectItem[];
}

async function populateBlockedBy(client: GraphQLClient, items: ProjectItem[]) {
  const issues = items.filter((item) => item.content?.__typename === 'Issue' && item.content.id);
  for (const item of issues) {
    const blockers: DependencyIssue[] = [];
    let after: string | null = null;
    do {
      const response = await client.request(blockedByQuery, { issueId: item.content!.id, after });
      const blockedBy = response?.data?.node?.blockedBy;
      blockers.push(...(blockedBy?.nodes ?? []));
      after = blockedBy?.pageInfo?.hasNextPage ? blockedBy.pageInfo.endCursor : null;
    } while (after);
    item.content!.blockedBy = { nodes: blockers };
  }
}

function selectedValue(item: ProjectItem, fieldName: string) {
  return item.fieldValues.nodes.find((value) => value.field?.name.toLowerCase() === fieldName)?.name;
}

function openItems(items: ProjectItem[]) {
  return items.filter((item) => item.content?.state === 'OPEN');
}

function calculateBacklogHealth(items: ProjectItem[]) {
  const backlog = openItems(items);
  const staleBefore = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const hasSingleSelectValue = (item: ProjectItem) => item.fieldValues.nodes.some((value) => Boolean(value.field?.name));
  const ungroomed = backlog.filter((item) => !selectedValue(item, 'status')).length;
  const missingFields = backlog.filter((item) => !hasSingleSelectValue(item)).length;
  const stale = backlog.filter((item) => {
    const createdAt = item.content?.createdAt;
    return createdAt ? new Date(createdAt).getTime() < staleBefore : false;
  }).length;
  const healthy = backlog.length - new Set(backlog.flatMap((item, index) => {
    const staleItem = item.content?.createdAt && new Date(item.content.createdAt).getTime() < staleBefore;
    return !selectedValue(item, 'status') || !hasSingleSelectValue(item) || staleItem ? [index] : [];
  })).size;
  return {
    score: backlog.length ? Math.round((healthy / backlog.length) * 100) : null,
    issues: { ungroomed, missing_fields: missingFields, stale }
  };
}

function dependencyGraph(items: ProjectItem[]) {
  const issues = items.filter((item) => Boolean(item.content?.blockedBy && item.content?.id));
  const ids = new Set(issues.map((item) => item.content!.id));
  return new Map(issues.map((item) => [
    item.content!.id,
    (item.content!.blockedBy?.nodes ?? []).map((issue) => issue.id).filter((id) => ids.has(id))
  ]));
}

function calculateDependencyStatus(items: ProjectItem[]) {
  const graph = dependencyGraph(items);
  const blockedItems = items.filter((item) => item.content?.state === 'OPEN' &&
    (item.content.blockedBy?.nodes ?? []).some((blocker) => blocker.state === 'OPEN')).length;
  let maxChainLength = 0;
  const circularCycles = new Set<string>();
  const walk = (id: string, depth: number, path: string[]): void => {
    const cycleStart = path.indexOf(id);
    if (cycleStart !== -1) {
      circularCycles.add(path.slice(cycleStart).sort().join(','));
      return;
    }
    maxChainLength = Math.max(maxChainLength, depth);
    for (const blocker of graph.get(id) ?? []) walk(blocker, depth + 1, [...path, id]);
  };
  for (const id of graph.keys()) walk(id, 1, []);
  return { blocked_items: blockedItems, max_chain_length: maxChainLength, circular_dependencies: circularCycles.size };
}

function calculatePriorityDistribution(items: ProjectItem[]) {
  const distribution = { high: 0, medium: 0, low: 0, unset: 0 };
  for (const item of items) {
    const priority = selectedValue(item, 'priority')?.toLowerCase();
    if (priority === 'high') distribution.high++;
    else if (priority === 'medium') distribution.medium++;
    else if (priority === 'low') distribution.low++;
    else distribution.unset++;
  }
  return distribution;
}

function calculateCompletionRate(items: ProjectItem[]) {
  const tracked = items.filter((item) => Boolean(item.content));
  const completed = tracked.filter((item) => item.content!.state !== 'OPEN').length;
  return { completed, total: tracked.length, rate: tracked.length ? completed / tracked.length : null };
}

function calculateCycleTime(items: ProjectItem[]) {
  const durations = items.flatMap((item) => {
    const content = item.content;
    if (!content?.closedAt) return [];
    const days = (new Date(content.closedAt).getTime() - new Date(content.createdAt).getTime()) / 86_400_000;
    return Number.isFinite(days) && days >= 0 ? [{ days, status: selectedValue(item, 'status') ?? 'unset' }] : [];
  });
  const byStatus: Record<string, number> = {};
  for (const status of new Set(durations.map((duration) => duration.status))) {
    const statusDurations = durations.filter((duration) => duration.status === status);
    byStatus[status] = statusDurations.reduce((sum, duration) => sum + duration.days, 0) / statusDurations.length;
  }
  return {
    average_days: durations.length ? durations.reduce((sum, duration) => sum + duration.days, 0) / durations.length : null,
    by_status: byStatus
  };
}

/** Generate metrics from project item content, fields, and Issue dependency edges. */
export async function generateProjectMetrics(
  client: GraphQLClient,
  args: z.infer<typeof ProjectMetricsSchema>
) {
  const projectId = await resolveGithubProjectId({ projectId: args.project_id });
  try {
    const items: ProjectItem[] = [];
    let after: string | null = null;
    do {
      const response = await client.request(metricsQuery, { projectId, after });
      items.push(...itemsFrom(response));
      const pageInfo = response?.data?.node?.items?.pageInfo;
      after = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
    } while (after);
    if (args.metrics.includes('dependency_status')) await populateBlockedBy(client, items);
    const metrics: Record<string, unknown> = {};
    for (const metric of args.metrics) {
      if (metric === 'backlog_health') metrics.backlog_health = calculateBacklogHealth(items);
      if (metric === 'dependency_status') metrics.dependency_status = calculateDependencyStatus(items);
      if (metric === 'priority_distribution') metrics.priority_distribution = calculatePriorityDistribution(items);
      if (metric === 'completion_rate') metrics.completion_rate = calculateCompletionRate(items);
      if (metric === 'cycle_time') metrics.cycle_time = calculateCycleTime(items);
    }
    return metrics;
  } catch (error) {
    if (error instanceof Error) {
      throw createGitHubError(500, { message: error.message });
    }
    throw createGitHubError(500, { message: 'Failed to generate project metrics' });
  }
}
