import { z } from "zod";
import { githubRequest, buildUrl } from "../common/utils.js";

// Type Definitions
interface GitHubProjectV2 {
  node_id: string;
}

interface ProjectFieldsResponse {
  data: {
    node: {
      fields: {
        nodes: Array<{
          id: string;
          name: string;
          dataType: string;
          options?: Array<{
            id: string;
            name: string;
          }>;
        }>;
      };
    };
  };
}

interface ListProjectsResponse {
  data: {
    organization: {
      projectsV2: {
        nodes: Array<{
          id: string;
          title: string;
          shortDescription: string;
          public: boolean;
          closed: boolean;
          items: {
            totalCount: number;
          };
        }>;
      };
    };
  };
}

interface CreateProjectResponse {
  data: {
    createProjectV2: {
      projectV2: {
        id: string;
        number: number;
      };
    };
  };
}

interface ListUserProjectsResponse {
  data: {
    viewer: {
      projectsV2: {
        nodes: Array<{
          id: string;
          title: string;
          shortDescription: string;
          public: boolean;
          closed: boolean;
          items: {
            totalCount: number;
          };
        }>;
      };
    };
  };
}

// Schema Definitions
export const ProjectFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  dataType: z.enum(["TEXT", "NUMBER", "DATE", "SINGLE_SELECT"]),
  options: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).optional(),
});

export const GetProjectFieldsSchema = z.object({
  owner: z.string(),
  project_number: z.number(),
});

export const UpdateProjectFieldSchema = z.object({
  project_id: z.string(),
  item_id: z.string(),
  field_id: z.string(),
  value: z.union([
    z.string(),
    z.number(),
    z.object({
      singleSelectOptionId: z.string()
    })
  ]),
});

export const ListProjectsSchema = z.object({
  organization: z.string(),
  page: z.number().optional(),
  per_page: z.number().optional(),
});

export const CreateProjectSchema = z.object({
  owner: z.string(),
  title: z.string(),
  description: z.string().optional(),
  template: z.string().optional(),
});

export const ListUserProjectsSchema = z.object({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

// GraphQL Queries
const GET_PROJECT_FIELDS = `
  query GetProjectFields($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 100) {
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

const LIST_ORGANIZATION_PROJECTS = `
  query ListOrgProjects($org: String!, $first: Int!) {
    organization(login: $org) {
      projectsV2(first: $first) {
        nodes {
          id
          title
          shortDescription
          public
          closed
          items {
            totalCount
          }
        }
      }
    }
  }
`;

const UPDATE_PROJECT_FIELD = `
  mutation UpdateProjectField($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item {
        id
      }
    }
  }
`;

const CREATE_PROJECT = `
  mutation CreateProject($input: CreateProjectV2Input!) {
    createProjectV2(input: $input) {
      projectV2 {
        id
        number
      }
    }
  }
`;

const LIST_USER_PROJECTS = `
  query ListUserProjects($first: Int!) {
    viewer {
      projectsV2(first: $first) {
        nodes {
          id
          title
          shortDescription
          public
          closed
          items {
            totalCount
          }
        }
      }
    }
  }
`;

// Function Implementations
export async function getProjectFields(owner: string, project_number: number) {
  // First, get the project ID using REST API
  const projectResponse = await githubRequest(
    `https://api.github.com/orgs/${owner}/projects/v2/${project_number}`,
    { headers: { "Accept": "application/vnd.github.project-beta+json" } }
  );

  const project = projectResponse as GitHubProjectV2;

  // Then use GraphQL to get field details
  const fieldsResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: GET_PROJECT_FIELDS,
      variables: {
        projectId: project.node_id
      }
    }
  });

  const response = fieldsResponse as ProjectFieldsResponse;
  return response.data.node.fields.nodes;
}

export async function updateProjectField(
  project_id: string,
  item_id: string,
  field_id: string,
  value: z.infer<typeof UpdateProjectFieldSchema>["value"]
) {
  return githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: UPDATE_PROJECT_FIELD,
      variables: {
        input: {
          projectId: project_id,
          itemId: item_id,
          fieldId: field_id,
          value
        }
      }
    }
  });
}

export async function listOrganizationProjects(
  organization: string,
  options: Omit<z.infer<typeof ListProjectsSchema>, "organization">
) {
  const perPage = options.per_page || 20;
  
  const projectsResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: LIST_ORGANIZATION_PROJECTS,
      variables: {
        org: organization,
        first: perPage
      }
    }
  });

  const response = projectsResponse as ListProjectsResponse;
  return response.data.organization.projectsV2.nodes;
}

export async function createProject(
  owner: string,
  options: Omit<z.infer<typeof CreateProjectSchema>, "owner">
) {
  const projectResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: CREATE_PROJECT,
      variables: {
        input: {
          ownerId: owner,
          title: options.title,
          description: options.description,
          template: options.template
        }
      }
    }
  });

  const response = projectResponse as CreateProjectResponse;
  return response.data.createProjectV2.projectV2;
}

export async function listUserProjects(
  options: z.infer<typeof ListUserProjectsSchema> = {}
) {
  const perPage = options.per_page || 20;
  
  const projectsResponse = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: {
      query: LIST_USER_PROJECTS,
      variables: {
        first: perPage
      }
    }
  });

  const response = projectsResponse as ListUserProjectsResponse;
  return response.data.viewer.projectsV2.nodes;
}