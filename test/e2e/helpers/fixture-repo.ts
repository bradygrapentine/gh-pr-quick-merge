/**
 * Spins up + tears down a temporary GitHub repo + N stub PRs under
 * the bot account `gh-pr-qm-bot`. Requires `E2E_GH_TOKEN` as the bot's PAT.
 *
 * Usage:
 *   const fixture = await createFixtureRepo({ prCount: 3 });
 *   ...
 *   await teardownFixtureRepo(fixture);
 */

const GH_API = 'https://api.github.com';

export interface FixtureRepo {
  owner: string;
  repo: string;
  prs: Array<{ number: number; url: string }>;
}

interface CreateOpts {
  prCount: number;
  ownerOverride?: string;
  prefix?: string;
}

function authHeaders(): Record<string, string> {
  const token = process.env.E2E_GH_TOKEN;
  if (!token) {
    throw new Error(
      'createFixtureRepo: E2E_GH_TOKEN env var not set. Set it to a PAT for the gh-pr-qm-bot account.',
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function gh<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${method} ${path} → ${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function getViewerLogin(): Promise<string> {
  const me = await gh<{ login: string }>('GET', '/user');
  return me.login;
}

export async function createFixtureRepo(opts: CreateOpts): Promise<FixtureRepo> {
  const start = Date.now();
  const owner = opts.ownerOverride ?? (await getViewerLogin());
  const prefix = opts.prefix ?? 'qm-e2e';
  const repoName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await gh('POST', '/user/repos', {
    name: repoName,
    private: true,
    auto_init: true,
    description: 'Ephemeral PR Quick Merge E2E fixture — safe to delete.',
  });

  const baseRef = await gh<{ object: { sha: string } }>(
    'GET',
    `/repos/${owner}/${repoName}/git/ref/heads/main`,
  );
  const baseSha = baseRef.object.sha;

  const prs: FixtureRepo['prs'] = [];
  for (let i = 1; i <= opts.prCount; i++) {
    const branchName = `fixture/pr-${i}`;

    await gh('POST', `/repos/${owner}/${repoName}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    const fileContent = Buffer.from(`# Fixture PR ${i}\n\nGenerated ${new Date().toISOString()}\n`).toString('base64');
    await gh('PUT', `/repos/${owner}/${repoName}/contents/fixture-${i}.md`, {
      message: `fixture: add file for PR ${i}`,
      content: fileContent,
      branch: branchName,
    });

    const pr = await gh<{ number: number; html_url: string }>(
      'POST',
      `/repos/${owner}/${repoName}/pulls`,
      {
        title: `fixture/pr-${i}`,
        body: '<!-- e2e fixture -->',
        head: branchName,
        base: 'main',
      },
    );
    prs.push({ number: pr.number, url: pr.html_url });
  }

  const elapsed = Date.now() - start;
  if (elapsed > 30_000) {
    console.warn(`createFixtureRepo: took ${elapsed}ms (budget: 30s)`);
  }

  return { owner, repo: repoName, prs };
}

export async function teardownFixtureRepo(fixture: FixtureRepo): Promise<void> {
  await gh('DELETE', `/repos/${fixture.owner}/${fixture.repo}`).catch((err) => {
    console.warn(`teardownFixtureRepo: ${fixture.owner}/${fixture.repo} delete failed: ${err.message}`);
  });
}

export async function pollPrClosed(fixture: FixtureRepo, prNumber: number, timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pr = await gh<{ state: string }>('GET', `/repos/${fixture.owner}/${fixture.repo}/pulls/${prNumber}`);
    if (pr.state === 'closed') return true;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}
