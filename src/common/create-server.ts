import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { githubRequest } from "./utils.js";

type OperationConfig = {
  description: string;
  input: z.ZodTypeAny;
  handler: (args: { input: any; context: { client: { request: (query: string, variables?: Record<string, any>) => Promise<any> } } }) => Promise<any> | any;
};

type ServerConfig = {
  name: string;
  version: string;
  description: string;
  operations: Record<string, OperationConfig>;
};

export function createServer(config: ServerConfig) {
  const server = new McpServer({ name: config.name, version: config.version }, { instructions: config.description });
  const client = {
    request: (query: string, variables?: Record<string, any>) => githubRequest("https://api.github.com/graphql", {
      method: "POST",
      body: { query, variables }
    })
  };

  for (const [name, operation] of Object.entries(config.operations)) {
    server.registerTool(
      name,
      {
        description: operation.description,
        inputSchema: operation.input as any
      },
      async (input: any) => {
        const result = await operation.handler({ input, context: { client } });
        if (result && typeof result === "object" && ("content" in result || "structuredContent" in result)) {
          return result;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }
    );
  }

  return Object.freeze({
    listen: async () => {
      await server.connect(new StdioServerTransport());
    },
    server
  });
}
