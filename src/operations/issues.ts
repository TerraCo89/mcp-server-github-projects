import { z } from "zod";
import { githubRequest, resolveGithubProjectId } from "../common/utils.js";

export const CreateDraftIssueSchema = z.object({
  project_id: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
});

export const UpdateDraftIssueSchema = z.object({
  item_id: z.string(),
  title: z.string().optional(),
  body: z.string().optional(),
});

export const UpdateIssueSchema = z.object({
  issue_id: z.string(),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(["OPEN", "CLOSED"]).optional(),
});

export const CreateIssueSchema = z.object({
  repo_owner: z.string(),
  repo_name: z.string(),
  title: z.string(),
  body: z.string().optional(),
  project_id: z.string().optional(),
});

const RESOLVE_CONTENT_ID = `
  query ResolveContentId($itemId: ID!) {
    node(id: $itemId) {
      __typename
      id
      ... on ProjectV2Item {
        content {
          __typename
          ... on DraftIssue { id }
          ... on Issue { id }
        }
      }
      ... on DraftIssue { id }
      ... on Issue { id }
    }
  }
`;

const GET_REPO_ID = `
  query GetRepoId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`;

const CREATE_DRAFT_ISSUE = `
  mutation AddProjectV2DraftIssue($input: AddProjectV2DraftIssueInput!) {
    addProjectV2DraftIssue(input: $input) {
      projectItem {
        id
      }
    }
  }
`;

const UPDATE_DRAFT_ISSUE = `
  mutation UpdateProjectV2DraftIssue($input: UpdateProjectV2DraftIssueInput!) {
    updateProjectV2DraftIssue(input: $input) {
      draftIssue {
        id
        title
        body
      }
    }
  }
`;

const UPDATE_ISSUE = `
  mutation UpdateIssue($input: UpdateIssueInput!) {
    updateIssue(input: $input) {
      issue {
        id
        number
        title
        body
        state
      }
    }
  }
`;

const CREATE_ISSUE = `
  mutation CreateIssue($input: CreateIssueInput!) {
    createIssue(input: $input) {
      issue {
        id
        number
        title
        body
        state
        url
      }
    }
  }
`;

const ADD_TO_PROJECT = `
  mutation AddProjectItem($input: AddProjectV2ItemByIdInput!) {
    addProjectV2ItemById(input: $input) {
      item {
        id
      }
    }
  }
`;

export async function createDraftIssue(
  project_id: string | undefined,
  title: string,
  body: string | undefined
) {
  const resolvedProjectId = await resolveGithubProjectId({ projectId: project_id });
  const response = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: CREATE_DRAFT_ISSUE,
      variables: {
        input: {
          projectId: resolvedProjectId,
          title,
          body: body || "",
        }
      }
    }
  });
  const result = (response as any).data?.addProjectV2DraftIssue?.projectItem;
  if (!result) {
    const errors = (response as any).errors;
    throw new Error(errors ? errors.map((e: any) => e.message).join('; ') : 'Failed to create draft issue');
  }
  return result;
}

async function resolveContentId(id: string): Promise<{ __typename: string; id: string }> {
  const response = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: { query: RESOLVE_CONTENT_ID, variables: { itemId: id } }
  });
  const node = (response as any).data?.node;
  if (!node) throw new Error(`Item not found: ${id}`);

  if (node.__typename === 'ProjectV2Item') {
    if (!node.content) throw new Error(`Item ${id} has no resolvable content`);
    if (!node.content.id || node.content.__typename !== 'DraftIssue' && node.content.__typename !== 'Issue') {
      throw new Error(`Item ${id} does not contain an editable draft issue or issue`);
    }
    return { __typename: node.content.__typename, id: node.content.id };
  }
  if (!node.id || node.__typename !== 'DraftIssue' && node.__typename !== 'Issue') {
    throw new Error(`Item ${id} is not an editable draft issue or issue`);
  }
  return { __typename: node.__typename, id: node.id };
}

export async function updateDraftIssue(
  item_id: string,
  title: string | undefined,
  body: string | undefined
) {
  const { id: contentId } = await resolveContentId(item_id);
  const variables: Record<string, any> = {
    input: { draftIssueId: contentId }
  };
  if (title !== undefined) variables.input.title = title;
  if (body !== undefined) variables.input.body = body;

  const response = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: UPDATE_DRAFT_ISSUE,
      variables
    }
  });

  const result = (response as any).data?.updateProjectV2DraftIssue?.draftIssue;
  if (!result) {
    const errors = (response as any).errors;
    throw new Error(errors ? errors.map((e: any) => e.message).join('; ') : 'Failed to update draft issue');
  }
  return result;
}

export async function updateIssue(
  issue_id: string,
  title: string | undefined,
  body: string | undefined,
  state: "OPEN" | "CLOSED" | undefined
) {
  const { id: contentId } = await resolveContentId(issue_id);
  const variables: Record<string, any> = {
    input: { id: contentId }
  };
  if (title !== undefined) variables.input.title = title;
  if (body !== undefined) variables.input.body = body;
  if (state !== undefined) variables.input.state = state;

  const response = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: UPDATE_ISSUE,
      variables
    }
  });

  const result = (response as any).data?.updateIssue?.issue;
  if (!result) {
    const errors = (response as any).errors;
    throw new Error(errors ? errors.map((e: any) => e.message).join('; ') : 'Failed to update issue');
  }
  return result;
}

export async function createIssue(
  repo_owner: string,
  repo_name: string,
  title: string,
  body: string | undefined,
  project_id: string | undefined
) {
  const repoResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: GET_REPO_ID,
      variables: { owner: repo_owner, name: repo_name }
    }
  });
  const repoId = (repoResponse as any).data?.repository?.id;
  if (!repoId) throw new Error(`Repository ${repo_owner}/${repo_name} not found`);

  const response = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: CREATE_ISSUE,
      variables: {
        input: {
          repositoryId: repoId,
          title,
          body: body || "",
        }
      }
    }
  });

  const issue = (response as any).data?.createIssue?.issue;
  if (!issue?.id) throw new Error('GitHub did not return the created issue');

  if (!project_id) {
    return issue;
  }

  try {
    const resolvedProjectId = await resolveGithubProjectId({ projectId: project_id });
    const projectResponse = await githubRequest("https://api.github.com/graphql", {
      method: "POST",
      body: {
        query: ADD_TO_PROJECT,
        variables: {
          input: {
            projectId: resolvedProjectId,
            contentId: issue.id
          }
        }
      }
    });
    if (!(projectResponse as any).data?.addProjectV2ItemById?.item?.id) {
      throw new Error(`GitHub did not add issue ${issue.id} to project ${resolvedProjectId}`);
    }
    return issue;
  } catch (error) {
    return {
      issue,
      added_to_project: false,
      project_add_error: error instanceof Error ? error.message : 'Failed to add issue to project',
    };
  }
}
