import { ResourceTemplate, ReadResourceTemplateCallback, ListResourcesCallback, ResourceMetadata } from "@modelcontextprotocol/sdk/server/mcp.js";
import { githubRequest, resolveGithubProjectId, getGithubProjectsDefaults } from "../common/utils.js";
import { resolveGithubProjectOwner } from "../common/utils.js";

const PROJECT_DETAILS = `
  query GetProject($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        id
        title
        shortDescription
        closed
        public
        url
        items { totalCount }
      }
    }
  }
`;

const LIST_PROJECT_ITEMS = `
  query ListItems($projectId: ID!, $first: Int!) {
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
                url
                body
              }
              ... on PullRequest {
                title
                number
                state
                url
              }
              ... on DraftIssue {
                title
                body
              }
            }
          }
        }
      }
    }
  }
`;

const LIST_PROJECT_VIEWS = `
  query ListViews($projectId: ID!, $first: Int!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        views(first: $first) {
          nodes {
            id
            name
            layout
          }
        }
      }
    }
  }
`;

const LIST_PROJECT_FIELDS = `
  query ListFields($projectId: ID!, $first: Int!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: $first) {
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
  query ListOrgProjects($owner: String!, $first: Int!) {
    organization(login: $owner) {
      projectsV2(first: $first) {
        nodes {
          id
          title
          shortDescription
          closed
          public
          items { totalCount }
        }
      }
    }
    user(login: $owner) {
      projectsV2(first: $first) {
        nodes {
          id
          title
          shortDescription
          closed
          public
          items { totalCount }
        }
      }
    }
  }
`;

const GET_ITEM_DETAILS = `
  query GetItem($itemId: ID!) {
    node(id: $itemId) {
      ... on ProjectV2Item {
        id
        type
        content {
          __typename
          ... on Issue {
            title
            number
            state
            url
            body
          }
          ... on PullRequest {
            title
            number
            state
            url
          }
          ... on DraftIssue {
            title
            body
          }
        }
      }
    }
  }
`;

async function fetchProjectDetails(projectId: string) {
  const data = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: { query: PROJECT_DETAILS, variables: { projectId } }
  });
  return JSON.stringify((data as any).data?.node ?? {});
}

async function fetchProjectItems(projectId: string, first = 100) {
  const data = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: { query: LIST_PROJECT_ITEMS, variables: { projectId, first } }
  });
  const items = (data as any).data?.node?.items?.nodes ?? [];
  return JSON.stringify(items, null, 2);
}

async function fetchItemDetails(itemId: string) {
  const data = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: { query: GET_ITEM_DETAILS, variables: { itemId } }
  });
  return JSON.stringify((data as any).data?.node ?? {});
}

async function fetchProjectViews(projectId: string, first = 100) {
  const data = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: { query: LIST_PROJECT_VIEWS, variables: { projectId, first } }
  });
  const views = (data as any).data?.node?.views?.nodes ?? [];
  return JSON.stringify(views, null, 2);
}

async function fetchProjectFields(projectId: string, first = 100) {
  const data = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: { query: LIST_PROJECT_FIELDS, variables: { projectId, first } }
  });
  const fields = (data as any).data?.node?.fields?.nodes ?? [];
  return JSON.stringify(fields, null, 2);
}

async function fetchProjectsList(owner: string, first = 50) {
  const data = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    body: { query: LIST_ORGANIZATION_PROJECTS, variables: { owner, first } }
  });
  const projects = (data as any).data?.organization?.projectsV2?.nodes ??
    (data as any).data?.user?.projectsV2?.nodes ?? [];
  return projects;
}

export type ResourceRegistration = {
  name: string;
  uriOrTemplate: string | ResourceTemplate;
  metadata?: ResourceMetadata;
  readCallback: ReadResourceTemplateCallback;
};

export function createResourceRegistrations(): ResourceRegistration[] {
  const defaults = getGithubProjectsDefaults();
  const defaultOwner = defaults.owner;

  const projectListCallback: ListResourcesCallback | undefined = defaultOwner
    ? async () => {
        const projects = await fetchProjectsList(defaultOwner);
        return {
          resources: projects.map((p: any) => ({
            uri: `github-projects://project/${p.id}`,
            name: p.title,
            description: p.shortDescription || undefined,
          }))
        };
      }
    : undefined;

  const itemsListTemplate = new ResourceTemplate(
    "github-projects://project/{projectId}/items",
    {
      list: defaultOwner
        ? async () => {
            const projects = await fetchProjectsList(defaultOwner);
            const resources: Array<{ uri: string; name: string }> = [];
            for (const project of projects.slice(0, 5)) {
              try {
                const itemsData = await githubRequest("https://api.github.com/graphql", {
                  method: "POST",
                  body: { query: LIST_PROJECT_ITEMS, variables: { projectId: project.id, first: 20 } }
                });
                const items = (itemsData as any).data?.node?.items?.nodes ?? [];
                for (const item of items) {
                  const title = item.content?.title || item.id;
                  resources.push({
                    uri: `github-projects://project/${project.id}/items/${item.id}`,
                    name: title,
                  });
                }
              } catch { }
            }
            return { resources };
          }
        : undefined,
    }
  );

  return [
    {
      name: "project-details",
      uriOrTemplate: new ResourceTemplate(
        "github-projects://project/{projectId}",
        { list: projectListCallback }
      ),
      metadata: { description: "GitHub Project details including title, description, and item count", mimeType: "application/json" },
      readCallback: async (uri, variables) => {
        const content = await fetchProjectDetails(variables.projectId as string);
        return { contents: [{ uri: uri.href, text: content, mimeType: "application/json" }] };
      },
    },
    {
      name: "project-items",
      uriOrTemplate: itemsListTemplate,
      metadata: { description: "List of items in a GitHub Project", mimeType: "application/json" },
      readCallback: async (uri, variables) => {
        const content = await fetchProjectItems(variables.projectId as string);
        return { contents: [{ uri: uri.href, text: content, mimeType: "application/json" }] };
      },
    },
    {
      name: "project-item",
      uriOrTemplate: new ResourceTemplate(
        "github-projects://project/{projectId}/items/{itemId}",
        { list: undefined }
      ),
      metadata: { description: "A single item in a GitHub Project", mimeType: "application/json" },
      readCallback: async (uri, variables) => {
        const content = await fetchItemDetails(variables.itemId as string);
        return { contents: [{ uri: uri.href, text: content, mimeType: "application/json" }] };
      },
    },
    {
      name: "project-views",
      uriOrTemplate: new ResourceTemplate(
        "github-projects://project/{projectId}/views",
        { list: undefined }
      ),
      metadata: { description: "Views of a GitHub Project", mimeType: "application/json" },
      readCallback: async (uri, variables) => {
        const content = await fetchProjectViews(variables.projectId as string);
        return { contents: [{ uri: uri.href, text: content, mimeType: "application/json" }] };
      },
    },
    {
      name: "project-fields",
      uriOrTemplate: new ResourceTemplate(
        "github-projects://project/{projectId}/fields",
        { list: undefined }
      ),
      metadata: { description: "Fields of a GitHub Project", mimeType: "application/json" },
      readCallback: async (uri, variables) => {
        const content = await fetchProjectFields(variables.projectId as string);
        return { contents: [{ uri: uri.href, text: content, mimeType: "application/json" }] };
      },
    },
  ];
}
