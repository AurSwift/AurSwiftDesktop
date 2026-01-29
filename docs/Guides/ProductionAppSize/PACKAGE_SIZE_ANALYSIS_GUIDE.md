# Package Size Analysis Guide for AuraSwift

This guide explains how to analyze package sizes and understand their impact on the AuraSwift app bundle.

---

## 📊 Quick Overview

**Current App Size**: 464MB (DMG) / 358MB (.app bundle)

**Main Contributors**:

- Electron Framework: 258MB (can't reduce)
- `app.asar`: 63MB (application code + dependencies)
- `app.asar.unpacked`: 33MB (native modules - **optimization target**)
- Other resources: ~12MB

---

## 🔍 Methods to Analyze Package Sizes

### 1. **Analyze Renderer Bundle Size** (Frontend)

The renderer uses Vite with a bundle visualizer. To analyze:

```bash
# Build with bundle analysis
cd packages/renderer
ANALYZE=true npm run build

# This generates: packages/renderer/dist/stats.html
# Open in browser to see interactive bundle breakdown
```

**What it shows**:

- Size of each JavaScript chunk
- Which packages contribute to each chunk
- Gzip and Brotli compressed sizes
- Dependency tree visualization

**Key packages to watch**:

- React and React DOM
- Radix UI components (20+ packages)
- React Router
- Other UI libraries

---

### 2. **Analyze Node Modules Size** (Before Build)

Check the size of installed packages:

```bash
# Install package-analyzer tool (one-time)
npm install -g package-analyzer

# Analyze node_modules
npx package-analyzer

# Or use du command (macOS/Linux)
du -sh node_modules/* | sort -hr | head -20
```

**What to look for**:

- Large native modules: `better-sqlite3`, `node-hid`, `usb`, `serialport`
- Duplicate dependencies
- Unused packages

---

### 3. **Analyze Built App Bundle** (After Build)

After building the app, analyze what's included:

```bash
# Build the app first
npm run compile

# On macOS, analyze the .app bundle
cd dist/mac
du -sh AuraSwift.app/Contents/Resources/*

# Check app.asar size
du -sh AuraSwift.app/Contents/Resources/app.asar

# Check unpacked native modules
du -sh AuraSwift.app/Contents/Resources/app.asar.unpacked/node_modules/* | sort -hr
```

**Key locations**:

- `app.asar` - Main application code (should be ~63MB)
- `app.asar.unpacked/node_modules/` - Native modules (should be ~10-15MB, currently 33MB)

---

### 4. **Use the Analysis Script**

We've created a script to automate package size analysis:

```bash
# Run the analysis script
npm run analyze:packages

# This will:
# 1. Analyze node_modules sizes
# 2. Check for duplicate dependencies
# 3. Identify large packages
# 4. Show native module breakdown
# 5. Generate a report
```

---

## 🎯 Understanding Package Impact

### **Native Modules** (Biggest Impact)

These are unpacked from asar and contribute most to size:

| Module           | Current Size | Issues                        | Target Size |
| ---------------- | ------------ | ----------------------------- | ----------- |
| `better-sqlite3` | 21MB         | Source files, build artifacts | ~5MB        |
| `node-hid`       | 5.4MB        | All platform binaries         | ~2MB        |
| `usb`            | 3.3MB        | All platform binaries         | ~1MB        |
| `@serialport`    | 3.2MB        | All platform binaries         | ~1MB        |
| **Total**        | **33MB**     |                               | **~9MB**    |

**Problems**:

1. Source files (`.c`, `.h`) included (saves ~19MB if removed)
2. Multi-platform binaries (saves ~10-15MB if removed)
3. Build artifacts (saves ~5-10MB if removed)

**Solution**: Already configured in `electron-builder.mjs` with exclusions, but verify they're working.

---

### **Renderer Dependencies** (Frontend Bundle)

Check the bundle visualizer output (`packages/renderer/dist/stats.html`) for:

**Large packages**:

- React ecosystem: `react`, `react-dom`, `react-router-dom`
- Radix UI: 20+ packages (check if all are used)
- UI libraries: `framer-motion`, `lucide-react`, etc.

**Optimization strategies**:

- Tree-shaking (already enabled in Vite)
- Code splitting (configured in `vite.config.ts`)
- Remove unused Radix UI components

---

### **Main Process Dependencies**

Check what's bundled in the main process:

```bash
# After build, check main process bundle
cd packages/main/dist
du -sh *
```

**Key dependencies**:

- `better-sqlite3` - Database (required)
- `node-hid`, `usb`, `serialport` - Hardware (required)
- `winston` - Logging
- `pdfkit` - PDF generation

---

## 🔧 Tools and Commands

### **1. Check Individual Package Sizes**

```bash
# Check size of a specific package
du -sh node_modules/package-name

# Check all packages sorted by size
du -sh node_modules/* | sort -hr | head -30
```

### **2. Find Duplicate Dependencies**

```bash
# Install depcheck
npm install -g depcheck

# Check for unused dependencies
depcheck

# Or use npm-check
npx npm-check
```

### **3. Analyze ASAR Contents**

```bash
# Install asar tool
npm install -g asar

# Extract and analyze
asar extract dist/mac/AuraSwift.app/Contents/Resources/app.asar ./extracted-asar
du -sh extracted-asar/**/* | sort -hr | head -20
```

### **4. Check Native Module Contents**

```bash
# After build, check what's in unpacked
cd dist/mac/AuraSwift.app/Contents/Resources/app.asar.unpacked/node_modules

# Check better-sqlite3
du -sh better-sqlite3/**/* | sort -hr

# Look for source files
find better-sqlite3 -name "*.c" -o -name "*.h" | xargs du -ch | tail -1

# Look for platform binaries
find better-sqlite3 -type d -name "prebuilds" | xargs du -sh
```

---

## 📈 Impact Analysis Workflow

### **Step 1: Before Build - Check Dependencies**

```bash
# 1. Check total node_modules size
du -sh node_modules

# 2. Find largest packages
du -sh node_modules/* | sort -hr | head -20

# 3. Check for duplicates
npm ls --depth=0
```

### **Step 2: Build and Analyze**

```bash
# 1. Build renderer with analysis
cd packages/renderer && ANALYZE=true npm run build

# 2. Build the app
npm run compile

# 3. Analyze built app
npm run analyze:packages
```

### **Step 3: Identify Issues**

1. **Check app.asar.unpacked** - Should be ~10-15MB, not 33MB
2. **Check for source files** - No `.c`, `.h` files should be present
3. **Check platform binaries** - Only macOS binaries for macOS build
4. **Check bundle sizes** - Renderer bundle should be reasonable

### **Step 4: Verify Optimizations**

After applying optimizations in `electron-builder.mjs`:

```bash
# Rebuild and verify
npm run compile

# Check sizes again
du -sh dist/mac/AuraSwift.app/Contents/Resources/app.asar.unpacked
```

---

## 🎯 Key Metrics to Track

| Metric                | Current | Target | Status |
| --------------------- | ------- | ------ | ------ |
| **Total DMG Size**    | 464MB   | ~330MB | 🔴     |
| **App Bundle**        | 358MB   | ~320MB | 🔴     |
| **app.asar**          | 63MB    | ~60MB  | 🟡     |
| **app.asar.unpacked** | 33MB    | ~10MB  | 🔴     |
| **Native Modules**    | 33MB    | ~9MB   | 🔴     |

---

## 📝 Regular Monitoring

### **After Each Dependency Update**

1. Run `npm run analyze:packages`
2. Check if new dependencies increased size
3. Review bundle visualizer output
4. Update exclusions in `electron-builder.mjs` if needed

### **Before Each Release**

1. Build production app
2. Verify sizes match targets
3. Check for new bloat
4. Update size analysis document

---

## 🚨 Red Flags

Watch out for:

1. **Native modules > 15MB** - Check for source files or multi-platform binaries
2. **app.asar > 70MB** - Check for unnecessary dependencies
3. **New large dependencies** - Review if really needed
4. **Duplicate packages** - Use `npm dedupe` or fix version conflicts

---

## 📚 Related Documentation

- [464MB Size Analysis](./464MB_SIZE_ANALYSIS.md) - Detailed breakdown
- [Logging Cleanup Strategy](./LOGGING_CLEANUP_STRATEGIC_PLAN.md) - Additional optimizations
- [electron-builder.mjs](../../electron-builder.mjs) - Build configuration with exclusions

---

_Last Updated: 2025-01-27_
