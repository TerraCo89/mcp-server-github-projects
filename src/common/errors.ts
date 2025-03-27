/**
 * Create a standardized GitHub error
 */
export function createGitHubError(
  status: number,
  error: { message: string; details?: Record<string, any> }
) {
  return {
    status,
    error: {
      code: 'GITHUB_ERROR',
      message: error.message,
      details: error.details,
    },
  };
}