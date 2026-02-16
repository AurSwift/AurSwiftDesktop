import pkg from "./package.json" with { type: "json" };
import mapWorkspaces from "@npmcli/map-workspaces";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Centralized GitHub config from package.json
const { owner, repo } = pkg.github;

export default /** @type import('electron-builder').Configuration */
({
  directories: {
    output: "dist",
    buildResources: "buildResources",
  },
  generateUpdatesFilesForAllChannels: true,
  // Note: Differential updates are automatically enabled for NSIS and Squirrel targets
  // in electron-builder 26.x. No explicit configuration needed.
  publish: {
    provider: "github",
    owner,
    repo,
    releaseType: "release",
    channel: "latest", // Explicitly set channel to 'latest' to generate latest.yml
  },
  mac: {
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"],
      },
      {
        target: "zip",
        arch: ["x64", "arm64"],
      },
    ],
    icon: "buildResources/icon.icns",
  },
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"], // Focus on x64 only - Windows 10 Enterprise typically uses x64
      },
      {
        target: "squirrel",
        arch: ["x64"], // Focus on x64 only
      },
    ],
    icon: "buildResources/icon.ico",
    verifyUpdateCodeSignature: false, // Set to true when you have code signing certificate
    requestedExecutionLevel: "asInvoker", // Don't require admin by default - let NSIS handle elevation
    // Ensure compatibility with Windows 10 Enterprise
    // Note: electron-builder automatically includes Visual C++ Redistributables for native modules
    // (better-sqlite3, node-hid, serialport, usb) when needed
    // The app is built on windows-2022 runner for better Windows 10 Enterprise compatibility
  },
  squirrelWindows: {
    // iconUrl is required for Squirrel - must be a public URL
    iconUrl:
      `https://raw.githubusercontent.com/${owner}/${repo}/main/buildResources/icon.ico`,
    // Optional: Add a loading GIF during installation
    // loadingGif: 'buildResources/install-spinner.gif'
  },
  nsis: {
    oneClick: true, // Silent one-click install (no wizard dialog)
    perMachine: false, // Install to user profile (no admin required)
    allowElevation: false, // No elevation needed for user install
    allowToChangeInstallationDirectory: false, // One-click doesn't show directory picker
    createDesktopShortcut: true, // Create desktop shortcut
    createStartMenuShortcut: true, // Create Start Menu shortcut
    shortcutName: "aurswift", // Shortcut name
    deleteAppDataOnUninstall: true, // Remove user data when uninstalling
    menuCategory: true, // Create program group in Start Menu
    runAfterFinish: true, // Run app after installation completes
    installerIcon: "buildResources/icon.ico",
    uninstallerIcon: "buildResources/icon.ico",
    // installerHeader requires .bmp format (150x57 pixels), not .ico
    // Removing it to use default NSIS header
    license: undefined, // Path to license.txt (optional)
    // Request execution level is set in win.requestedExecutionLevel (not in nsis config)
    // Include Visual C++ Redistributables check/install
    // Note: electron-builder will automatically include VC++ Redist if needed
    // but we ensure compatibility with Windows 10 Enterprise
    include: undefined, // Use default includes
  },
  linux: {
    target: ["deb"],
  },
  /**
   * It is recommended to avoid using non-standard characters such as spaces in artifact names,
   * as they can unpredictably change during deployment, making them impossible to locate and download for update.
   */
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
  files: [
    "LICENSE*",
    pkg.main,
    "!node_modules/@app/**",
    // Exclude development and unnecessary files
    "!**/*.d.ts", // Exclude TypeScript definitions
    "!**/*.map", // Exclude source maps
    "!**/test/**",
    "!**/tests/**",
    "!**/__tests__/**",
    "!**/*.test.*",
    "!**/*.spec.*",
    // Exclude platform-specific native binaries for non-target platforms
    // Windows x64 builds: exclude darwin, linux, android, and ia32 binaries
    // Note: Only exclude prebuilds for non-Windows platforms
    // The actual Windows binaries will be included via asarUnpack
    "!**/usb/prebuilds/darwin-*/**",
    "!**/usb/prebuilds/linux-*/**",
    "!**/usb/prebuilds/android-*/**",
    "!**/usb/prebuilds/win32-ia32/**",
    "!**/usb/prebuilds/win32-arm64/**",
    "!**/usb/bin/darwin-*/**",
    "!**/better-sqlite3/bin/darwin-*/**",
    "!**/better-sqlite3/bin/linux-*/**",
    "!**/better-sqlite3/bin/android-*/**",
    "!**/node-hid/prebuilds/darwin-*/**",
    "!**/node-hid/prebuilds/linux-*/**",
    "!**/node-hid/prebuilds/android-*/**",
    "!**/node-hid/prebuilds/win32-ia32/**",
    "!**/node-hid/prebuilds/win32-arm64/**",
    "!**/serialport/prebuilds/darwin-*/**",
    "!**/serialport/prebuilds/linux-*/**",
    "!**/serialport/prebuilds/android-*/**",
    "!**/serialport/prebuilds/win32-ia32/**",
    "!**/serialport/prebuilds/win32-arm64/**",
    ...(await getListOfFilesFromEachWorkspace()),
  ],
  // Unpack native modules from asar (required for native .node files)
  asarUnpack: [
    "**/better-sqlite3/**/*.node",
    "**/node-hid/**/*.node",
    "**/serialport/**/*.node",
    "**/usb/**/*.node",
  ],
  // Include migrations as extraResources so they're accessible outside asar if needed
  // IMPORTANT: Include ALL files including meta/_journal.json and snapshot files
  extraResources: [
    {
      from: "packages/main/dist/migrations",
      to: "migrations",
      filter: ["**/*"], // Include all files: .sql, meta/_journal.json, meta/*.json
    },
  ],
});

/**
 * By default, electron-builder copies each package into the output compilation entirety,
 * including the source code, tests, configuration, assets, and any other files.
 *
 * So you may get compiled app structure like this:
 * ```
 * app/
 * ├── node_modules/
 * │   └── workspace-packages/
 * │       ├── package-a/
 * │       │   ├── src/            # Garbage. May be safely removed
 * │       │   ├── dist/
 * │       │   │   └── index.js    # Runtime code
 * │       │   ├── vite.config.js  # Garbage
 * │       │   ├── .env            # some sensitive config
 * │       │   └── package.json
 * │       ├── package-b/
 * │       ├── package-c/
 * │       └── package-d/
 * ├── packages/
 * │   └── entry-point.js
 * └── package.json
 * ```
 *
 * To prevent this, we read the “files”
 * property from each package's package.json
 * and add all files that do not match the patterns to the exclusion list.
 *
 * This way,
 * each package independently determines which files will be included in the final compilation and which will not.
 *
 * So if `package-a` in its `package.json` describes
 * ```json
 * {
 *   "name": "package-a",
 *   "files": [
 *     "dist/**\/"
 *   ]
 * }
 * ```
 *
 * Then in the compilation only those files and `package.json` will be included:
 * ```
 * app/
 * ├── node_modules/
 * │   └── workspace-packages/
 * │       ├── package-a/
 * │       │   ├── dist/
 * │       │   │   └── index.js    # Runtime code
 * │       │   └── package.json
 * │       ├── package-b/
 * │       ├── package-c/
 * │       └── package-d/
 * ├── packages/
 * │   └── entry-point.js
 * └── package.json
 * ```
 */
async function getListOfFilesFromEachWorkspace() {
  /**
   * @type {Map<string, string>}
   */
  const workspaces = await mapWorkspaces({
    cwd: process.cwd(),
    pkg,
  });

  const allFilesToInclude = [];

  for (const [name, path] of workspaces) {
    const pkgPath = join(path, "package.json");
    const { default: workspacePkg } = await import(pathToFileURL(pkgPath), {
      with: { type: "json" },
    });

    let patterns = workspacePkg.files || ["dist/**", "package.json"];

    patterns = patterns.map((p) => join("node_modules", name, p));
    allFilesToInclude.push(...patterns);
  }

  return allFilesToInclude;
}
