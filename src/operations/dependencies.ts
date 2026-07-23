import { z } from 'zod';
import { GraphQLClient, resolveGithubProjectId } from '../common/utils.js';
import { createGitHubError } from '../common/errors.js';

export const DependencyManagementSchema = z.object({
  project_id: z.string().optional(),
  item_id: z.string(),
  dependencies: z.object({
    blocks: z.array(z.string()).optional(),
    blocked_by: z.array(z.string()).optional()
  })
});

export const DependencyAnalysisSchema = z.object({
  project_id: z.string().optional(),
  criteria: z.object({
    check_cycles: z.boolean().optional(),
    check_missing: z.boolean().optional(),
    check_status: z.boolean().optional()
  })
});

type IssueReference = { id: string; state: string };
type ProjectIssue = IssueReference & {
  blockedBy: { nodes: IssueReference[] };
  blocking: { nodes: IssueReference[] };
};

const resolveIssueQuery = `
  query ResolveDependencyIssue($id: ID!) {
    node(id: $id) {
      __typename
      ... on Issue {
        id
      }
      ... on ProjectV2Item {
        content {
          __typename
          ... on Issue {
            id
          }
        }
      }
    }
  }
`;

async function resolveIssueId(client: GraphQLClient, id: string) {
  const response = await client.request(resolveIssueQuery, { id });
  const node = response?.data?.node;
  if (!node) {
    throw new Error(`No GitHub node was found for '${id}'`);
  }

  if (node.__typename === 'Issue' && node.id) {
    return String(node.id);
  }

  if (node.__typename === 'ProjectV2Item') {
    if (node.content?.__typename === 'Issue' && node.content.id) {
      return String(node.content.id);
    }
    if (node.content?.__typename === 'DraftIssue') {
      throw new Error(`Project item '${id}' is a Draft Issue; GitHub dependencies can only be created between Issues`);
    }
  }

  throw new Error(`'${id}' must be an Issue ID or a ProjectV2Item whose content is an Issue`);
}

/** Manage Issue dependency edges for project items or direct Issue IDs. */
export async function manageItemDependencies(
  client: GraphQLClient,
  args: z.infer<typeof DependencyManagementSchema>
) {
  try {
    const currentIssueId = await resolveIssueId(client, args.item_id);
    const blocks = await Promise.all((args.dependencies.blocks ?? []).map((id) => resolveIssueId(client, id)));
    const blockedBy = await Promise.all((args.dependencies.blocked_by ?? []).map((id) => resolveIssueId(client, id)));
    const mutation = `
      mutation AddBlockedBy($issueId: ID!, $blockingIssueId: ID!) {
        addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
          clientMutationId
        }
      }
    `;

    // The mutation models "issue is blocked by blockingIssue".
    for (const issueId of blocks) {
      await client.request(mutation, { issueId, blockingIssueId: currentIssueId });
    }
    for (const blockingIssueId of blockedBy) {
      await client.request(mutation, { issueId: currentIssueId, blockingIssueId });
    }

    return { success: true, added: { blocks: blocks.length, blocked_by: blockedBy.length } };
  } catch (error) {
    if (error instanceof Error) {
      throw createGitHubError(500, { message: error.message });
    }
    throw createGitHubError(500, { message: 'Failed to add item dependencies' });
  }
}

const projectDependenciesQuery = `
  query GetProjectDependencies($projectId: ID!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            content {
              ... on Issue {
                id
                state
              }
            }
          }
        }
      }
    }
  }
`;

const issueBlockersQuery = `
  query GetIssueBlockers($issueId: ID!, $after: String) {
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

function projectIssues(data: any): ProjectIssue[] {
  return (data?.data?.node?.items?.nodes ?? [])
    .map((item: { content?: IssueReference }) => item.content)
    .filter((content: IssueReference | undefined): content is IssueReference => Boolean(content?.id))
    .map((content: IssueReference) => ({ ...content, blockedBy: { nodes: [] }, blocking: { nodes: [] } }));
}

async function populateBlockers(client: GraphQLClient, issue: ProjectIssue) {
  let after: string | null = null;
  do {
    const response = await client.request(issueBlockersQuery, { issueId: issue.id, after });
    const blockedBy = response?.data?.node?.blockedBy;
    issue.blockedBy.nodes.push(...(blockedBy?.nodes ?? []));
    after = blockedBy?.pageInfo?.hasNextPage ? blockedBy.pageInfo.endCursor : null;
  } while (after);
}

function findDependencyCycles(issues: ProjectIssue[]) {
  const issueIds = new Set(issues.map((issue) => issue.id));
  const blockers = new Map(issues.map((issue) => [
    issue.id,
    issue.blockedBy.nodes.map((blocker) => blocker.id).filter((id) => issueIds.has(id))
  ]));
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const active = new Set<string>();
  const path: string[] = [];

  const visit = (id: string) => {
    if (active.has(id)) {
      cycles.push([...path.slice(path.indexOf(id)), id]);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    active.add(id);
    path.push(id);
    for (const blocker of blockers.get(id) ?? []) visit(blocker);
    path.pop();
    active.delete(id);
  };

  for (const issue of issues) visit(issue.id);
  return { hasCycles: cycles.length > 0, cycles };
}

function findMissingDependencies(issues: ProjectIssue[]) {
  const issueIds = new Set(issues.map((issue) => issue.id));
  const missing = issues.flatMap((issue) => issue.blockedBy.nodes
    .filter((blocker) => !issueIds.has(blocker.id))
    .map((blocker) => ({ issue_id: issue.id, blocking_issue_id: blocker.id })));
  return { hasMissing: missing.length > 0, missing };
}

function analyzeDependencyStatus(issues: ProjectIssue[]) {
  const blockedOpenIssues = issues.flatMap((issue) => {
    if (issue.state !== 'OPEN') return [];
    return issue.blockedBy.nodes
      .filter((blocker) => blocker.state === 'OPEN')
      .map((blocker) => ({ issue_id: issue.id, blocking_issue_id: blocker.id }));
  });
  return { blocked_open_count: blockedOpenIssues.length, blocked_open: blockedOpenIssues };
}

/** Analyze Issue dependency edges represented by the contents of project items. */
export async function analyzeDependencies(
  client: GraphQLClient,
  args: z.infer<typeof DependencyAnalysisSchema>
) {
  const projectId = await resolveGithubProjectId({ projectId: args.project_id });
  try {
    const issues: ProjectIssue[] = [];
    let after: string | null = null;
    do {
      const response = await client.request(projectDependenciesQuery, { projectId, after });
      issues.push(...projectIssues(response));
      const pageInfo = response?.data?.node?.items?.pageInfo;
      after = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
    } while (after);
    for (const issue of issues) await populateBlockers(client, issue);
    return {
      cycles: args.criteria.check_cycles ? findDependencyCycles(issues) : undefined,
      missing: args.criteria.check_missing ? findMissingDependencies(issues) : undefined,
      status: args.criteria.check_status ? analyzeDependencyStatus(issues) : undefined
    };
  } catch (error) {
    if (error instanceof Error) {
      throw createGitHubError(500, { message: error.message });
    }
    throw createGitHubError(500, { message: 'Failed to analyze dependencies' });
  }
}
