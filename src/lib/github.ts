import { Octokit } from "@octokit/rest";

const owner = import.meta.env.GITHUB_REPO_OWNER;
const repo = import.meta.env.GITHUB_REPO_NAME;

const octokit = new Octokit({ auth: import.meta.env.GITHUB_TOKEN });

export interface SubmitEditParams {
  problemId: number;
  path: string;
  newFileContent: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export interface SubmitEditResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
}

export async function submitProblemEditPR(params: SubmitEditParams): Promise<SubmitEditResult> {
  const { data: currentFile } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: params.path,
    ref: "main",
  });
  if (Array.isArray(currentFile) || currentFile.type !== "file") {
    throw new Error(`Expected a file at ${params.path}`);
  }

  const { data: mainRef } = await octokit.rest.git.getRef({ owner, repo, ref: "heads/main" });

  const branchName = `suggest-edit/problem-${params.problemId}/${crypto.randomUUID().slice(0, 8)}`;
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: mainRef.object.sha,
  });

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: params.path,
    message: params.commitMessage,
    content: Buffer.from(params.newFileContent, "utf-8").toString("base64"),
    sha: currentFile.sha,
    branch: branchName,
  });

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: params.prTitle,
    head: branchName,
    base: "main",
    body: params.prBody,
  });

  return { prUrl: pr.html_url, prNumber: pr.number, branchName };
}
