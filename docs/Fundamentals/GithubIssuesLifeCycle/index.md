## How Issues are Created in Github

### 1. Creating Issues (Platform Interfaces)

**GitHub:**

- Go to your repository → "Issues" tab → "New Issue"
- Fill in title, description, labels (bug, enhancement, etc.), assignees
- Example: `https://github.com/username/repo/issues/new`

**GitLab:**

- Project → "Issues" → "New Issue"
- Similar structure with titles, descriptions, labels

**Bitbucket:**

- Repository → "Issues" → "Create issue"

### 2. Issue Numbering

When you create an issue, the platform automatically assigns it a unique number:

- Issue #1, #2, #3, etc.
- This number is what you reference in commit messages

## How the Linking Works

### The Magic Keywords

Platforms recognize specific keywords in commit messages:

| Keyword           | Effect                                                  |
| ----------------- | ------------------------------------------------------- |
| `fixes #123`      | **Closes the issue** when commit reaches default branch |
| `closes #456`     | Same as fixes - closes the issue                        |
| `resolves #789`   | Same as fixes/closes                                    |
| `related to #101` | Links but doesn't automatically close                   |
| `see #202`        | Creates a reference link                                |

### Example Workflow

```bash
# 1. Create issue on GitHub: "Login page crashes on mobile" -> gets assigned #45
# 2. Work on the fix
git checkout -b fix/login-mobile-crash
# ... make changes ...
git add .
git commit -m "fix(login): resolve mobile layout crash

- Fix CSS flexbox issues on mobile screens
- Add responsive breakpoints for login form
- Test on various screen sizes

Fixes #45"
git push origin fix/login-mobile-crash
```

## What Happens Behind the Scenes

### 1. Commit Push

When you push to a branch with these keywords:

- The platform detects `Fixes #45` in your commit message
- It automatically creates a link between the commit and issue #45
- The issue shows "linked" to your commit/branch

### 2. Pull/Merge Request

When you create a Pull Request (GitHub) or Merge Request (GitLab):

- The platform shows linked issues in the PR description
- If your PR contains `Fixes #45`, it might show "Closes #45" automatically

### 3. Merge to Main Branch

When your branch gets merged into `main`/`master`:

- The platform sees the `Fixes #45` keyword
- **Automatically closes issue #45**
- Adds a comment: "Closed by commit abc123"

## Getting Started - Step by Step

### Step 1: Choose Your Platform

- **GitHub**: Most popular, great for open source
- **GitLab**: Excellent CI/CD, self-hostable
- **Bitbucket**: Good for private repos (free)

### Step 2: Create Your First Issue

1. Go to your repository on the platform
2. Click "Issues" → "New Issue"
3. Fill in:
   - **Title**: "Fix broken authentication"
   - **Description**: "Users can't login with OAuth2"
   - **Labels**: `bug`, `high-priority`
4. Note the issue number (e.g., #1)

### Step 3: Link in Commit

```bash
git commit -m "fix(auth): repair OAuth2 login flow

- Update OAuth2 configuration
- Fix callback URL handling
- Add error logging for auth failures

Fixes #1"
```

### Step 4: Watch the Magic

- Push your commit
- Go to issue #1 → you'll see it's linked to your commit
- When merged, it will automatically close

## Advanced Linking Patterns

### Multiple Issues

```bash
git commit -m "feat(api): implement user management endpoints

- Add GET/POST/PUT/DELETE for users
- Implement pagination
- Add rate limiting

Fixes #123
Closes #456
Related to #789"
```

### Different Branches

```bash
# On feature branch - links but doesn't close yet
git commit -m "feat(payment): add stripe integration

Related to #33"

# Later when merging to main - use fixes/closes
git commit -m "feat(payment): complete stripe integration

- Handle webhooks
- Add error recovery
- Update documentation

Closes #33"
```

### Cross-Repository Issues

```bash
# Reference issues from other repos (GitHub)
git commit -m "fix: resolve dependency conflict

Fixes organization/other-repo#123"
```

## Best Practices

### 1. Put Keywords in Footer

```markdown
feat(api): add new endpoints

Add user management and profile endpoints with
improved error handling and validation.

Fixes #45
Related to #78
```

### 2. Be Specific in Commit Messages

```markdown
# Good

fix(auth): resolve login timeout issue

The login was timing out after 30 seconds due to
incorrect session configuration.

Fixes #123

# Bad

fix(auth): fix stuff

Fixes #123
```

### 3. Use the Right Keyword

- `fixes`/`closes` - for when the issue is completely resolved
- `related to` - for partial fixes or dependencies
- `see` - for references only

## Real Example from Start to Finish

```bash
# 1. Create issue on GitHub: "Button not visible on dark theme" -> #15
# 2. Create branch
git checkout -b fix/dark-theme-button

# 3. Make changes and commit
git add .
git commit -m "fix(ui): improve button visibility on dark theme

- Increase button contrast ratio to 4.5:1
- Add border for better visibility
- Update color variables for theme consistency

Fixes #15"

# 4. Push and create PR
git push origin fix/dark-theme-button
# Then create Pull Request on GitHub

# 5. When PR is merged, issue #15 automatically closes!
```

This integration is incredibly powerful for project management because it creates a clear audit trail from problem identification → solution → deployment, all automatically linked together.
