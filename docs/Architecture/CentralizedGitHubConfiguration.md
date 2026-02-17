# Centralized GitHub Configuration

## Overview

This document describes the centralized GitHub repository configuration architecture, which ensures that all GitHub-related URLs, repository names, and release configurations are derived from a single source of truth.

## Problem Solved

Previously, GitHub repository information was hardcoded in multiple locations:

- `package.json` (repository URL)
- `electron-builder.mjs` (owner/repo for auto-updates)
- `.releaserc.js` (repository URL for semantic-release)
- Source code files (AutoUpdater.ts, WindowManager.ts)

This created maintenance issues:

- ❌ When renaming a repository, multiple files needed manual updates
- ❌ Risk of inconsistent URLs across the codebase
- ❌ No single source of truth
- ❌ Difficult to audit which files reference the repository

## Solution Architecture

### Single Source of Truth: `package.json`

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/AurSwift/AurSwiftDesktop.git"
  },
  "github": {
    "owner": "AurSwift",
    "repo": "AurSwiftDesktop"
  }
}
```

The `github` field contains the owner and repository name as discrete values, making them easy to consume programmatically.

---

## Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      package.json                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │ "github": {                                         │     │
│  │   "owner": "AurSwift",                             │     │
│  │   "repo": "AurSwiftDesktop"                        │     │
│  │ }                                                   │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────┬──────────────────┬─────────────────┬─────┘
                   │                   │                 │
                   ▼                   ▼                 ▼
       ┌───────────────────┐  ┌──────────────┐  ┌─────────────────────┐
       │ electron-builder  │  │ .releaserc   │  │ packages/shared/    │
       │     .mjs          │  │     .js      │  │ src/constants/      │
       ├───────────────────┤  ├──────────────┤  │ github.ts           │
       │ const { owner,    │  │ const {      │  ├─────────────────────┤
       │   repo } =        │  │   owner,     │  │ export const        │
       │   pkg.github;     │  │   repo } =   │  │ GITHUB_REPO_URL     │
       │                   │  │   pkg.github;│  │ GITHUB_RELEASES_URL │
       │ publish: {        │  │              │  └──────────┬──────────┘
       │   owner,          │  │ repositoryUrl│             │
       │   repo            │  │ = `https://  │             │
       │ }                 │  │   github.com/│             │
       └────────┬──────────┘  │   ${owner}/  │             │
                │              │   ${repo}.   │             │
                │              │   git`       │             │
                │              └──────────────┘             │
                │                                           │
                ▼                                           ▼
    ┌────────────────────┐              ┌──────────────────────────────┐
    │ Auto-Update System │              │ Application Source Code      │
    ├────────────────────┤              ├──────────────────────────────┤
    │ • Checks GitHub    │              │ • AutoUpdater.ts             │
    │   Releases API     │              │ • WindowManager.ts           │
    │ • Downloads .exe   │              │ • About dialog               │
    │ • Verifies updates │              │ • Release notes links        │
    └────────────────────┘              └──────────────────────────────┘
```

---

## File Structure

### 1. Configuration Layer (`package.json`)

**File:** `package.json`

```json
{
  "github": {
    "owner": "AurSwift",
    "repo": "AurSwiftDesktop"
  }
}
```

**Purpose:** Single source of truth for all GitHub-related configuration.

---

### 2. Build Configuration Layer

#### A. Electron Builder (`electron-builder.mjs`)

**Reads from:** `package.json`

```javascript
import pkg from "./package.json" with { type: "json" };

const { owner, repo } = pkg.github;

export default {
  publish: {
    provider: "github",
    owner, // ← Dynamic from package.json
    repo, // ← Dynamic from package.json
    releaseType: "release",
  },
  squirrelWindows: {
    iconUrl: `https://raw.githubusercontent.com/${owner}/${repo}/main/buildResources/icon.ico`,
  },
};
```

**Used by:**

- `electron-updater` for checking updates
- Auto-update system to download releases
- Build process to generate update manifests (latest.yml)

---

#### B. Semantic Release (`.releaserc.js`)

**Reads from:** `package.json`

```javascript
import pkg from "./package.json" with { type: "json" };

const { owner, repo } = pkg.github;

export default {
  repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  // ... plugins configuration
};
```

**Used by:**

- Automated release workflow
- Generating CHANGELOG.md
- Creating GitHub releases
- Uploading build artifacts

---

### 3. Application Constants Layer

#### Shared Constants (`packages/shared/src/constants/github.ts`)

**File:** `packages/shared/src/constants/github.ts`

```typescript
/**
 * Centralized GitHub repository configuration
 * Single source of truth for all GitHub-related URLs
 */

export const GITHUB_CONFIG = {
  owner: "AurSwift",
  repo: "AurSwiftDesktop",
} as const;

export const GITHUB_REPO_URL = `https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;

export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
```

**Exported via:** `packages/shared/src/index.ts`

```typescript
export * from "./constants/github.js";
```

---

### 4. Application Code Layer

#### A. Auto-Updater (`packages/main/src/modules/AutoUpdater.ts`)

```typescript
import { GITHUB_REPO_URL, GITHUB_RELEASES_URL } from "@app/shared";

export class AutoUpdater implements AppModule {
  readonly #GITHUB_RELEASES_URL = GITHUB_RELEASES_URL;

  // Uses GITHUB_RELEASES_URL for opening release notes
}
```

**Purpose:**

- Links to release notes when update available
- Provides GitHub releases URL in notifications

---

#### B. Window Manager (`packages/main/src/modules/WindowManager.ts`)

```typescript
import { GITHUB_REPO_URL, GITHUB_RELEASES_URL } from "@app/shared";

// Help menu
{
  label: "View Release Notes",
  click: () => {
    shell.openExternal(GITHUB_RELEASES_URL);
  },
}

// About dialog
{
  detail: `Version: ${version}\n\nGitHub: ${GITHUB_REPO_URL.replace("https://", "")}`,
  buttons: ["OK", "Visit GitHub"],
}
```

**Purpose:**

- Menu items linking to GitHub
- About dialog showing repository information

---

## How to Update Repository Name

When you rename your GitHub repository, you only need to update **TWO files**:

### Step 1: Update `package.json`

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/NewOwner/NewRepoName.git"
  },
  "github": {
    "owner": "NewOwner",
    "repo": "NewRepoName"
  }
}
```

### Step 2: Update Constants

```typescript
// packages/shared/src/constants/github.ts
export const GITHUB_CONFIG = {
  owner: "NewOwner",
  repo: "NewRepoName",
} as const;
```

### Step 3: Rebuild

```bash
npm run build
```

**That's it!** All build configurations, auto-update URLs, and application code will automatically use the new repository name.

---

## Verification Checklist

After updating the repository name, verify these components:

### Build System

- [ ] `electron-builder.mjs` reads correct owner/repo
- [ ] `.releaserc.js` generates correct repository URL
- [ ] Build completes without errors

### Auto-Update System

- [ ] Latest.yml contains correct GitHub release URL
- [ ] Squirrel installer references correct iconUrl
- [ ] App checks for updates from correct repository

### Application UI

- [ ] Help → View Release Notes opens correct URL
- [ ] About dialog shows correct GitHub URL
- [ ] Update notifications link to correct releases page

---

## Benefits

✅ **Single Update Point**: Change repository name in 2 files (package.json + constants)  
✅ **Type Safety**: TypeScript constants prevent typos in source code  
✅ **Build-Time Validation**: Configs fail early if package.json is invalid  
✅ **Consistency**: Impossible to have mismatched URLs across the codebase  
✅ **Auditable**: Easy to find all GitHub references via imports  
✅ **Maintainable**: Future developers understand the architecture immediately

---

## Technical Details

### Why Two Sources? (package.json + constants)

**Q:** Why not read package.json directly in source code?

**A:** Different runtime environments:

1. **Build configs** (electron-builder.mjs, .releaserc.js)
   - Run in Node.js during build
   - Can import package.json directly
   - Static configuration files

2. **Application code** (AutoUpdater, WindowManager)
   - Run in Electron main process
   - Bundled/transpiled by Vite/Rollup
   - Need TypeScript constants for type safety

**Best Practice:**

- Build tools → Read from `package.json`
- App code → Import from `@app/shared` constants

---

## Related Files

| File                                         | Purpose            | Reads From     |
| -------------------------------------------- | ------------------ | -------------- |
| `package.json`                               | Source of truth    | N/A            |
| `electron-builder.mjs`                       | Auto-update config | `package.json` |
| `.releaserc.js`                              | Release automation | `package.json` |
| `packages/shared/src/constants/github.ts`    | App constants      | Manual sync    |
| `packages/main/src/modules/AutoUpdater.ts`   | Update logic       | `@app/shared`  |
| `packages/main/src/modules/WindowManager.ts` | UI menus           | `@app/shared`  |

---

## Migration History

**Before:** Hardcoded in 8+ locations  
**After:** Centralized in 2 locations (package.json + shared constants)

**Changed Files (Feb 2026):**

- ✅ package.json - Added `github` field
- ✅ electron-builder.mjs - Read from package.json
- ✅ .releaserc.js - Read from package.json
- ✅ packages/shared/src/constants/github.ts - Created
- ✅ packages/main/src/modules/AutoUpdater.ts - Use shared constants
- ✅ packages/main/src/modules/WindowManager.ts - Use shared constants

---

## See Also

- [Electron Builder Configuration](https://www.electron.build/configuration/publish)
- [Semantic Release GitHub Plugin](https://github.com/semantic-release/github)
- [Electron Updater](https://www.electron.build/auto-update)
