# 🎯 Toast-Based Update Notification Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to replace traditional Electron dialog-based update notifications with modern, non-intrusive toast notifications similar to Cursor IDE. The implementation will maintain all existing functionality while providing a superior user experience.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Implementation Phases](#implementation-phases)
4. [Technical Specifications](#technical-specifications)
5. [Component Design](#component-design)
6. [IPC Communication Flow](#ipc-communication-flow)
7. [State Management](#state-management)
8. [User Experience Flow](#user-experience-flow)
9. [Testing Strategy](#testing-strategy)
10. [Migration Path](#migration-path)
11. [Best Practices & Considerations](#best-practices--considerations)

---

## 🎯 Overview

### Current State
- Uses Electron's native `dialog.showMessageBox()` for all update notifications
- Blocks user interaction during update dialogs
- Shows release notes in dialog format
- Traditional, intrusive user experience

### Target State
- Non-intrusive toast notifications (similar to Cursor IDE)
- Progressive disclosure of information
- Smooth animations and transitions
- Non-blocking user experience
- Rich, interactive toast components

### Key Benefits
✅ **Non-blocking**: Users can continue working while updates are available  
✅ **Modern UX**: Aligns with contemporary application design patterns  
✅ **Progressive Disclosure**: Show essential info first, details on demand  
✅ **Better Engagement**: Less intrusive = higher user satisfaction  
✅ **Consistent Design**: Matches existing Sonner toast system  

---

## 🏗️ Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Main Process (AutoUpdater.ts)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Update Events:                                          │  │
│  │  • update-available                                      │  │
│  │  • download-progress                                     │  │
│  │  • update-downloaded                                    │  │
│  │  • error                                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         │ webContents.send()                     │
│                         ▼                                        │
┌─────────────────────────────────────────────────────────────────┐
│                  Preload (contextBridge)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  updateAPI: {                                            │  │
│  │    onUpdateAvailable(callback)                           │  │
│  │    onDownloadProgress(callback)                          │  │
│  │    onUpdateDownloaded(callback)                          │  │
│  │    onUpdateError(callback)                               │  │
│  │    downloadUpdate()                                      │  │
│  │    installUpdate()                                       │  │
│  │    postponeUpdate()                                      │  │
│  │  }                                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ React Context/Hooks
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Renderer Process (React Components)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UpdateToastProvider (Context)                          │  │
│  │  └─> useUpdateToast() Hook                              │  │
│  │      └─> UpdateToast Components                         │  │
│  │          • UpdateAvailableToast                          │  │
│  │          • DownloadProgressToast                         │  │
│  │          • UpdateReadyToast                              │  │
│  │          • UpdateErrorToast                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│              Sonner Toast System (Already Installed)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Implementation Phases

### Phase 1: Foundation & IPC Setup (Week 1)
**Goal**: Establish communication layer between main and renderer

#### Tasks:
1. **Create IPC Event System**
   - Add `ipcMain.on()` handlers in AutoUpdater for update events
   - Broadcast events to all windows using `webContents.send()`
   - Ensure proper cleanup on window close

2. **Extend Preload API**
   - Add `updateAPI` to preload contextBridge
   - Implement event listeners (`onUpdateAvailable`, `onDownloadProgress`, etc.)
   - Add action methods (`downloadUpdate`, `installUpdate`, `postponeUpdate`)

3. **Type Definitions**
   - Create TypeScript types for update events
   - Define update state interfaces
   - Export types for renderer consumption

**Deliverables**:
- `packages/preload/src/api/updates.ts`
- `packages/preload/src/types/updates.d.ts`
- Modified `packages/main/src/modules/AutoUpdater.ts` (event broadcasting)

---

### Phase 2: React Context & Hooks (Week 1-2)
**Goal**: Create React infrastructure for update management

#### Tasks:
1. **Update Context Provider**
   - Create `UpdateToastProvider` component
   - Manage update state (available, downloading, ready, error)
   - Handle IPC event subscriptions

2. **Custom Hooks**
   - `useUpdateToast()` - Main hook for update operations
   - `useUpdateState()` - State management hook
   - `useUpdateActions()` - Action handlers hook

3. **State Management**
   - Track current update version
   - Track download progress
   - Track error states
   - Manage postpone count

**Deliverables**:
- `packages/renderer/src/features/updates/context/UpdateToastContext.tsx`
- `packages/renderer/src/features/updates/hooks/useUpdateToast.ts`
- `packages/renderer/src/features/updates/hooks/useUpdateState.ts`
- `packages/renderer/src/features/updates/hooks/useUpdateActions.ts`

---

### Phase 3: Toast Components (Week 2)
**Goal**: Build beautiful, interactive toast components

#### Tasks:
1. **Base Update Toast Component**
   - Reusable base component with consistent styling
   - Animation support (slide-in, fade)
   - Action buttons
   - Dismiss functionality

2. **Specific Toast Components**
   - `UpdateAvailableToast` - New update notification
   - `DownloadProgressToast` - Progress indicator with percentage
   - `UpdateReadyToast` - Installation prompt
   - `UpdateErrorToast` - Error display with retry option

3. **Toast Features**
   - Auto-dismiss with configurable duration
   - Manual dismiss button
   - Action buttons (Download, Install, Later, Retry)
   - Expandable release notes section
   - Progress bar for downloads

**Deliverables**:
- `packages/renderer/src/features/updates/components/UpdateAvailableToast.tsx`
- `packages/renderer/src/features/updates/components/DownloadProgressToast.tsx`
- `packages/renderer/src/features/updates/components/UpdateReadyToast.tsx`
- `packages/renderer/src/features/updates/components/UpdateErrorToast.tsx`
- `packages/renderer/src/features/updates/components/BaseUpdateToast.tsx`

---

### Phase 4: Integration & Refactoring (Week 2-3)
**Goal**: Integrate toast system and refactor AutoUpdater

#### Tasks:
1. **Modify AutoUpdater.ts**
   - Remove `dialog.showMessageBox()` calls
   - Replace with `webContents.send()` event broadcasts
   - **Implement Cursor-style installation**:
     - `installUpdate()` handler calls `quitAndInstall(true, true)`
     - First `true` = silent installation (no installer UI)
     - Second `true` = auto-restart app after install
     - No dialogs during installation process
     - Remove dialog from `onUpdateDownloaded` event
     - Send `update:downloaded` event to renderer instead
   - **Handle app lifecycle**:
     - Ensure proper cleanup before quit
     - Save any pending data
     - Close database connections gracefully
   - Keep fallback dialogs for critical errors only
   - Maintain backward compatibility during transition

2. **Update WindowManager.ts**
   - Modify "Check for Updates" menu item to use toast system
   - Update "View Update Error" to show toast instead of dialog

3. **Provider Integration**
   - Add `UpdateToastProvider` to app root
   - Ensure proper initialization order
   - Handle window focus/blur events
   - **Handle app quit events**:
     - Listen for `before-quit` to save state
     - Show "Installing update..." toast before quit (optional)

**Deliverables**:
- Refactored `packages/main/src/modules/AutoUpdater.ts`
- Modified `packages/main/src/modules/WindowManager.ts`
- Updated `packages/renderer/src/app/App.tsx` or root component

---

### Phase 5: Polish & Enhancement (Week 3)
**Goal**: Add advanced features and polish

#### Tasks:
1. **Advanced Features**
   - Expandable release notes in toast
   - Keyboard shortcuts (Enter to install, Esc to dismiss)
   - Sound notifications (optional, configurable)
   - Update badge indicator in menu

2. **Animations & Transitions**
   - Smooth slide-in animations
   - Progress bar animations
   - State transition animations
   - Dismiss animations

3. **Accessibility**
   - ARIA labels
   - Keyboard navigation
   - Screen reader support
   - Focus management

**Deliverables**:
- Enhanced toast components with animations
- Accessibility improvements
- Keyboard shortcut support

---

### Phase 6: Testing & Documentation (Week 3-4)
**Goal**: Comprehensive testing and documentation

#### Tasks:
1. **Unit Tests**
   - Test update context hooks
   - Test toast components
   - Test IPC communication

2. **Integration Tests**
   - Test full update flow
   - Test error scenarios
   - Test postpone functionality

3. **E2E Tests**
   - Test update notification display
   - Test user interactions
   - Test update installation

4. **Documentation**
   - Update developer docs
   - Create user guide
   - Document API changes

**Deliverables**:
- Test suite
- Updated documentation
- Migration guide

---

## 🔧 Technical Specifications

### IPC Event Channels

```typescript
// Main → Renderer Events
'update:available'      // New update found
'update:download-progress'  // Download progress update
'update:downloaded'      // Download complete
'update:error'           // Error occurred
'update:check-complete'  // Manual check complete

// Renderer → Main Actions
'update:download'        // Start download
'update:install'         // Install and restart (Cursor-style: immediate quit + silent install)
'update:postpone'        // Postpone update
'update:check'           // Manual check
'update:dismiss'         // Dismiss notification
```

### Type Definitions

```typescript
// packages/shared/types/updates.ts

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  files: Array<{
    url: string;
    sha512: string;
    size: number;
  }>;
}

export interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export type UpdateState = 
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'installing';

export interface UpdateError {
  message: string;
  type: 'check' | 'download' | 'install';
  timestamp: Date;
}

export interface UpdateContextValue {
  state: UpdateState;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress | null;
  error: UpdateError | null;
  currentVersion: string;
  postponeCount: number;
  
  // Actions
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  postponeUpdate: () => void;
  checkForUpdates: () => Promise<void>;
  dismissError: () => void;
}
```

---

## 🎨 Component Design

### UpdateAvailableToast

```tsx
┌─────────────────────────────────────────────────────┐
│ 🎁 New update available                              │
│                                                       │
│ AuraSwift v2.1.0 is now available                    │
│ You're currently on v2.0.5                           │
│                                                       │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│ │ Download Now │  │  View Notes  │  │  Later   │  │
│ └──────────────┘  └──────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────┘
```

**Features**:
- Version comparison display
- Three action buttons
- Expandable release notes (collapsed by default)
- Auto-dismiss after 30 seconds (optional)

### DownloadProgressToast

```tsx
┌─────────────────────────────────────────────────────┐
│ ⬇️ Downloading update...                            │
│                                                       │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░ 45%                     │
│                                                       │
│ 45.2 MB / 100.5 MB  •  2.3 MB/s  •  ~24s remaining │
│                                                       │
│ ┌──────────────┐                                    │
│ │   Cancel     │                                    │
│ └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

**Features**:
- Real-time progress bar
- Download speed
- Time remaining estimate
- Cancel option
- Non-dismissible during download

### UpdateReadyToast

```tsx
┌─────────────────────────────────────────────────────┐
│ ✅ Update ready to install                           │
│                                                       │
│ AuraSwift v2.1.0 has been downloaded                 │
│                                                       │
│ The app will close, install in the background,      │
│ and reopen automatically                             │
│                                                       │
│ ┌──────────────┐  ┌──────────────┐                  │
│ │ Install Now  │  │  Later       │                  │
│ └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────┘
```

**Features**:
- Clear call-to-action
- "Install Now" immediately quits app and installs silently
- "Later" postpones installation
- Persistent until action taken
- Shows version number
- **Cursor-style behavior**: App closes → Silent install → Auto-reopens

### UpdateErrorToast

```tsx
┌─────────────────────────────────────────────────────┐
│ ⚠️ Update failed                                     │
│                                                       │
│ Failed to download update: Network error             │
│                                                       │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│ │   Retry      │  │ View Details │  │  Dismiss │  │
│ └──────────────┘  └──────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────┘
```

**Features**:
- Error message display
- Retry functionality
- Expandable error details
- Dismiss option

---

## 🔄 IPC Communication Flow

### Update Available Flow

```
1. AutoUpdater detects new version
   ↓
2. AutoUpdater.ts: webContents.send('update:available', updateInfo)
   ↓
3. Preload: ipcRenderer.on('update:available', callback)
   ↓
4. Preload: Calls registered callback from renderer
   ↓
5. UpdateToastContext: Receives event, updates state
   ↓
6. useUpdateToast hook: Triggers toast display
   ↓
7. UpdateAvailableToast: Renders toast notification
```

### Download Progress Flow

```
1. AutoUpdater receives download-progress event
   ↓
2. AutoUpdater.ts: webContents.send('update:download-progress', progress)
   ↓
3. UpdateToastContext: Updates progress state
   ↓
4. DownloadProgressToast: Re-renders with new progress
```

### User Action Flow (Download)

```
1. User clicks "Download Now" in toast
   ↓
2. UpdateAvailableToast: Calls downloadUpdate()
   ↓
3. useUpdateActions: Calls updateAPI.downloadUpdate()
   ↓
4. Preload: ipcRenderer.invoke('update:download')
   ↓
5. AutoUpdater.ts: ipcMain.handle('update:download')
   ↓
6. AutoUpdater: Starts download via electron-updater
   ↓
7. Progress events sent back via webContents.send()
```

### User Action Flow (Install - Cursor Style)

```
1. User clicks "Install Now" in UpdateReadyToast
   ↓
2. UpdateReadyToast: Calls installUpdate()
   ↓
3. useUpdateActions: Calls updateAPI.installUpdate()
   ↓
4. Preload: ipcRenderer.invoke('update:install')
   ↓
5. AutoUpdater.ts: ipcMain.handle('update:install')
   ↓
6. AutoUpdater: Calls updater.quitAndInstall(true, true)
   - First true = isSilent (no installer UI)
   - Second true = isForceRunAfter (auto-restart app)
   ↓
7. App quits immediately (no dialog)
   ↓
8. Squirrel/NSIS installer runs silently in background
   ↓
9. Installation completes
   ↓
10. App automatically reopens with new version
```

---

## 📊 State Management

### Update State Machine

```
┌─────────┐
│  idle   │
└────┬────┘
     │ checkForUpdates()
     ▼
┌─────────────┐
│  checking   │
└────┬────────┘
     │ update available
     ▼
┌──────────────┐
│  available   │◄──┐
└────┬─────────┘   │ postponeUpdate()
     │ downloadUpdate() │
     ▼                │
┌──────────────┐     │
│ downloading  │     │
└────┬─────────┘     │
     │ complete      │
     ▼                │
┌──────────────┐     │
│  downloaded  │     │
└────┬─────────┘     │
     │ installUpdate()│
     ▼                │
┌──────────────┐     │
│  installing  │      │
└──────────────┘      │
                      │
     ┌────────────────┘
     │
     ▼
┌─────────┐
│  idle   │
└─────────┘
```

### Context State Structure

```typescript
interface UpdateState {
  // Current state
  state: UpdateState;
  
  // Update information
  updateInfo: UpdateInfo | null;
  currentVersion: string;
  
  // Download progress
  progress: DownloadProgress | null;
  
  // Error handling
  error: UpdateError | null;
  
  // Postpone tracking
  postponeCount: number;
  lastPostponeTime: number | null;
  
  // Toast management
  activeToastId: string | null;
  dismissedToasts: Set<string>;
}
```

---

## 🎭 User Experience Flow

### Scenario 1: Automatic Update Check (Cursor-Style)

```
1. App starts → AutoUpdater checks for updates (5s delay)
   ↓
2. Update found → Toast slides in from top-right
   ↓
3. User sees: "New update available" toast
   ↓
4. User options:
   a) Click "Download Now" → Download starts, progress toast shows
   b) Click "View Notes" → Toast expands to show release notes
   c) Click "Later" → Toast dismisses, reminder scheduled
   d) Ignore → Toast auto-dismisses after 30s, reminder scheduled
   ↓
5. If downloaded → "Update ready" toast appears
   ↓
6. User clicks "Install Now" → 
   - App closes immediately (no dialog)
   - Silent installation in background
   - App automatically reopens with new version
   - User continues working seamlessly
```

### Scenario 2: Manual Update Check

```
1. User clicks Help → "Check for Updates..."
   ↓
2. Loading toast: "Checking for updates..."
   ↓
3. Result:
   a) Update available → UpdateAvailableToast
   b) Up to date → Success toast: "You're up to date! ✅"
   c) Error → UpdateErrorToast with retry option
```

### Scenario 3: Download in Progress

```
1. Download starts → DownloadProgressToast appears
   ↓
2. Progress updates in real-time (every 100ms)
   ↓
3. User can:
   a) Continue working (non-blocking)
   b) Cancel download (if needed)
   ↓
4. Download completes → Toast transitions to UpdateReadyToast
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// UpdateToastContext.test.tsx
- Test state transitions
- Test event handling
- Test action methods
- Test error handling

// UpdateToast Components
- Test rendering
- Test user interactions
- Test animations
- Test accessibility
```

### Integration Tests

```typescript
// IPC Communication
- Test event broadcasting
- Test action invocations
- Test error propagation

// Full Update Flow
- Test complete update cycle
- Test error recovery
- Test postpone functionality
```

### E2E Tests

```typescript
// Playwright Tests
- Test toast appearance
- Test user interactions
- Test update installation
- Test error scenarios
```

---

## 🚀 Migration Path

### Phase 1: Parallel Implementation
- Keep existing dialog system
- Add toast system alongside
- Feature flag to switch between them

### Phase 2: Gradual Rollout
- Enable toast system for new users
- Keep dialog for existing users
- Monitor feedback

### Phase 3: Full Migration
- Remove dialog system
- Clean up old code
- Update documentation

### Rollback Plan
- Feature flag to revert to dialogs
- Keep dialog code for 1-2 releases
- Monitor error rates

---

## ✅ Best Practices & Considerations

### Performance
- ✅ Debounce progress updates (max 10 updates/second)
- ✅ Lazy load release notes (only when expanded)
- ✅ Clean up event listeners on unmount
- ✅ Use React.memo for toast components

### User Experience
- ✅ Non-blocking notifications
- ✅ Clear call-to-actions
- ✅ Progress feedback during downloads
- ✅ Graceful error handling
- ✅ Keyboard shortcuts support

### Accessibility
- ✅ ARIA labels for all interactive elements
- ✅ Keyboard navigation support
- ✅ Screen reader announcements
- ✅ Focus management

### Security
- ✅ Validate all IPC messages
- ✅ Sanitize release notes (prevent XSS)
- ✅ Verify update signatures
- ✅ Secure update download URLs

### Error Handling
- ✅ Graceful degradation (fallback to dialog if toast fails)
- ✅ Retry mechanisms
- ✅ Clear error messages
- ✅ Error logging

### Code Quality
- ✅ TypeScript strict mode
- ✅ Comprehensive error handling
- ✅ Proper cleanup on unmount
- ✅ Unit test coverage >80%
- ✅ Documentation for all public APIs

### Installation Behavior (Cursor-Style)
- ✅ **Immediate quit**: App closes instantly when "Install Now" clicked
- ✅ **Silent installation**: No installer UI shown (`quitAndInstall(true, true)`)
- ✅ **Auto-restart**: App automatically reopens after installation
- ✅ **No dialogs**: Zero blocking dialogs during update process
- ✅ **Graceful shutdown**: Save state, close connections before quit
- ✅ **Seamless UX**: User continues working after app reopens

---

## 📝 Implementation Checklist

### Phase 1: Foundation
- [ ] Create IPC event system in AutoUpdater
- [ ] Add updateAPI to preload
- [ ] Create TypeScript type definitions
- [ ] Test IPC communication

### Phase 2: React Infrastructure
- [ ] Create UpdateToastContext
- [ ] Implement useUpdateToast hook
- [ ] Implement useUpdateState hook
- [ ] Implement useUpdateActions hook
- [ ] Test context and hooks

### Phase 3: Toast Components
- [ ] Create BaseUpdateToast component
- [ ] Create UpdateAvailableToast
- [ ] Create DownloadProgressToast
- [ ] Create UpdateReadyToast
- [ ] Create UpdateErrorToast
- [ ] Add animations and transitions
- [ ] Test all components

### Phase 4: Integration
- [ ] Refactor AutoUpdater.ts
- [ ] Update WindowManager.ts
- [ ] Add UpdateToastProvider to app root
- [ ] Test full integration

### Phase 5: Polish
- [ ] Add keyboard shortcuts
- [ ] Improve animations
- [ ] Add accessibility features
- [ ] Add sound notifications (optional)

### Phase 6: Testing & Docs
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Update documentation
- [ ] Create migration guide

---

## 🎯 Success Metrics

### User Experience
- ✅ Zero blocking dialogs during updates
- ✅ <2 second toast appearance time
- ✅ 90%+ user satisfaction with new system
- ✅ <5% error rate during updates

### Technical
- ✅ 100% TypeScript coverage
- ✅ >80% test coverage
- ✅ Zero memory leaks
- ✅ <50ms IPC event latency

---

## 📚 References

- [Sonner Documentation](https://sonner.emilkowal.ski/)
- [Electron IPC Best Practices](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Cursor IDE Update UX](https://cursor.sh) (reference implementation)
- [React Context Best Practices](https://react.dev/reference/react/useContext)

---

## 🏁 Conclusion

This implementation plan provides a comprehensive roadmap for transitioning from dialog-based to toast-based update notifications. The phased approach ensures minimal disruption while delivering a superior user experience.

**Estimated Timeline**: 3-4 weeks  
**Complexity**: Medium-High  
**Risk Level**: Low (with proper testing and rollback plan)

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Author**: Senior Electron.js Developer  
**Status**: Ready for Implementation

