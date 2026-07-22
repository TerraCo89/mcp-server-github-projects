import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { Client } from '../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

test('GitHub Projects MCP calls every tool and reads every resource', async () => {
  const root = process.cwd();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--require', join(root, 'tests', 'fixtures', 'github-fetch.cjs'), join(root, 'dist', 'index.js')],
    cwd: root,
    env: {
      ...process.env,
      GITHUB_TOKEN: 'test-token',
      GITHUB_PROJECTS_OWNER: 'test-owner',
      GITHUB_PROJECTS_PROJECT_ID: 'PVT_1'
    },
    stderr: 'pipe'
  });
  const client = new Client({ name: 'mcp-integration-test', version: '1.0.0' });
  await client.connect(transport);

  try {
    const calls = [
      ['listProjectItems', { project_id: 'PVT_1' }],
      ['addProjectItem', { project_id: 'PVT_1', content_id: 'I_1' }],
      ['deleteProjectItem', { project_id: 'PVT_1', item_id: 'PVTI_1' }],
      ['getProjectFields', {}],
      ['updateProjectField', { project_id: 'PVT_1', item_id: 'PVTI_1', field_id: 'FIELD_1', value: 'In progress' }],
      ['createProjectView', { project_id: 'PVT_1', name: 'Board', layout: 'BOARD_LAYOUT' }],
      ['updateProjectView', { project_id: 'PVT_1', view_id: 'VIEW_1', name: 'Board' }],
      ['deleteProjectView', { project_id: 'PVT_1', view_id: 'VIEW_1' }],
      ['listProjectViews', { project_id: 'PVT_1' }],
      ['assessItemPriority', { project_id: 'PVT_1', item_id: 'PVTI_1', criteria: { business_value: 'high', technical_complexity: 'low', client_priority: 'urgent' } }],
      ['batchUpdatePriorities', { project_id: 'PVT_1', items: [{ item_id: 'PVTI_1', priority: 'high' }] }],
      ['manageItemDependencies', { project_id: 'PVT_1', item_id: 'PVTI_1', dependencies: { blocks: [] } }],
      ['analyzeDependencies', { project_id: 'PVT_1', criteria: { check_cycles: true } }],
      ['generateProjectMetrics', { project_id: 'PVT_1', metrics: ['completion_rate'] }],
      ['createDraftIssue', { project_id: 'PVT_1', title: 'Draft', body: 'Body' }],
      ['updateDraftIssue', { item_id: 'PVTI_DRAFT', body: 'Updated body' }],
      ['updateIssue', { issue_id: 'PVTI_ISSUE', state: 'CLOSED' }],
      ['createIssue', { repo_owner: 'test-owner', repo_name: 'test-repo', title: 'Issue', project_id: 'PVT_1' }],
      ['listOrganizationProjects', { organization: 'test-owner' }],
      ['createProject', { owner: 'test-owner', title: 'Roadmap' }],
      ['listUserProjects', {}]
    ];

    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, undefined, `${name} returned an MCP error: ${JSON.stringify(result.content)}`);
      assert.equal(result.content[0].type, 'text');
    }

    for (const uri of [
      'github-projects://project/PVT_1',
      'github-projects://project/PVT_1/items',
      'github-projects://project/PVT_1/items/PVTI_DRAFT',
      'github-projects://project/PVT_1/views',
      'github-projects://project/PVT_1/fields'
    ]) {
      const result = await client.readResource({ uri });
      assert.equal(result.contents[0].uri, uri);
      assert.equal(result.contents[0].mimeType, 'application/json');
      assert.doesNotThrow(() => JSON.parse(result.contents[0].text));
    }
  } finally {
    await transport.close();
  }
});
