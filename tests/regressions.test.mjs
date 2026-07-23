import assert from 'node:assert/strict';
import test from 'node:test';

async function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function response(body) {
  return {
    ok: true,
    async json() { return body; },
    async text() { return JSON.stringify(body); }
  };
}

test('GitHub GraphQL errors are surfaced to callers', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ errors: [{ message: 'Repository access denied' }] });

  try {
    await withEnv({ GITHUB_TOKEN: 'token' }, async () => {
      const { createIssue } = await import('../dist/operations/issues.js');
      await assert.rejects(
        createIssue('owner', 'repo', 'Title', undefined, undefined),
        /GitHub GraphQL error: Repository access denied/
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('dependency analysis and metrics fetch every project item page', async () => {
  await withEnv({ GITHUB_PROJECTS_PROJECT_ID: 'PVT_1' }, async () => {
    const pages = [
      {
        data: {
          node: {
            items: {
              nodes: [{ content: { __typename: 'Issue', id: 'I_1', state: 'OPEN', createdAt: '2026-01-01T00:00:00Z', closedAt: null, blockedBy: { nodes: [] }, blocking: { nodes: [] } } }],
              pageInfo: { hasNextPage: true, endCursor: 'cursor-1' }
            }
          }
        }
      },
      {
        data: {
          node: {
            items: {
              nodes: [{ content: { __typename: 'Issue', id: 'I_2', state: 'CLOSED', createdAt: '2026-01-01T00:00:00Z', closedAt: '2026-01-03T00:00:00Z', blockedBy: { nodes: [] }, blocking: { nodes: [] } } }],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        }
      }
    ];
    const dependencyClient = {
      calls: [],
      async request(query, variables) {
        this.calls.push({ query, variables });
        if (query.includes('GetProjectDependencies')) {
          return variables.after ? pages[1] : pages[0];
        }
        if (query.includes('GetIssueBlockers')) {
          if (variables.issueId === 'I_1' && !variables.after) {
            return { data: { node: { blockedBy: { nodes: [{ id: 'I_3', state: 'OPEN' }], pageInfo: { hasNextPage: true, endCursor: 'blocker-cursor' } } } } };
          }
          return { data: { node: { blockedBy: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } };
        }
        throw new Error(`Unexpected query: ${query}`);
      }
    };
    const metricsClient = {
      calls: [],
      async request(query, variables) {
        this.calls.push({ query, variables });
        if (query.includes('GetProjectMetrics')) return variables.after ? pages[1] : pages[0];
        if (query.includes('GetIssueBlockedBy')) {
          if (variables.issueId === 'I_1' && !variables.after) {
            return { data: { node: { blockedBy: { nodes: [{ id: 'I_3', state: 'OPEN' }], pageInfo: { hasNextPage: true, endCursor: 'metric-blocker-cursor' } } } } };
          }
          return { data: { node: { blockedBy: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } };
        }
        throw new Error(`Unexpected query: ${query}`);
      }
    };
    const { analyzeDependencies } = await import('../dist/operations/dependencies.js');
    const { generateProjectMetrics } = await import('../dist/operations/metrics.js');

    const analysis = await analyzeDependencies(dependencyClient, { criteria: { check_cycles: true } });
    const metrics = await generateProjectMetrics(metricsClient, { metrics: ['completion_rate', 'dependency_status'] });

    assert.equal(dependencyClient.calls.length, 5);
    assert.equal(metricsClient.calls.length, 5);
    assert.equal(dependencyClient.calls[1].variables.after, 'cursor-1');
    assert.equal(dependencyClient.calls[3].variables.after, 'blocker-cursor');
    assert.equal(metricsClient.calls[1].variables.after, 'cursor-1');
    assert.equal(metricsClient.calls[3].variables.after, 'metric-blocker-cursor');
    assert.equal(analysis.cycles.hasCycles, false);
    assert.deepEqual(metrics.completion_rate, { completed: 1, total: 2, rate: 0.5 });
  });
});

test('createIssue reports a created issue when adding it to a project fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const query = JSON.parse(options.body).query;
    if (query.includes('GetRepoId')) return response({ data: { repository: { id: 'R_1' } } });
    if (query.includes('CreateIssue')) return response({ data: { createIssue: { issue: { id: 'I_1', title: 'Created issue' } } } });
    if (query.includes('AddProjectItem')) return response({ errors: [{ message: 'Project access denied' }] });
    throw new Error(`Unexpected request: ${query}`);
  };

  try {
    await withEnv({ GITHUB_TOKEN: 'token' }, async () => {
      const { createIssue } = await import('../dist/operations/issues.js');
      const result = await createIssue('owner', 'repo', 'Title', undefined, 'PVT_1');
      assert.deepEqual(result, {
        issue: { id: 'I_1', title: 'Created issue' },
        added_to_project: false,
        project_add_error: 'GitHub GraphQL error: Project access denied'
      });
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createIssue preserves the issue response after successful creation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const query = JSON.parse(options.body).query;
    if (query.includes('GetRepoId')) return response({ data: { repository: { id: 'R_1' } } });
    if (query.includes('CreateIssue')) return response({ data: { createIssue: { issue: { id: 'I_1', number: 1, title: 'Created issue' } } } });
    throw new Error(`Unexpected request: ${query}`);
  };

  try {
    await withEnv({ GITHUB_TOKEN: 'token' }, async () => {
      const { createIssue } = await import('../dist/operations/issues.js');
      assert.deepEqual(
        await createIssue('owner', 'repo', 'Title', undefined, undefined),
        { id: 'I_1', number: 1, title: 'Created issue' }
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
