# Package Size Analysis - Quick Reference

## 🚀 Quick Commands

### Analyze Package Sizes

```bash
# Run comprehensive package analysis
npm run analyze:packages

# Analyze renderer bundle (frontend)
npm run analyze:bundle
# Then open: packages/renderer/dist/stats.html
```

### Check Sizes Manually

```bash
# Check node_modules sizes
du -sh node_modules/* | sort -hr | head -20

# Check built app (macOS)
du -sh dist/mac/AuraSwift.app/Contents/Resources/*

# Check native modules in unpacked
du -sh dist/mac/AuraSwift.app/Contents/Resources/app.asar.unpacked/node_modules/* | sort -hr
```

---

## 📊 Key Metrics

| Component             | Current | Target | Command to Check                                                     |
| --------------------- | ------- | ------ | -------------------------------------------------------------------- |
| **Total DMG**         | 464MB   | ~330MB | `du -sh dist/*.dmg`                                                  |
| **App Bundle**        | 358MB   | ~320MB | `du -sh dist/mac/AuraSwift.app`                                      |
| **app.asar**          | 63MB    | ~60MB  | `du -sh dist/mac/AuraSwift.app/Contents/Resources/app.asar`          |
| **app.asar.unpacked** | 33MB    | ~10MB  | `du -sh dist/mac/AuraSwift.app/Contents/Resources/app.asar.unpacked` |
| **Native Modules**    | 33MB    | ~9MB   | See unpacked breakdown                                               |

---

## 🔍 What to Check

### 1. **Native Modules** (Biggest Issue)

- **Location**: `app.asar.unpacked/node_modules/`
- **Check for**:
  - Source files (`.c`, `.h`) - Should NOT be present
  - Multi-platform binaries - Only current platform should be present
  - Build artifacts (`build/`, `obj/`) - Should NOT be present

### 2. **Renderer Bundle**

- **Location**: `packages/renderer/dist/stats.html` (after `npm run analyze:bundle`)
- **Check for**:
  - Large chunks (>500KB)
  - Unused Radix UI components
  - Duplicate dependencies

### 3. **Dependencies**

- **Check**: `npm run analyze:packages`
- **Look for**:
  - Large packages (>10MB)
  - Duplicate dependencies
  - Unused packages

---

## 🎯 Common Issues & Solutions

### Issue: Native modules too large (>15MB)

**Solution**: Check `electron-builder.mjs` exclusions are working:

```bash
# Verify source files are excluded
find dist/mac/AuraSwift.app/Contents/Resources/app.asar.unpacked -name "*.c" -o -name "*.h"
# Should return nothing
```

### Issue: Multi-platform binaries included

**Solution**: Verify platform-specific exclusions in `electron-builder.mjs`:

- macOS build should only have `darwin-*` binaries
- Windows build should only have `win32-x64` binaries

### Issue: Renderer bundle too large

**Solution**:

1. Run `npm run analyze:bundle`
2. Check `stats.html` for large packages
3. Remove unused dependencies
4. Enable tree-shaking (already enabled)

---

## 📚 Full Documentation

- [Complete Guide](./PACKAGE_SIZE_ANALYSIS_GUIDE.md) - Detailed analysis methods
- [Size Analysis](./464MB_SIZE_ANALYSIS.md) - Current size breakdown
- [Optimization Plan](./LOGGING_CLEANUP_STRATEGIC_PLAN.md) - Additional optimizations

---

_Quick Reference - Last Updated: 2025-01-27_
