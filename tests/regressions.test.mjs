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
              nodes: [{ content: { id: 'I_1', state: 'OPEN', createdAt: '2026-01-01T00:00:00Z', closedAt: null, blockedBy: { nodes: [] }, blocking: { nodes: [] } } }],
              pageInfo: { hasNextPage: true, endCursor: 'cursor-1' }
            }
          }
        }
      },
      {
        data: {
          node: {
            items: {
              nodes: [{ content: { id: 'I_2', state: 'CLOSED', createdAt: '2026-01-01T00:00:00Z', closedAt: '2026-01-03T00:00:00Z', blockedBy: { nodes: [] }, blocking: { nodes: [] } } }],
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
        return pages[this.calls.length - 1];
      }
    };
    const metricsClient = {
      calls: [],
      async request(query, variables) {
        this.calls.push({ query, variables });
        return pages[this.calls.length - 1];
      }
    };
    const { analyzeDependencies } = await import('../dist/operations/dependencies.js');
    const { generateProjectMetrics } = await import('../dist/operations/metrics.js');

    const analysis = await analyzeDependencies(dependencyClient, { criteria: { check_cycles: true } });
    const metrics = await generateProjectMetrics(metricsClient, { metrics: ['completion_rate'] });

    assert.equal(dependencyClient.calls.length, 2);
    assert.equal(metricsClient.calls.length, 2);
    assert.equal(analysis.cycles.hasCycles, false);
    assert.deepEqual(metrics.completion_rate, { completed: 1, total: 2, rate: 0.5 });
  });
});
