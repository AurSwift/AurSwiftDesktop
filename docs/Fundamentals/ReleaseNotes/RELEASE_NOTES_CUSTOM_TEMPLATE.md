# Custom Release Notes Template Implementation

## Overview

This document explains the custom release notes template implementation that adds emoji-prefixed section headers to release notes, improving UX in client update dialogs.

## What Changed

### 1. Configuration File Migration

- **Before**: `.releaserc.json` (JSON format)
- **After**: `.releaserc.js` (JavaScript format)

**Why**: JavaScript format allows us to use functions in the `transform` option, which is required for custom type transformations.

### 2. Custom Template Implementation

The release notes generator uses custom transform functions:

#### Type Transformation

Maps commit types to emoji-prefixed section headers:

```javascript
transform: {
  type: (type) => {
    const typeMap = {
      feat: "✨ Features",
      fix: "🐛 Bug Fixes",
      perf: "⚡ Performance Improvements",
      refactor: "♻️ Code Refactoring",
      revert: "⏪ Reverts",
      build: "🏗️ Build System",
      ci: "👷 CI/CD",
      chore: "🔧 Maintenance",
      docs: "📚 Documentation",
      style: "💄 Code Style",
      test: "✅ Tests",
    };
    return typeMap[type] || type;
  },
}
```

#### Subject Transformation

Removes the "feat(scope):" prefix format AND removes emojis from commit messages:

```javascript
subject: (subject) => {
  // First, remove type(scope): prefix (e.g., "feat(app):" or "fix:")
  let cleanSubject = subject.replace(/^(feat|fix|perf|refactor|revert|build|ci|chore|docs|style|test)(\([^)]+\))?:\s*/i, "").trim();

  // Then remove all emojis (Unicode emojis and shortcodes like :fire:)
  cleanSubject = cleanSubject
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Unicode emojis
    .replace(/:\w+:/g, "") // Emoji shortcodes
    .replace(/\s+/g, " ") // Clean up extra spaces
    .trim();

  return cleanSubject;
};
```

**Result:**

- Commit: `feat(auth): ✨ add user authentication` → Release note: `**auth:** add user authentication`
- Commit: `✨ feat(auth): add user authentication` → Release note: `**auth:** add user authentication`
- Commit: `fix(ui): 🐛 resolve login timeout` → Release note: `**ui:** resolve login timeout`

## How It Works

1. **Commit Analysis**: Semantic-release analyzes commits using the Angular preset
2. **Type Transformation**: The custom `transform.type` function converts commit types to emoji-prefixed headers
3. **Release Notes Generation**: Release notes are generated with emoji-prefixed sections
4. **GitHub Release**: Release notes are published to GitHub releases
5. **Client Display**: `electron-updater` fetches and displays these notes in update dialogs

## Example Output

### Before (Standard Angular Preset)

```markdown
### Bug Fixes

- **electron-builder:** feat(electron-builder): modify requestExecutionLevel configuration
```

### After (Custom Template)

```markdown
### 🐛 Bug Fixes

- **electron-builder:** modify requestExecutionLevel configuration
```

**Key improvements:**

1. **Emoji-prefixed section headers** (✨ Features, 🐛 Bug Fixes, etc.)
2. **Clean commit messages** - Removed "feat(scope):" prefix format
3. **Emojis removed** - Emojis from commit messages (like ✨, 🔥) are removed from release notes for cleaner output
4. **Scope still shown** - Scope appears as "**scope:**" for context, but without the type prefix

**Examples:**

- Commit: `feat(auth): ✨ add user authentication` → Release note: `**auth:** add user authentication`
- Commit: `✨ feat(auth): add user authentication` → Release note: `**auth:** add user authentication`
- Commit: `fix(ui): 🐛 resolve login timeout` → Release note: `**ui:** resolve login timeout`

## Benefits

1. **Better UX**: Emoji-prefixed section headers make release notes more visually appealing and easier to scan
2. **Clean Format**: Removes technical "feat(scope):" prefixes for cleaner, more readable release notes
3. **Emoji Removal**: Emojis from commit messages are removed from release notes for professional, clean output
4. **User-Friendly**: Non-technical users can quickly understand what changed without technical jargon or emoji clutter
5. **Consistent Format**: All release notes follow the same emoji-prefixed section headers with clean commit messages
6. **Maintainable**: Simple configuration that's easy to update

## Testing

To test the custom template locally:

```bash
# Dry run to see what release notes would be generated
npm run semantic-release:dry-run
```

## Configuration Location

- **File**: `.releaserc.js`
- **Plugin**: `@semantic-release/release-notes-generator`
- **Option**: `writerOpts.transform.type`

## Customization

### Adding/Modifying Emoji Mappings

Edit the `typeMap` object in `.releaserc.js`:

```javascript
const typeMap = {
  feat: "✨ Features", // Change emoji or text here
  fix: "🐛 Bug Fixes",
  // Add new types...
};
```

### Adjusting Subject Format

To modify how commit subjects are cleaned, edit the `subject` transform function:

```javascript
subject: (subject) => {
  // Customize the regex pattern or cleaning logic here
  let cleanSubject = subject.replace(/^(feat|fix|...)(\([^)]+\))?:\s*/i, "").trim();

  // Add or remove emoji removal logic as needed
  cleanSubject = cleanSubject
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Remove Unicode emojis
    .replace(/:\w+:/g, "") // Remove emoji shortcodes
    .trim();

  return cleanSubject;
};
```

**Note**: The current implementation removes emojis from commit messages. If you want to preserve emojis, remove the emoji removal lines from the `subject` transform.

## Notes

- The CHANGELOG.md file still uses standard section headers (no emojis) for consistency with markdown standards
- Only GitHub release notes (used by electron-updater) have emoji-prefixed headers
- This follows best practices for end-user-facing release notes

## Related Files

- `.releaserc.js` - Main configuration file
- `packages/main/src/modules/AutoUpdater.ts` - Client-side release notes formatting
- `docs/Guides/ChangeLog/CHANGELOG_GENERATION_GUIDE.md` - Documentation

## References

- [Semantic Release Documentation](https://semantic-release.gitbook.io/)
- [Conventional Changelog Writer](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-writer)
- [Conventional Commits](https://www.conventionalcommits.org/)
