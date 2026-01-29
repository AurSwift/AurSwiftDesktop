# Electron Native Modules: @electron/rebuild vs electron-builder

## @electron/rebuild

The purpose of @electron/rebuild is to rebuild native Node.js modules (like better-sqlite3, usb, serialport, etc.) so they are compatible with the version of Electron you are using.

Native modules are compiled against a specific version of Node.js. Electron uses its own version of Node.js, which may differ from your system's Node.js. If you install native modules with npm, they are built for your system Node.js, not Electron. This can cause runtime errors like "Module version mismatch" when running your Electron app.

@electron/rebuild recompiles these native modules against Electron's headers, ensuring they work correctly in your Electron app. It is typically run after every npm install (as in your postinstall script) to keep native modules in sync with Electron.

- **When to use:** After `npm install` or whenever you add/update native dependencies.
- **How it works:** Compiles native modules against Electron’s headers, ensuring they work with Electron’s custom Node.js version.
- **Usage:** Development-time tool. Typically run automatically via a `postinstall` script.
- **Why needed:** Native modules installed with npm are built for your system Node.js, not Electron. This can cause runtime errors (e.g., "Module version mismatch"). `@electron/rebuild` fixes this by rebuilding them for Electron.
- **Alternatives:**
  - Manually rebuild with `npm rebuild` and custom environment variables (complex and error-prone).
  - Some modules provide prebuilt Electron binaries, but not all.
  - Tools like `electron-forge` or `electron-builder` may have their own hooks, but use similar logic under the hood.

## electron-builder

- **Purpose:** Packages and builds your Electron app for distribution (creates `.exe`, `.dmg`, `.AppImage`, etc.).
- **When to use:** When you want to create an installer or distributable for your app.
- **How it works:** Bundles your app, its dependencies, and native modules into a final product for end users. Handles code signing, auto-update, and more.
- **Usage:** Run as a build step (e.g., `npm run compile`, `npm run compile:mac`).
- **Native modules:** Ensures rebuilt native modules are included in the final packaged app.

## Summary

- Use `@electron/rebuild` to ensure native modules work in development with Electron.
- Use `electron-builder` to package and distribute your finished Electron app.
- Both are commonly used together in real-world Electron projects.

# electron-rebuild vs npm rebuild vs npm run electron-rebuild

## npx electron-rebuild

- Runs the `electron-rebuild` CLI tool directly using `npx` (no need to install globally).
- Rebuilds all native Node.js modules in your `node_modules` to be compatible with your current Electron version.
- Usage: `npx electron-rebuild`
- Most direct and recommended way to manually trigger a rebuild for Electron.

## npm rebuild

- Runs the standard npm rebuild process for all native modules, but **targets your system Node.js version**, not Electron.
- Does **not** use Electron headers, so native modules will not work in Electron unless you set special environment variables (complex and error-prone).
- Usage: `npm rebuild`
- Not suitable for Electron unless you customize the environment for Electron headers.

## npm run electron-rebuild

- Runs a script named `electron-rebuild` from your `package.json` scripts section, if defined.
- Example in `package.json`:
  ```json
  "scripts": {
    "electron-rebuild": "electron-rebuild"
  }
  ```
- Usage: `npm run electron-rebuild`
- Equivalent to running `npx electron-rebuild` if the script is set up, but allows you to add custom flags or logic.

## Summary Table

| Command                  | Rebuilds for Electron? | Needs config? | Typical Use                 |
| ------------------------ | ---------------------- | ------------- | --------------------------- |
| npx electron-rebuild     | Yes                    | No            | Manual rebuild for Electron |
| npm rebuild              | No (system Node.js)    | Yes           | General Node.js projects    |
| npm run electron-rebuild | Yes (if script exists) | No            | Project-specific script     |

---

## Do you need to rebuild better-sqlite3 when your schema changes?

You do **not** need to run a command like `npm run better-sqlite3` (or `electron-rebuild`) just because your database schema changes.

You only need to rebuild native modules like `better-sqlite3` after certain events:

- **If you update Electron or Node.js versions:** You must run `electron-rebuild` (or `npm run electron-rebuild`) to recompile `better-sqlite3` for the new runtime.
- **If you delete `node_modules` and reinstall, or if you upgrade `better-sqlite3` itself:** You should also run `electron-rebuild`.

When you change your database schema (e.g., add tables/columns), you only need to:

- Update your migration files and run your migration tool (like drizzle-kit or your migration scripts).
- Optionally, regenerate TypeScript types if you use a tool for that.

You do **NOT** need to rebuild `better-sqlite3` just because your schema changes. You only need to rebuild it if the Electron or Node.js version changes, or if the native module itself is updated or reinstalled.
