import fetch from 'node-fetch';
import { z } from 'zod';

// GraphQL client type
export type GraphQLClient = {
  request: (query: string, variables?: Record<string, any>) => Promise<any>;
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

  const response = await fetch(url, {
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