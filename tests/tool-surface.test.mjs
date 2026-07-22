import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { Client } from '../node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

test('GitHub Projects MCP exposes item CRUD and field-edit tools', async () => {
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

    for (const expected of [
      'listProjectItems',
      'addProjectItem',
      'deleteProjectItem',
      'getProjectFields',
      'updateProjectField'
    ]) {
      assert.ok(names.includes(expected), `missing MCP tool: ${expected}`);
    }
  } finally {
    await transport.close();
  }
});
