import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { Client } from '../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

test('GitHub Projects MCP exposes its complete tool and resource surface', async () => {
  const root = process.cwd();
  const server = join(root, 'dist', 'index.js');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server],
    cwd: root,
    env: process.env,
    stderr: 'pipe'
  });
  const client = new Client({ name: 'tool-surface-test', version: '1.0.0' });

  await client.connect(transport);

  try {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);

    assert.deepEqual(names.sort(), [
      'analyzeDependencies',
      'addProjectItem',
      'assessItemPriority',
      'batchUpdatePriorities',
      'createDraftIssue',
      'createIssue',
      'createProject',
      'deleteProjectItem',
      'generateProjectMetrics',
      'getProjectFields',
      'listOrganizationProjects',
      'listProjectItems',
      'listProjectViews',
      'listUserProjects',
      'manageItemDependencies',
      'updateDraftIssue',
      'updateIssue',
      'updateProjectField'
    ].sort());

    const { resourceTemplates } = await client.listResourceTemplates();
    assert.deepEqual(
      resourceTemplates.map((template) => template.uriTemplate).sort(),
      [
        'github-projects://project/{projectId}',
        'github-projects://project/{projectId}/fields',
        'github-projects://project/{projectId}/items',
        'github-projects://project/{projectId}/items/{itemId}',
        'github-projects://project/{projectId}/views'
      ]
    );
  } finally {
    await transport.close();
  }
});
