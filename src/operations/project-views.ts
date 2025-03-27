import { z } from "zod";
import { githubRequest } from "../common/utils.js";

// Schema Definitions
export const CreateProjectViewSchema = z.object({
  project_id: z.string(),
  name: z.string(),
  layout: z.enum(["BOARD_LAYOUT", "TABLE_LAYOUT"]),
});

export const UpdateProjectViewSchema = z.object({
  project_id: z.string(),
  view_id: z.string(),
  name: z.string().optional(),
  layout: z.enum(["BOARD_LAYOUT", "TABLE_LAYOUT"]).optional(),
});

export const DeleteProjectViewSchema = z.object({
  project_id: z.string(),
  view_id: z.string(),
});

export const ListProjectViewsSchema = z.object({
  project_id: z.string(),
  page: z.number().optional(),
  per_page: z.number().optional(),
});

// Type Definitions
interface ProjectViewResponse {
  data: {
    createProjectV2View: {
      projectView: {
        id: string;
        name: string;
        layout: string;
      };
    };
  };
}

interface ProjectViewsListResponse {
  data: {
    node: {
      views: {
        nodes: Array<{
          id: string;
          name: string;
          layout: string;
          fields: {
            nodes: Array<{
              id: string;
              name: string;
            }>;
          };
        }>;
      };
    };
  };
}

// GraphQL Queries
const CREATE_PROJECT_VIEW = `
  mutation CreateProjectView($input: CreateProjectV2ViewInput!) {
    createProjectV2View(input: $input) {
      projectView {
        id
        name
        layout
      }
    }
  }
`;

const UPDATE_PROJECT_VIEW = `
  mutation UpdateProjectView($input: UpdateProjectV2ViewInput!) {
    updateProjectV2View(input: $input) {
      projectView {
        id
        name
        layout
      }
    }
  }
`;

const DELETE_PROJECT_VIEW = `
  mutation DeleteProjectView($input: DeleteProjectV2ViewInput!) {
    deleteProjectV2View(input: $input) {
      deletedViewId
    }
  }
`;

const LIST_PROJECT_VIEWS = `
  query ListProjectViews($projectId: ID!, $first: Int!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        views(first: $first) {
          nodes {
            id
            name
            layout
            fields(first: 100) {
              nodes {
                ... on ProjectV2Field {
                  id
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
export async function createProjectView(
  project_id: string,
  name: string,
  layout: z.infer<typeof CreateProjectViewSchema>["layout"]
) {
  const viewResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: CREATE_PROJECT_VIEW,
      variables: {
        input: {
          projectId: project_id,
          name,
          layout
        }
      }
    }
  });

  const response = viewResponse as ProjectViewResponse;
  return response.data.createProjectV2View.projectView;
}

export async function updateProjectView(
  project_id: string,
  view_id: string,
  options: Omit<z.infer<typeof UpdateProjectViewSchema>, "project_id" | "view_id">
) {
  return githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: UPDATE_PROJECT_VIEW,
      variables: {
        input: {
          projectId: project_id,
          viewId: view_id,
          ...options
        }
      }
    }
  });
}

export async function deleteProjectView(project_id: string, view_id: string) {
  return githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: DELETE_PROJECT_VIEW,
      variables: {
        input: {
          projectId: project_id,
          viewId: view_id
        }
      }
    }
  });
}

export async function listProjectViews(
  project_id: string,
  options: Omit<z.infer<typeof ListProjectViewsSchema>, "project_id">
) {
  const perPage = options.per_page || 20;
  
  const viewsResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: LIST_PROJECT_VIEWS,
      variables: {
        projectId: project_id,
        first: perPage
      }
    }
  });

  const response = viewsResponse as ProjectViewsListResponse;
  return response.data.node.views.nodes;
}