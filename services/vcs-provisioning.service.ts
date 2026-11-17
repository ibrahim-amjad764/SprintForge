// services/vcs-provisioning.service.ts
import Workspace from '@/models/Workspace';
import logger from '@/lib/logger';

export interface RepositoryConfig {
  name: string;
  description: string;
  private: boolean;
  autoInit: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  html_url: string;
  clone_url: string;
  private: boolean;
}

export interface GitLabRepository {
  id: number;
  name: string;
  http_url_to_repo: string;
  ssh_url_to_repo: string;
  visibility: string;
}

// Create GitHub repository
export async function createGitHubRepository(params: {
  config: RepositoryConfig;
  githubToken: string;
  organization?: string;
}): Promise<GitHubRepository> {
  const { config, githubToken, organization } = params;

  const url = organization
    ? `https://api.github.com/orgs/${organization}/repos`
    : 'https://api.github.com/user/repos';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: config.name,
      description: config.description,
      private: config.private,
      auto_init: config.autoInit,
      gitignore_template: config.gitignoreTemplate,
      license_template: config.licenseTemplate,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitHub API error: ${error.message || response.status}`);
  }

  return await response.json();
}

// Create GitLab repository
export async function createGitLabRepository(params: {
  config: RepositoryConfig;
  gitlabToken: string;
  namespaceId?: number;
}): Promise<GitLabRepository> {
  const { config, gitlabToken, namespaceId } = params;

  const url = namespaceId
    ? `https://gitlab.com/api/v4/projects?namespace_id=${namespaceId}`
    : 'https://gitlab.com/api/v4/projects';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': gitlabToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: config.name,
      description: config.description,
      visibility: config.private ? 'private' : 'public',
      initialize_with_readme: config.autoInit,
      gitignore_template: config.gitignoreTemplate,
      license_template: config.licenseTemplate,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitLab API error: ${error.message || response.status}`);
  }

  return await response.json();
}

// Configure branch protection for GitHub
export async function configureGitHubBranchProtection(params: {
  owner: string;
  repo: string;
  branch: string;
  githubToken: string;
}): Promise<void> {
  const { owner, repo, branch, githubToken } = params;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        required_status_checks: {
          strict: true,
          contexts: [],
        },
        enforce_admins: true,
        required_pull_request_reviews: {
          dismissal_restrictions: {},
          dismiss_stale_reviews: true,
          require_code_owner_reviews: true,
        },
        restrictions: null,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to configure branch protection: ${response.status}`);
  }
}

// Seed repository with basic project files
export async function seedRepository(params: {
  platform: 'github' | 'gitlab';
  owner: string;
  repo: string;
  branch: string;
  token: string;
  files: Array<{ path: string; content: string }>;
}): Promise<void> {
  const { platform, owner, repo, branch, token, files } = params;

  for (const file of files) {
    if (platform === 'github') {
      await createGitHubFile({
        owner,
        repo,
        path: file.path,
        content: file.content,
        branch,
        token,
      });
    } else {
      await createGitLabFile({
        projectId: repo,
        filePath: file.path,
        content: file.content,
        branch,
        token,
      });
    }
  }
}

// Create file in GitHub
async function createGitHubFile(params: {
  owner: string;
  repo: string;
  path: string;
  content: string;
  branch: string;
  token: string;
}): Promise<void> {
  const { owner, repo, path, content, branch, token } = params;

  const base64Content = Buffer.from(content).toString('base64');

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Initial commit: ${path}`,
        content: base64Content,
        branch,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create file ${path}: ${response.status}`);
  }
}

// Create file in GitLab
async function createGitLabFile(params: {
  projectId: string;
  filePath: string;
  content: string;
  branch: string;
  token: string;
}): Promise<void> {
  const { projectId, filePath, content, branch, token } = params;

  const base64Content = Buffer.from(content).toString('base64');

  const response = await fetch(
    `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
    {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_path: filePath,
        content: base64Content,
        encoding: 'base64',
        branch,
        commit_message: `Initial commit: ${filePath}`,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create file ${filePath}: ${response.status}`);
  }
}

// Auto-provision repository for workspace
export async function autoProvisionRepository(workspaceId: string): Promise<string | null> {
  const workspace = await Workspace.findById(workspaceId);
  
  if (!workspace?.settings?.autoCreateRepository) {
    return null;
  }

  const repoName = workspace.slug.toLowerCase().replace(/-/g, '-');
  const description = workspace.description || `Repository for ${workspace.name}`;

  try {
    let repositoryUrl: string;

    if (workspace.integrations?.github?.enabled) {
      // In a real implementation, you'd retrieve the GitHub token from secure storage
      const repo = await createGitHubRepository({
        config: {
          name: repoName,
          description,
          private: true,
          autoInit: true,
          gitignoreTemplate: 'Node',
        },
        githubToken: process.env.GITHUB_TOKEN || '',
      });

      repositoryUrl = repo.html_url;

      // Configure branch protection
      await configureGitHubBranchProtection({
        owner: repo.name.split('/')[0],
        repo: repoName,
        branch: 'main',
        githubToken: process.env.GITHUB_TOKEN || '',
      });

      // Seed with basic files
      await seedRepository({
        platform: 'github',
        owner: repo.name.split('/')[0],
        repo: repoName,
        branch: 'main',
        token: process.env.GITHUB_TOKEN || '',
        files: [
          {
            path: 'README.md',
            content: `# ${workspace.name}\n\n${description}\n\nThis repository is linked to the SprintForge workspace.`,
          },
          {
            path: '.gitignore',
            content: 'node_modules/\ndist/\n.env\n*.log',
          },
        ],
      });
    } else if (workspace.integrations?.gitlab?.enabled) {
      // In a real implementation, you'd retrieve the GitLab token from secure storage
      const repo = await createGitLabRepository({
        config: {
          name: repoName,
          description,
          private: true,
          autoInit: true,
          gitignoreTemplate: 'Node',
        },
        gitlabToken: process.env.GITLAB_TOKEN || '',
      });

      repositoryUrl = repo.http_url_to_repo;
    } else {
      return null;
    }

    // Update workspace with repository URL
    await Workspace.findByIdAndUpdate(workspaceId, {
      'integrations.github.repositoryUrl': repositoryUrl,
    });

    return repositoryUrl;
  } catch (error) {
    logger.error({ err: error }, 'Repository provisioning error:');
    return null;
  }
}

// Get template-specific files for seeding
export function getTemplateFiles(template: string): Array<{ path: string; content: string }> {
  const commonFiles = [
    {
      path: '.gitignore',
      content: 'node_modules/\ndist/\n.env\n*.log\n.DS_Store',
    },
  ];

  const templateFiles: Record<string, Array<{ path: string; content: string }>> = {
    kanban: [
      ...commonFiles,
      {
        path: 'README.md',
        content: '# Kanban Project\n\nThis project uses Kanban methodology for task management.',
      },
      {
        path: 'docs/workflow.md',
        content: '# Workflow\n\n- Backlog\n- To Do\n- In Progress\n- Review\n- Done',
      },
    ],
    scrum: [
      ...commonFiles,
      {
        path: 'README.md',
        content: '# Scrum Project\n\nThis project uses Scrum methodology with sprint planning.',
      },
      {
        path: 'docs/sprint-planning.md',
        content: '# Sprint Planning\n\nSprint duration: 2 weeks\nCeremonies: Daily Standup, Sprint Review, Sprint Retrospective',
      },
    ],
    'bug-tracker': [
      ...commonFiles,
      {
        path: 'README.md',
        content: '# Bug Tracker\n\nThis project is focused on bug tracking and resolution.',
      },
      {
        path: 'docs/bug-reporting.md',
        content: '# Bug Reporting\n\nPlease include:\n- Steps to reproduce\n- Expected behavior\n- Actual behavior\n- Environment details',
      },
    ],
    blank: [
      ...commonFiles,
      {
        path: 'README.md',
        content: '# Project\n\nAdd your project description here.',
      },
    ],
  };

  return templateFiles[template] || templateFiles.blank;
}
