#!/usr/bin/env node

/**
 * Package Size Analysis Script for aurswift
 *
 * Analyzes package sizes and their impact on the app bundle.
 * Run with: npm run analyze:packages
 */

import { execSync } from "child_process";
import { readdirSync, statSync, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname, "..");

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function getDirSize(dirPath) {
  if (!existsSync(dirPath)) return 0;

  let totalSize = 0;
  try {
    const items = readdirSync(dirPath);
    for (const item of items) {
      const itemPath = join(dirPath, item);
      try {
        const stats = statSync(itemPath);
        if (stats.isDirectory()) {
          totalSize += getDirSize(itemPath);
        } else {
          totalSize += stats.size;
        }
      } catch (err) {
        // Skip files we can't access
      }
    }
  } catch (err) {
    // Skip directories we can't access
  }
  return totalSize;
}

function analyzeNodeModules() {
  console.log(
    `\n${colors.cyan}${colors.bright}📦 Analyzing node_modules...${colors.reset}\n`
  );

  const nodeModulesPath = join(rootDir, "node_modules");
  if (!existsSync(nodeModulesPath)) {
    console.log(
      `${colors.yellow}⚠️  node_modules not found. Run 'npm install' first.${colors.reset}`
    );
    return;
  }

  const packages = [];
  try {
    const items = readdirSync(nodeModulesPath);
    for (const item of items) {
      // Skip scoped packages directory itself
      if (item.startsWith("@")) {
        const scopedPath = join(nodeModulesPath, item);
        try {
          const scopedItems = readdirSync(scopedPath);
          for (const scopedItem of scopedItems) {
            const pkgPath = join(scopedPath, scopedItem);
            const size = getDirSize(pkgPath);
            packages.push({ name: `${item}/${scopedItem}`, size });
          }
        } catch (err) {
          // Skip if can't read
        }
      } else {
        const pkgPath = join(nodeModulesPath, item);
        const size = getDirSize(pkgPath);
        packages.push({ name: item, size });
      }
    }
  } catch (err) {
    console.error(
      `${colors.red}Error reading node_modules: ${err.message}${colors.reset}`
    );
    return;
  }

  // Sort by size
  packages.sort((a, b) => b.size - a.size);

  console.log(`${colors.bright}Top 20 Largest Packages:${colors.reset}`);
  console.log("─".repeat(60));
  packages.slice(0, 20).forEach((pkg, index) => {
    const isNative = ["better-sqlite3", "node-hid", "usb", "serialport"].some(
      (n) => pkg.name.includes(n)
    );
    const color = isNative ? colors.yellow : colors.reset;
    console.log(
      `${String(index + 1).padStart(2)}. ${pkg.name.padEnd(
        40
      )} ${color}${formatSize(pkg.size).padStart(10)}${colors.reset}`
    );
  });

  const totalSize = packages.reduce((sum, pkg) => sum + pkg.size, 0);
  console.log("─".repeat(60));
  console.log(
    `${colors.bright}Total node_modules size: ${formatSize(totalSize)}${
      colors.reset
    }\n`
  );

  // Check native modules specifically
  const nativeModules = [
    "better-sqlite3",
    "node-hid",
    "usb",
    "serialport",
    "@serialport",
  ];
  console.log(`${colors.bright}Native Modules Analysis:${colors.reset}`);
  console.log("─".repeat(60));
  let nativeTotal = 0;
  nativeModules.forEach((name) => {
    const pkg = packages.find((p) => p.name.includes(name));
    if (pkg) {
      nativeTotal += pkg.size;
      console.log(`${name.padEnd(30)} ${formatSize(pkg.size).padStart(10)}`);
    }
  });
  console.log("─".repeat(60));
  console.log(
    `${colors.bright}Native modules total: ${formatSize(nativeTotal)}${
      colors.reset
    }`
  );
  console.log(
    `${colors.yellow}⚠️  Target: ~9MB (currently ${formatSize(nativeTotal)})${
      colors.reset
    }\n`
  );
}

function analyzeBuiltApp() {
  console.log(
    `\n${colors.cyan}${colors.bright}📱 Analyzing Built App (if available)...${colors.reset}\n`
  );

  // Check for macOS build
  const macAppPath = join(rootDir, "dist", "mac", "aurswift.app");
  const winAppPath = join(rootDir, "dist", "win-unpacked", "aurswift.exe");

  if (existsSync(macAppPath)) {
    analyzeMacApp(macAppPath);
  } else if (existsSync(winAppPath)) {
    analyzeWinApp(join(rootDir, "dist", "win-unpacked"));
  } else {
    console.log(
      `${colors.yellow}⚠️  Built app not found. Run 'npm run compile' first.${colors.reset}`
    );
    console.log(`   Looking for: ${macAppPath} or ${winAppPath}\n`);
  }
}

function analyzeMacApp(appPath) {
  const resourcesPath = join(appPath, "Contents", "Resources");
  if (!existsSync(resourcesPath)) {
    console.log(
      `${colors.yellow}⚠️  Resources directory not found${colors.reset}`
    );
    return;
  }

  console.log(`${colors.bright}App Bundle Breakdown:${colors.reset}`);
  console.log("─".repeat(60));

  // Check app.asar
  const asarPath = join(resourcesPath, "app.asar");
  if (existsSync(asarPath)) {
    const asarSize = statSync(asarPath).size;
    console.log(
      `app.asar${" ".repeat(40)} ${formatSize(asarSize).padStart(10)}`
    );
  }

  // Check app.asar.unpacked
  const unpackedPath = join(resourcesPath, "app.asar.unpacked");
  if (existsSync(unpackedPath)) {
    const unpackedSize = getDirSize(unpackedPath);
    console.log(
      `app.asar.unpacked${" ".repeat(35)} ${formatSize(unpackedSize).padStart(
        10
      )}`
    );

    // Check native modules in unpacked
    const nodeModulesPath = join(unpackedPath, "node_modules");
    if (existsSync(nodeModulesPath)) {
      console.log(
        `\n${colors.bright}Native Modules in app.asar.unpacked:${colors.reset}`
      );
      console.log("─".repeat(60));

      const nativeModules = ["better-sqlite3", "node-hid", "usb", "serialport"];
      nativeModules.forEach((name) => {
        const pkgPath = join(nodeModulesPath, name);
        if (existsSync(pkgPath)) {
          const size = getDirSize(pkgPath);
          const targetSize =
            name === "better-sqlite3" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
          const status =
            size > targetSize * 1.5
              ? colors.red
              : size > targetSize
              ? colors.yellow
              : colors.green;
          console.log(
            `${name.padEnd(30)} ${status}${formatSize(size).padStart(10)}${
              colors.reset
            }`
          );

          // Check for source files
          try {
            const findCmd = `find "${pkgPath}" -name "*.c" -o -name "*.h" 2>/dev/null | head -5`;
            const sourceFiles = execSync(findCmd, {
              encoding: "utf-8",
              maxBuffer: 10 * 1024 * 1024,
            }).trim();
            if (sourceFiles) {
              console.log(
                `${" ".repeat(2)}${colors.red}⚠️  Source files found (.c/.h)${
                  colors.reset
                }`
              );
            }
          } catch (err) {
            // find command might not work on all systems
          }
        }
      });
    }
  }

  // Check other resources
  const migrationsPath = join(resourcesPath, "migrations");
  if (existsSync(migrationsPath)) {
    const migrationsSize = getDirSize(migrationsPath);
    console.log(
      `migrations${" ".repeat(45)} ${formatSize(migrationsSize).padStart(10)}`
    );
  }

  const iconPath = join(resourcesPath, "icon.icns");
  if (existsSync(iconPath)) {
    const iconSize = statSync(iconPath).size;
    console.log(
      `icon.icns${" ".repeat(43)} ${formatSize(iconSize).padStart(10)}`
    );
  }

  // Total app size
  const totalAppSize = getDirSize(appPath);
  console.log("─".repeat(60));
  console.log(
    `${colors.bright}Total App Bundle: ${formatSize(totalAppSize)}${
      colors.reset
    }`
  );
  console.log(
    `${colors.yellow}Target: ~320MB (currently ${formatSize(totalAppSize)})${
      colors.reset
    }\n`
  );
}

function analyzeWinApp(appPath) {
  const resourcesPath = join(appPath, "resources");
  if (!existsSync(resourcesPath)) {
    console.log(
      `${colors.yellow}⚠️  Resources directory not found${colors.reset}`
    );
    return;
  }

  console.log(`${colors.bright}App Bundle Breakdown:${colors.reset}`);
  console.log("─".repeat(60));

  // Check app.asar
  const asarPath = join(resourcesPath, "app.asar");
  if (existsSync(asarPath)) {
    const asarSize = statSync(asarPath).size;
    console.log(
      `app.asar${" ".repeat(40)} ${formatSize(asarSize).padStart(10)}`
    );
  }

  // Check app.asar.unpacked
  const unpackedPath = join(resourcesPath, "app.asar.unpacked");
  if (existsSync(unpackedPath)) {
    const unpackedSize = getDirSize(unpackedPath);
    console.log(
      `app.asar.unpacked${" ".repeat(35)} ${formatSize(unpackedSize).padStart(
        10
      )}`
    );

    // Check native modules
    const nodeModulesPath = join(unpackedPath, "node_modules");
    if (existsSync(nodeModulesPath)) {
      console.log(
        `\n${colors.bright}Native Modules in app.asar.unpacked:${colors.reset}`
      );
      console.log("─".repeat(60));

      const nativeModules = ["better-sqlite3", "node-hid", "usb", "serialport"];
      nativeModules.forEach((name) => {
        const pkgPath = join(nodeModulesPath, name);
        if (existsSync(pkgPath)) {
          const size = getDirSize(pkgPath);
          console.log(`${name.padEnd(30)} ${formatSize(size).padStart(10)}`);
        }
      });
    }
  }

  // Total app size
  const totalAppSize = getDirSize(appPath);
  console.log("─".repeat(60));
  console.log(
    `${colors.bright}Total App Size: ${formatSize(totalAppSize)}${
      colors.reset
    }\n`
  );
}

function checkDependencies() {
  console.log(
    `\n${colors.cyan}${colors.bright}🔍 Checking Dependencies...${colors.reset}\n`
  );

  try {
    // Check for duplicate dependencies
    console.log(
      `${colors.bright}Checking for duplicate dependencies...${colors.reset}`
    );
    const npmLsOutput = execSync("npm ls --depth=0", {
      encoding: "utf-8",
      cwd: rootDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Count dependencies
    const lines = npmLsOutput
      .split("\n")
      .filter((line) => line.includes("├──") || line.includes("└──"));
    console.log(`Total direct dependencies: ${lines.length}`);

    // Check for warnings (duplicates)
    if (npmLsOutput.includes("UNMET") || npmLsOutput.includes("extraneous")) {
      console.log(
        `${colors.yellow}⚠️  Some dependency issues found. Check output above.${colors.reset}`
      );
    } else {
      console.log(
        `${colors.green}✓ No obvious dependency issues${colors.reset}`
      );
    }
  } catch (err) {
    // npm ls might fail with warnings, that's okay
    console.log(
      `${colors.yellow}⚠️  Could not check dependencies (this is usually okay)${colors.reset}`
    );
  }
}

// Main execution
console.log(`${colors.bright}${colors.blue}`);
console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║     aurswift Package Size Analysis Tool                   ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log(colors.reset);

analyzeNodeModules();
checkDependencies();
analyzeBuiltApp();

console.log(`${colors.cyan}${colors.bright}💡 Tips:${colors.reset}`);
console.log(
  `   • Run 'ANALYZE=true npm run build' in packages/renderer for bundle analysis`
);
console.log(`   • Check electron-builder.mjs for exclusion rules`);
console.log(
  `   • See docs/ProductionAppSize/PACKAGE_SIZE_ANALYSIS_GUIDE.md for details\n`
);
