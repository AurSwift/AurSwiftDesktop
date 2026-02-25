#Branching Gudies
In a structured Git branching model (like GitFlow or its variants), branches are typically named with **prefixes** to indicate their purpose. This makes it easy to understand what kind of work is being done and where it should be merged. Below are the **standard branch naming conventions** used in real‑world projects, covering all common work types.

---

## Common Branch Prefixes and Their Meanings

| Prefix      | Purpose                                                                               | Merged Into        | Example                     |
| ----------- | ------------------------------------------------------------------------------------- | ------------------ | --------------------------- |
| `feature/`  | New features or enhancements                                                          | `develop`          | `feature/user-login`        |
| `feat/`     | Shorter alias for feature (used by some teams)                                        | `develop`          | `feat/api-endpoint`         |
| `bugfix/`   | Fixes for bugs found during development (not yet released)                            | `develop`          | `bugfix/button-color`       |
| `fix/`      | Shorter alias for bugfix                                                              | `develop`          | `fix/typo-in-readme`        |
| `hotfix/`   | Urgent production fixes (branched directly from `main`/`master`)                      | `main` & `develop` | `hotfix/critical-security`  |
| `release/`  | Preparation for a new release (final tweaks, version bumps) – **optional** in GitFlow | `main` & `develop` | `release/v1.2.0`            |
| `chore/`    | Routine tasks, dependency updates, configuration changes                              | `develop`          | `chore/update-dependencies` |
| `docs/`     | Documentation changes only (README, comments, wiki)                                   | `develop`          | `docs/api-usage-example`    |
| `refactor/` | Code restructuring without changing behaviour                                         | `develop`          | `refactor/user-service`     |
| `test/`     | Adding or updating tests                                                              | `develop`          | `test/coverage-setup`       |
| `style/`    | Code style/formatting changes (whitespace, linting)                                   | `develop`          | `style/indentation`         |
| `perf/`     | Performance improvements                                                              | `develop`          | `perf/caching-strategy`     |
| `ci/`       | Changes to CI/CD configuration (GitHub Actions, Jenkins, etc.)                        | `develop`          | `ci/add-test-workflow`      |
| `build/`    | Changes to build system or external dependencies                                      | `develop`          | `build/webpack-upgrade`     |
| `revert/`   | Reverting a previous commit                                                           | `develop`          | `revert/abc123`             |

> **Note:** Some teams prefer to use the prefix `bugfix/` for bugs found during development and reserve `fix/` for small, quick fixes. The exact naming can be adapted to your team’s preference.

---

## Best Practices for Branch Naming

1. **Use Lowercase and Hyphens**  
   Always use lowercase letters and separate words with hyphens (`-`). This avoids issues with case‑sensitive file systems and is standard in Git.

2. **Include the Issue/Ticket Number (Optional but Helpful)**  
   Many teams append the issue ID from their tracking system (Jira, GitHub Issues, etc.) for easy traceability.  
   Examples:
   - `feature/PROJ-123-add-payment`
   - `bugfix/456-button-overflow`

3. **Keep It Descriptive but Concise**  
   The name should give a clear idea of the work without being overly long.  
   ✅ Good: `feature/oauth2-login`  
   ❌ Too vague: `feature/fix`  
   ❌ Too long: `feature/implement-oauth2-login-with-google-and-facebook-providers`

4. **Avoid Special Characters**  
   Stick to letters, numbers, hyphens, and slashes. Avoid spaces, underscores, and punctuation like `!@#$%^&*()`.

5. **Be Consistent Across the Team**  
   Agree on a set of prefixes and enforce them with tooling (e.g., [branch-name-linter](https://github.com/talos-systems/branch-name-linter) or a simple Git hook).

---

## How These Branches Fit Into the Release Strategy

In the **Release Branch Strategy** we discussed earlier:

- **Developers** create branches from `develop` using one of the above prefixes (`feature/`, `bugfix/`, `chore/`, etc.).
- They work, commit, and open a **Pull Request** back to `develop`.
- After review and testing, the branch is merged into `develop`.
- `develop` accumulates all these changes over time.
- When it’s time for a release, `develop` is merged into `main` (or a `release/` branch is created first for final preparation).
- The merge to `main` triggers the automated release process.

This workflow keeps the purpose of each branch clear and maintains a clean history.

---

## Real‑World Examples from Open Source Projects

- **Angular** uses `feat/`, `fix/`, `docs/`, `style/`, `refactor/`, `test/` in their commit messages (Conventional Commits) and often branch names mirror those.
- **Next.js** uses `feat/`, `fix/`, `chore/`, `docs/` for pull requests.
- **React** uses `feature/`, `bugfix/`, `experimental/`, etc.

---

## Tooling to Enforce Branch Naming

You can automate consistency with:

- **Git hooks** (e.g., a `pre-commit` or `pre-push` hook that checks the branch name).
- **GitHub branch protection rules** with required naming patterns (available in GitHub Enterprise).
- **Third‑party actions** like [actions-branch-name](https://github.com/actions/checkout) (customisable).

Example GitHub Action that validates branch names on pull requests:

```yaml
name: "Validate Branch Name"
on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  check-branch:
    runs-on: ubuntu-latest
    steps:
      - name: Check branch name
        run: |
          BRANCH_NAME="${{ github.head_ref }}"
          if [[ ! "$BRANCH_NAME" =~ ^(feature|fix|bugfix|hotfix|chore|docs|refactor|test)/.+$ ]]; then
            echo "Branch name '$BRANCH_NAME' does not match the required pattern."
            exit 1
          fi
```

---

## Summary

- Use **prefixes** to classify branches by work type: `feature/`, `bugfix/`, `hotfix/`, `chore/`, `docs/`, etc.
- Follow **lowercase‑with‑hyphens** naming, optionally include ticket numbers.
- This makes your repository self‑documenting and helps both humans and automation understand the purpose of each branch.
- It integrates perfectly with the **release branch strategy** (develop → main) for controlled, batched releases.

By adopting these conventions, your team will have a consistent, scalable branching model that works well with semantic release automation.

# Scenarios where a certain type of branch have docs, fix, chore related commits

It's completely normal for a **feature branch** (or any branch) to contain more than just the primary type of change. In practice, a developer working on a new feature might:

- Fix a small bug they notice along the way.
- Update documentation related to the feature.
- Refactor some existing code to accommodate the feature.
- Add tests for the new functionality.
- Update dependencies if needed.

All of these are part of the same **logical unit of work** – the feature. So having a mix of commit types (feat, fix, docs, refactor, test, chore) in one branch is not only acceptable but often unavoidable.

---

## How This Affects Your Branch Naming and Releases

- **Branch name:** It's still best to name the branch after the **primary purpose** (e.g., `feat/user-login`). The branch name doesn't need to list every type of change inside.
- **Commit messages:** This is where it matters. Each commit should follow the **conventional commits** specification (e.g., `feat: add login form`, `fix: correct error message`, `docs: update README with login instructions`). This ensures that when the branch is merged, `semantic-release` can correctly determine the next version.
- **Release version:** The version bump will be based on the **most significant** commit type in the entire batch of commits since the last release. For example, if the branch contains three `fix` commits and one `feat` commit, the release will be a **minor** bump (because `feat` is more significant than `fix`). If there's a breaking change, it will be a **major** bump, regardless of other commits.

So, the presence of documentation updates or minor fixes alongside a feature does **not** cause a problem. In fact, it's often desirable to keep all related changes together so that the feature is fully delivered in one batch.

---

## Potential Pitfalls to Avoid

While mixing change types is fine, here are a few things to watch out for:

1. **Unrelated changes** – If a developer adds a completely unrelated bug fix that is not connected to the feature (e.g., fixing a typo in a completely different part of the app), it's better to put that in a separate branch (`fix/...`) and merge it independently. This keeps the feature branch focused and avoids coupling unrelated changes.

2. **Large refactors** – If a significant refactor is needed to implement the feature, it's often wise to do the refactor in a separate branch first (`refactor/...`), test it, and then merge it into `develop`. Then the feature branch can be created from the updated `develop`. This makes the history cleaner and reduces the risk of bugs.

3. **Breaking changes** – If your feature introduces a breaking change, make sure at least one commit includes `BREAKING CHANGE` in its footer (or uses `!` after the type, e.g., `feat!: remove old API`). This signals a major version bump.

4. **Commit message discipline** – Ensure developers write clear, conventional commit messages even for "small" changes like docs or fixes. This preserves the value of the commit history for release automation and changelog generation.

---

## Real-World Example

Suppose you're adding a "dark mode" feature. Your branch might have commits like:

- `feat: add dark mode toggle button`
- `fix: correct contrast in dark mode for error messages`
- `docs: explain dark mode usage in README`
- `test: add unit tests for theme switching`
- `chore: update color palette config`

When merged, `semantic-release` will see a `feat` as the most significant type, so the next release will be a **minor** version bump. The changelog will include all these changes (unless you configure it to skip certain types). The branch name can be `feat/dark-mode` – simple and clear.
