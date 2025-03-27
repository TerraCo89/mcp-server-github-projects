import { z } from "zod";
import { githubRequest } from "../common/utils.js";

// Schema Definitions
export const AddProjectItemSchema = z.object({
  project_id: z.string(),
  content_id: z.string(),
  content_type: z.enum(["ISSUE", "PULL_REQUEST"]),
});

export const DeleteProjectItemSchema = z.object({
  project_id: z.string(),
  item_id: z.string(),
});

export const ListProjectItemsSchema = z.object({
  project_id: z.string(),
  page: z.number().optional(),
  per_page: z.number().optional(),
});

// Type Definitions
interface ProjectItemResponse {
  data: {
    addProjectV2Item: {
      item: {
        id: string;
      };
    };
  };
}

interface ProjectItemsListResponse {
  data: {
    node: {
      items: {
        nodes: Array<{
          id: string;
          content: {
            __typename: string;
            title: string;
            number: number;
            state: string;
          };
          fieldValues: {
            nodes: Array<{
              field: {
                name: string;
              };
              value: string | number | null;
            }>;
          };
        }>;
      };
    };
  };
}

// GraphQL Queries
const ADD_PROJECT_ITEM = `
  mutation AddProjectItem($input: AddProjectV2ItemByIdInput!) {
    addProjectV2ItemById(input: $input) {
      item {
        id
      }
    }
  }
`;

const DELETE_PROJECT_ITEM = `
  mutation DeleteProjectItem($input: DeleteProjectV2ItemInput!) {
    deleteProjectV2Item(input: $input) {
      deletedItemId
    }
  }
`;

const LIST_PROJECT_ITEMS = `
  query ListProjectItems($projectId: ID!, $first: Int!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: $first) {
          nodes {
            id
            content {
              __typename
              ... on Issue {
                title
                number
                state
              }
              ... on PullRequest {
                title
                number
                state
              }
            }
            fieldValues(first: 100) {
              nodes {
                field {
                  name
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Function Implementations
export async function addProjectItem(
  project_id: string,
  content_id: string,
  content_type: z.infer<typeof AddProjectItemSchema>["content_type"]
) {
  const itemResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: ADD_PROJECT_ITEM,
      variables: {
        input: {
          projectId: project_id,
          contentId: content_id
        }
      }
    }
  });

  const response = itemResponse as ProjectItemResponse;
  return response.data.addProjectV2Item.item;
}

export async function deleteProjectItem(project_id: string, item_id: string) {
  return githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: DELETE_PROJECT_ITEM,
      variables: {
        input: {
          projectId: project_id,
          itemId: item_id
        }
      }
    }
  });
}

export async function listProjectItems(
  project_id: string,
  options: Omit<z.infer<typeof ListProjectItemsSchema>, "project_id">
) {
  const perPage = options.per_page || 20;
  
  const itemsResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: LIST_PROJECT_ITEMS,
      variables: {
        projectId: project_id,
        first: perPage
      }
    }
  });

  const response = itemsResponse as ProjectItemsListResponse;
  return response.data.node.items.nodes;
}