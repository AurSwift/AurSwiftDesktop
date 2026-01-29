# 🚀 Toast-Based Updates - Quick Start Guide

## Overview

Replace traditional Electron dialogs with modern toast notifications for a Cursor IDE-like update experience.

## Key Changes Summary

### Before (Current)

```typescript
// Dialog-based (blocking)
dialog.showMessageBox({
  title: "Update Available",
  message: "New version available",
  buttons: ["Download", "Later"],
});
```

### After (Target)

```typescript
// Toast-based (non-blocking)
toast.custom(<UpdateAvailableToast />, {
  duration: Infinity,
  position: "top-right",
});
```

## Architecture Quick Reference

```
Main Process (AutoUpdater.ts)
    ↓ webContents.send('update:available')
Preload (updateAPI)
    ↓ contextBridge
Renderer (React)
    ↓ UpdateToastContext
    ↓ useUpdateToast()
    ↓ Sonner Toast
```

## Implementation Order

1. **Week 1**: IPC Setup + Preload API
2. **Week 2**: React Context + Toast Components
3. **Week 3**: Integration + Refactoring
4. **Week 4**: Testing + Polish

## File Structure

```
packages/
├── main/
│   └── src/modules/AutoUpdater.ts (modify)
├── preload/
│   └── src/api/updates.ts (new)
└── renderer/
    └── src/features/updates/
        ├── context/
        │   └── UpdateToastContext.tsx (new)
        ├── hooks/
        │   ├── useUpdateToast.ts (new)
        │   ├── useUpdateState.ts (new)
        │   └── useUpdateActions.ts (new)
        └── components/
            ├── UpdateAvailableToast.tsx (new)
            ├── DownloadProgressToast.tsx (new)
            ├── UpdateReadyToast.tsx (new)
            └── UpdateErrorToast.tsx (new)
```

## Critical Implementation Points

### 1. IPC Events (Main → Renderer)

```typescript
// AutoUpdater.ts
webContents.send("update:available", updateInfo);
webContents.send("update:download-progress", progress);
webContents.send("update:downloaded", info);
webContents.send("update:error", error);
```

### 2. Preload API

```typescript
// preload/src/api/updates.ts
contextBridge.exposeInMainWorld("updateAPI", {
  onUpdateAvailable: (callback) => {
    /* ... */
  },
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
});
```

### 3. React Context

```typescript
// UpdateToastContext.tsx
const UpdateToastProvider = ({ children }) => {
  const [state, setState] = useState<UpdateState>("idle");

  useEffect(() => {
    window.updateAPI.onUpdateAvailable((info) => {
      setState("available");
      setUpdateInfo(info);
      showUpdateAvailableToast();
    });
  }, []);

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
```

### 4. Toast Components

```typescript
// UpdateAvailableToast.tsx
export const UpdateAvailableToast = ({ updateInfo, onDownload, onPostpone }) => {
  return (
    <div className="update-toast">
      <h3>🎁 New update available</h3>
      <p>AuraSwift {updateInfo.version} is now available</p>
      <div className="actions">
        <Button onClick={onDownload}>Download Now</Button>
        <Button onClick={onPostpone}>Later</Button>
      </div>
    </div>
  );
};

// UpdateReadyToast.tsx - Cursor-style installation
export const UpdateReadyToast = ({ updateInfo, onInstall, onPostpone }) => {
  return (
    <div className="update-ready-toast">
      <h3>✅ Update ready to install</h3>
      <p>AuraSwift {updateInfo.version} has been downloaded</p>
      <p className="hint">App will close, install silently, and reopen automatically</p>
      <div className="actions">
        <Button onClick={onInstall}>Install Now</Button>
        <Button onClick={onPostpone}>Later</Button>
      </div>
    </div>
  );
};
```

### 5. Cursor-Style Installation

```typescript
// AutoUpdater.ts - IPC Handler
ipcMain.handle("update:install", async () => {
  const updater = this.getAutoUpdater();

  // Cursor-style: Immediate quit with silent install
  // quitAndInstall(isSilent, isForceRunAfter)
  updater.quitAndInstall(true, true);

  // App quits immediately, installs silently, auto-restarts
});

// UpdateToastContext.tsx
const handleInstallUpdate = async () => {
  await window.updateAPI.installUpdate();
  // App will quit immediately - no return
};
```

## Migration Strategy

### Phase 1: Parallel (Safe)

- Keep dialogs working
- Add toast system
- Feature flag to switch

### Phase 2: Gradual

- Enable for new installs
- Monitor feedback
- Keep dialogs as fallback

### Phase 3: Complete

- Remove dialog code
- Toast-only system
- Clean up

## Testing Checklist

- [ ] Toast appears on update available
- [ ] Download progress updates correctly
- [ ] Install button works
- [ ] Postpone functionality works
- [ ] Error handling works
- [ ] Keyboard shortcuts work
- [ ] Accessibility (screen reader)
- [ ] No memory leaks
- [ ] IPC cleanup on unmount

## Common Pitfalls to Avoid

❌ **Don't** remove dialog system immediately  
❌ **Don't** forget to clean up event listeners  
❌ **Don't** block UI thread with heavy operations  
❌ **Don't** forget error boundaries  
❌ **Don't** skip accessibility features

✅ **Do** use feature flags for gradual rollout  
✅ **Do** implement proper cleanup  
✅ **Do** test all error scenarios  
✅ **Do** add keyboard shortcuts  
✅ **Do** monitor performance

## Quick Wins

1. **Start with IPC**: Get communication working first
2. **Simple Toast First**: Basic "Update Available" toast
3. **Progressive Enhancement**: Add features incrementally
4. **Test Early**: Test each phase before moving on

## Cursor-Style Installation

**Key Behavior**: Click "Install Now" → App closes → Silent install → Auto-reopens

**Implementation**:

```typescript
// Use quitAndInstall(true, true)
// - First true = silent (no installer UI)
// - Second true = auto-restart after install
updater.quitAndInstall(true, true);
```

**See**: `CURSOR_STYLE_INSTALLATION.md` for complete guide

## Resources

- Full Plan: `TOAST_BASED_UPDATE_IMPLEMENTATION_PLAN.md`
- Cursor-Style Guide: `CURSOR_STYLE_INSTALLATION.md`
- Sonner Docs: https://sonner.emilkowal.ski/
- Electron IPC: https://www.electronjs.org/docs/latest/tutorial/ipc

---

**Ready to start?** Begin with Phase 1: IPC Setup!
