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
