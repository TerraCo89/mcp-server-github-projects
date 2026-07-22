function response(body) {
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

global.fetch = async (url, options = {}) => {
  const request = options.body ? JSON.parse(options.body) : {};
  const query = request.query || '';

  if (url !== 'https://api.github.com/graphql') {
    return response({ node_id: 'OWNER_1' });
  }

  if (query.includes('ResolveContentId')) {
    const isIssue = request.variables.itemId === 'PVTI_ISSUE';
    return response({
      data: {
        node: {
          __typename: 'ProjectV2Item',
          id: request.variables.itemId,
          content: {
            __typename: isIssue ? 'Issue' : 'DraftIssue',
            id: isIssue ? 'I_1' : 'DI_1'
          }
        }
      }
    });
  }

  if (query.includes('AddProjectV2DraftIssue')) {
    return response({ data: { addProjectV2DraftIssue: { projectItem: { id: 'PVTI_DRAFT' } } } });
  }
  if (query.includes('UpdateProjectV2DraftIssue')) {
    return response({ data: { updateProjectV2DraftIssue: { draftIssue: { id: 'DI_1', title: 'Draft', body: 'Body' } } } });
  }
  if (query.includes('GetRepoId')) {
    return response({ data: { repository: { id: 'R_1' } } });
  }
  if (query.includes('CreateIssue')) {
    return response({ data: { createIssue: { issue: { id: 'I_2', number: 2, title: 'Issue', body: 'Body', state: 'OPEN', url: 'https://example.test/issues/2' } } } });
  }
  if (query.includes('UpdateIssue')) {
    return response({ data: { updateIssue: { issue: { id: 'I_1', number: 1, title: 'Issue', body: 'Body', state: 'CLOSED' } } } });
  }
  if (query.includes('AddProjectItem')) {
    return response({ data: { addProjectV2Item: { item: { id: 'PVTI_ADDED' } } } });
  }
  if (query.includes('DeleteProjectItem')) {
    return response({ data: { deleteProjectV2Item: { deletedItemId: 'PVTI_DELETED' } } });
  }
  if (query.includes('ListProjectItems')) {
    return response({ data: { node: { items: { nodes: [{ id: 'PVTI_DRAFT', content: { __typename: 'DraftIssue', title: 'Draft', body: 'Body' } }] } } } });
  }
  if (query.includes('UpdateProjectField') || query.includes('UpdateProjectItemPriority')) {
    return response({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'PVTI_1' } } } });
  }
  if (query.includes('GetProjectFields') || query.includes('ListFields')) {
    return response({ data: { node: { fields: { nodes: [{ id: 'FIELD_1', name: 'Status', dataType: 'SINGLE_SELECT', options: [] }] } } } });
  }
  if (query.includes('CreateProjectView')) {
    return response({ data: { createProjectV2View: { projectView: { id: 'VIEW_1', name: 'Board', layout: 'BOARD_LAYOUT' } } } });
  }
  if (query.includes('UpdateProjectView')) {
    return response({ data: { updateProjectV2View: { projectView: { id: 'VIEW_1', name: 'Board', layout: 'BOARD_LAYOUT' } } } });
  }
  if (query.includes('DeleteProjectView')) {
    return response({ data: { deleteProjectV2View: { deletedViewId: 'VIEW_1' } } });
  }
  if (query.includes('ListProjectViews') || query.includes('ListViews')) {
    return response({ data: { node: { views: { nodes: [{ id: 'VIEW_1', name: 'Board', layout: 'BOARD_LAYOUT', fields: { nodes: [] } }] } } } });
  }
  if (query.includes('UpdateProjectItemDependencies')) {
    return response({ data: { updateProjectV2ItemDependencies: { projectV2Item: { id: 'PVTI_1' } } } });
  }
  if (query.includes('GetProjectDependencies') || query.includes('GetProjectMetrics')) {
    return response({ data: { node: { items: { nodes: [] } } } });
  }
  if (query.includes('ListOwnerProjects') || query.includes('ListOrgProjects')) {
    return response({ data: { organization: { projectsV2: { nodes: [{ id: 'PVT_1', title: 'Roadmap', shortDescription: 'Plan', closed: false, public: false, items: { totalCount: 1 } }] } }, user: null } });
  }
  if (query.includes('CreateProject')) {
    return response({ data: { createProjectV2: { projectV2: { id: 'PVT_NEW', number: 2 } } } });
  }
  if (query.includes('ListUserProjects')) {
    return response({ data: { viewer: { projectsV2: { nodes: [] } } } });
  }
  if (query.includes('GetProject')) {
    return response({ data: { node: { id: 'PVT_1', title: 'Roadmap', shortDescription: 'Plan', closed: false, public: false, url: 'https://example.test/project', items: { totalCount: 1 } } } });
  }
  if (query.includes('ListItems')) {
    return response({ data: { node: { items: { nodes: [{ id: 'PVTI_DRAFT', content: { __typename: 'DraftIssue', title: 'Draft', body: 'Body' } }] } } } });
  }
  if (query.includes('GetItem')) {
    return response({ data: { node: { id: 'PVTI_DRAFT', type: 'DRAFT_ISSUE', content: { __typename: 'DraftIssue', title: 'Draft', body: 'Body' } } } });
  }

  throw new Error(`Unhandled GitHub request: ${query}`);
};
