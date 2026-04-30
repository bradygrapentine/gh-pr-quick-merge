# GitHub API Usage

## Endpoints

- GET /repos/{owner}/{repo}/pulls/{number}
- GET /repos/{owner}/{repo}/pulls/{number}/files
- GET /repos/{owner}/{repo}/pulls/{number}/comments
- POST /repos/{owner}/{repo}/pulls/{number}/merge

## Auth

- Use GitHub personal access token (optional for private repos)
- Support unauthenticated mode for public repos

## Rate Limits

- Cache results to reduce API calls
- Avoid refetching unchanged PRs
