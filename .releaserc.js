export default {
  branches: ["main"],
  repositoryUrl: "https://github.com/AurSwift/AurSwift.git",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "angular",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "revert", release: "patch" },
          { type: "docs", release: false },
          { type: "style", release: false },
          { type: "refactor", release: "patch" },
          { type: "test", release: false },
          { type: "build", release: "patch" },
          { type: "ci", release: false },
          { type: "chore", release: false },
        ],
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "angular",
        writerOpts: {
          commitsSort: ["subject", "scope"],
          transform: {
            // Map commit types to emoji-prefixed section headers
            // The transform.type function receives the type string and returns the transformed type
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
            // Transform the subject to remove type/scope prefix AND emojis
            // This ensures release notes show clean messages like "add user authentication"
            // instead of "feat(app): ✨ add user authentication" or "✨ feat(app): add user authentication"
            // Emojis are removed from commit messages in release notes
            subject: (subject) => {
              // First, remove any type(scope): prefix
              // Pattern matches: "feat", "fix", etc. followed by optional "(scope)" and ": "
              let cleanSubject = subject
                .replace(
                  /^(feat|fix|perf|refactor|revert|build|ci|chore|docs|style|test)(\([^)]+\))?:\s*/i,
                  ""
                )
                .trim();

              // Remove emojis from the subject
              // This regex matches common emoji patterns:
              // - Unicode emojis (most emojis)
              // - Emoji shortcodes like :fire:, :sparkles:, etc.
              cleanSubject = cleanSubject
                // Remove Unicode emojis (covers most emoji ranges)
                .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Miscellaneous Symbols and Pictographs
                .replace(/[\u{1F600}-\u{1F64F}]/gu, "") // Emoticons
                .replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Transport and Map Symbols
                .replace(/[\u{2600}-\u{26FF}]/gu, "") // Miscellaneous Symbols
                .replace(/[\u{2700}-\u{27BF}]/gu, "") // Dingbats
                .replace(/[\u{1F900}-\u{1F9FF}]/gu, "") // Supplemental Symbols and Pictographs
                .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "") // Chess Symbols
                .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "") // Symbols and Pictographs Extended-A
                // Remove emoji shortcodes like :fire:, :sparkles:, etc.
                .replace(/:\w+:/g, "")
                // Clean up any extra spaces left after emoji removal
                .replace(/\s+/g, " ")
                .trim();

              return cleanSubject;
            },
          },
        },
      },
    ],
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle:
          "# Changelog\n\nAll notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.",
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: false,
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json", "package-lock.json"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: [
          {
            path: "dist/*-win-*.exe",
            label: "Windows NSIS Installer",
          },
          {
            // CRITICAL: Blockmap files are required for differential updates
            // electron-updater uses these to download only changed blocks
            path: "dist/*.blockmap",
            label: "NSIS Blockmap (Differential Updates)",
          },
          {
            path: "dist/squirrel-windows/*.nupkg",
            label: "Windows Squirrel Package (Auto-update)",
          },
          {
            path: "dist/squirrel-windows/RELEASES",
            label: "Squirrel Update Manifest",
          },
          {
            path: "dist/latest*.yml",
            label: "Auto-updater Configuration",
          },
        ],
        successComment: false,
        failComment: false,
        failTitle: false,
        labels: false,
        releasedLabels: false,
      },
    ],
  ],
};
