# Data Model

PullRow:
- owner
- repo
- number
- title
- author
- updatedAt
- ciState
- fileCount
- commentsCount

Cache:
- keyed by repo + PR number
- includes timestamps
