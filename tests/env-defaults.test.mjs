import assert from 'node:assert/strict';
import test from 'node:test';

function makeResponse(body) {
  return {
    ok: true,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}

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

test('GitHub Projects env defaults resolve owner + project number', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return makeResponse({ data: { organization: { projectV2: { id: 'project-node-123' } }, user: null } });
    }
    return makeResponse({ data: { node: { fields: { nodes: [{ id: 'field-1', name: 'Status', dataType: 'SINGLE_SELECT' }] } } } });
  };

  try {
    await withEnv({
      GITHUB_TOKEN: 'token',
      GITHUB_PROJECTS_OWNER: 'codelaude',
      GITHUB_PROJECTS_PROJECT_NUMBER: '7'
    }, async () => {
      const { getProjectFields } = await import('../dist/operations/projects.js');
      const fields = await getProjectFields();
      assert.deepEqual(fields, [{ id: 'field-1', name: 'Status', dataType: 'SINGLE_SELECT' }]);
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.github.com/graphql');
    assert.match(String(calls[0].options.body), /"owner":"codelaude"/);
    assert.match(String(calls[0].options.body), /"number":7/);
    assert.equal(calls[1].url, 'https://api.github.com/graphql');
    assert.match(String(calls[1].options.body), /project-node-123/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GitHub Projects env defaults resolve user-owned projects', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return makeResponse({ data: { organization: null, user: { projectV2: { id: 'user-project-node-1' } } } });
    }
    return makeResponse({ data: { node: { fields: { nodes: [] } } } });
  };

  try {
    await withEnv({
      GITHUB_TOKEN: 'token',
      GITHUB_PROJECTS_OWNER: 'jwebcoder',
      GITHUB_PROJECTS_PROJECT_NUMBER: '12'
    }, async () => {
      const { getProjectFields } = await import('../dist/operations/projects.js');
      const fields = await getProjectFields();
      assert.deepEqual(fields, []);
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.github.com/graphql');
    assert.match(String(calls[0].options.body), /"owner":"jwebcoder"/);
    assert.match(String(calls[0].options.body), /"number":12/);
    assert.equal(calls[1].url, 'https://api.github.com/graphql');
    assert.match(String(calls[1].options.body), /user-project-node-1/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GitHub Projects env project id avoids lookup requests', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return makeResponse({ data: { node: { views: { nodes: [{ id: 'view-1', name: 'Board', layout: 'BOARD_LAYOUT', fields: { nodes: [] } }] } } } });
  };

  try {
    await withEnv({
      GITHUB_TOKEN: 'token',
      GITHUB_PROJECTS_PROJECT_ID: 'project-node-456'
    }, async () => {
      const { listProjectViews } = await import('../dist/operations/project-views.js');
      const views = await listProjectViews(undefined, {});
      assert.equal(views[0].id, 'view-1');
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.github.com/graphql');
    assert.match(String(calls[0].options.body), /project-node-456/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GitHub Projects can create a project from env owner defaults', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return makeResponse({ node_id: 'owner-node-1' });
    }
    if (calls.length === 2) {
      return makeResponse({ data: { createProjectV2: { projectV2: { id: 'project-1', number: 99 } } } });
    }
    return makeResponse({ data: { updateProjectV2: { projectV2: { id: 'project-1', number: 99, shortDescription: 'Project board' } } } });
  };

  try {
    await withEnv({
      GITHUB_TOKEN: 'token',
      GITHUB_PROJECTS_OWNER: 'codelaude'
    }, async () => {
      const { createProject } = await import('../dist/operations/projects.js');
      const project = await createProject(undefined, { title: 'Roadmap', description: 'Project board' });
      assert.deepEqual(project, { id: 'project-1', number: 99, shortDescription: 'Project board' });
    });

    assert.equal(calls.length, 3);
    assert.match(calls[0].url, /\/orgs\/codelaude$/);
    assert.equal(calls[1].url, 'https://api.github.com/graphql');
    assert.match(String(calls[1].options.body), /owner-node-1/);
    assert.equal(calls[2].url, 'https://api.github.com/graphql');
    assert.match(String(calls[2].options.body), /shortDescription/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
