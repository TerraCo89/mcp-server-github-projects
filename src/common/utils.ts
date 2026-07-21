import fetch from 'node-fetch';
import { z } from 'zod';

// GraphQL client type
export type GraphQLClient = {
  request: (query: string, variables?: Record<string, any>) => Promise<any>;
};

export type GithubProjectsDefaults = {
  owner?: string;
  projectId?: string;
  projectNumber?: number;
};

// GitHub API request options type
type GitHubRequestOptions = {
  method?: string;
  body?: Record<string, any>;
  headers?: Record<string, string>;
};

/**
 * Make a request to the GitHub API
 */
export async function githubRequest(
  url: string,
  options: GitHubRequestOptions = {}
) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const fetchImpl = globalThis.fetch ?? fetch;
  const response = await fetchImpl(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${error}`);
  }

  return response.json();
}

function parseOptionalNumber(value: string | undefined) {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getGithubProjectsDefaults(): GithubProjectsDefaults {
  return {
    owner: process.env.GITHUB_PROJECTS_OWNER?.trim() || undefined,
    projectId: process.env.GITHUB_PROJECTS_PROJECT_ID?.trim() || undefined,
    projectNumber: parseOptionalNumber(process.env.GITHUB_PROJECTS_PROJECT_NUMBER)
  };
}

export function resolveGithubProjectOwner(owner?: string) {
  return owner?.trim() || getGithubProjectsDefaults().owner;
}

export async function resolveGithubProjectId(
  input: { projectId?: string; owner?: string; projectNumber?: number } = {}
) {
  const defaults = getGithubProjectsDefaults();
  const projectId = input.projectId?.trim() || defaults.projectId;
  if (projectId) return projectId;

  const projectNumber = input.projectNumber ?? defaults.projectNumber;
  const owner = resolveGithubProjectOwner(input.owner);
  if (!owner || projectNumber === undefined) {
    throw new Error('owner and project number are required unless GITHUB_PROJECTS_PROJECT_ID is set');
  }

  for (const scope of ['orgs', 'users'] as const) {
    try {
      const response = await githubRequest(
        `https://api.github.com/${scope}/${owner}/projects/v2/${projectNumber}`,
        { headers: { Accept: 'application/vnd.github.project-beta+json' } }
      );

      if (response?.node_id) {
        return String(response.node_id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('404') && !message.includes('Not Found')) {
        throw error;
      }
    }
  }

  throw new Error('GitHub Projects lookup did not return a node_id');
}

export async function resolveGithubOwnerNodeId(owner?: string) {
  const resolvedOwner = resolveGithubProjectOwner(owner);
  if (!resolvedOwner) {
    throw new Error('owner is required unless GITHUB_PROJECTS_OWNER is set');
  }

  for (const scope of ['orgs', 'users'] as const) {
    try {
      const response = await githubRequest(
        `https://api.github.com/${scope}/${resolvedOwner}`,
        { headers: { Accept: 'application/vnd.github+json' } }
      );

      if (response?.node_id) {
        return String(response.node_id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('404') && !message.includes('Not Found')) {
        throw error;
      }
    }
  }

  throw new Error('GitHub owner lookup did not return a node_id');
}
