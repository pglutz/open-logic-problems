import { Octokit } from "@octokit/rest";

const owner = import.meta.env.GITHUB_REPO_OWNER;
const repo = import.meta.env.GITHUB_REPO_NAME;

const octokit = new Octokit({ auth: import.meta.env.GITHUB_TOKEN });

export interface PRResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
}

interface CreateBranchAndPRParams {
  path: string;
  newFileContent: string;
  commitMessage: string;
  branchName: string;
  prTitle: string;
  prBody: string;
  // Omit to create a brand-new file; pass an existing blob's sha to update it.
  existingFileSha?: string;
}

async function createBranchAndPR(params: CreateBranchAndPRParams): Promise<PRResult> {
  const { data: mainRef } = await octokit.rest.git.getRef({ owner, repo, ref: "heads/main" });

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${params.branchName}`,
    sha: mainRef.object.sha,
  });

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: params.path,
    message: params.commitMessage,
    content: Buffer.from(params.newFileContent, "utf-8").toString("base64"),
    ...(params.existingFileSha ? { sha: params.existingFileSha } : {}),
    branch: params.branchName,
  });

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: params.prTitle,
    head: params.branchName,
    base: "main",
    body: params.prBody,
  });

  return { prUrl: pr.html_url, prNumber: pr.number, branchName: params.branchName };
}

export interface SubmitEditParams {
  problemId: number;
  path: string;
  newFileContent: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export async function submitProblemEditPR(params: SubmitEditParams): Promise<PRResult> {
  const { data: currentFile } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: params.path,
    ref: "main",
  });
  if (Array.isArray(currentFile) || currentFile.type !== "file") {
    throw new Error(`Expected a file at ${params.path}`);
  }

  const branchName = `suggest-edit/problem-${params.problemId}/${crypto.randomUUID().slice(0, 8)}`;
  return createBranchAndPR({ ...params, branchName, existingFileSha: currentFile.sha });
}

export interface SubmitNewProblemParams {
  slug: string;
  path: string;
  newFileContent: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export async function submitNewProblemPR(params: SubmitNewProblemParams): Promise<PRResult> {
  const branchName = `propose-problem/${params.slug}`;
  return createBranchAndPR({ ...params, branchName });
}
