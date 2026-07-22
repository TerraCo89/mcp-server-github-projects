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
  mutation CreateDraftIssue($input: CreateDraftIssueInput!) {
    createDraftIssue(input: $input) {
      draftIssue {
        id
        title
        body
      }
    }
  }
`;

const UPDATE_DRAFT_ISSUE = `
  mutation UpdateDraftIssue($input: UpdateDraftIssueInput!) {
    updateDraftIssue(input: $input) {
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
  return (response as any).data.createDraftIssue.draftIssue;
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
    return { __typename: node.content.__typename, id: node.content.id };
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
    input: { id: contentId }
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

  const result = (response as any).data?.updateDraftIssue?.draftIssue;
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
  const repoId = (repoResponse as any).data.repository.id;
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

  const issue = (response as any).data.createIssue.issue;

  if (project_id) {
    const resolvedProjectId = await resolveGithubProjectId({ projectId: project_id });
    await githubRequest("https://api.github.com/graphql", {
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
  }

  return issue;
}
