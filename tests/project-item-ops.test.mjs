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

test('project item tools list and edit items', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const body = String(options?.body ?? '');

    if (body.includes('ListProjectItems')) {
      return makeResponse({
        data: {
          node: {
            items: {
              nodes: [{ id: 'item-1', content: { __typename: 'DraftIssue', title: 'Ticket 1', body: 'Body' } }]
            }
          }
        }
      });
    }

    if (body.includes('AddProjectItem')) {
      return makeResponse({ data: { addProjectV2Item: { item: { id: 'added-item' } } } });
    }

    if (body.includes('DeleteProjectItem')) {
      return makeResponse({ data: { deleteProjectV2Item: { deletedItemId: 'deleted-item' } } });
    }

    if (body.includes('UpdateProjectField')) {
      return makeResponse({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'updated-item' } } } });
    }

    throw new Error(`unexpected request: ${body}`);
  };

  try {
    await withEnv({ GITHUB_TOKEN: 'token' }, async () => {
      const { listProjectItems, addProjectItem, deleteProjectItem } = await import('../dist/operations/project-items.js');
      const { updateProjectField } = await import('../dist/operations/projects.js');

      const listed = await listProjectItems('PVT_test', { per_page: 10 });
      assert.equal(listed[0].content.title, 'Ticket 1');

      const added = await addProjectItem('PVT_test', 'content-123');
      assert.equal(added.id, 'added-item');

      await deleteProjectItem('PVT_test', 'item-123');

      await updateProjectField('PVT_test', 'item-123', 'field-123', { singleSelectOptionId: 'opt-1' });
    });

    assert.equal(calls.length, 4);
    assert.match(String(calls[0].options.body), /ListProjectItems/);
    assert.match(String(calls[1].options.body), /AddProjectItem/);
    assert.match(String(calls[2].options.body), /DeleteProjectItem/);
    assert.match(String(calls[3].options.body), /UpdateProjectField/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
