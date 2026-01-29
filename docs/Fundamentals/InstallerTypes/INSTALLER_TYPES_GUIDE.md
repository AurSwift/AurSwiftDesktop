# AuraSwift Installer Types Guide

## 📦 Understanding Different Installers

When you download AuraSwift from GitHub Releases, you'll see **3 different .exe files**. Here's what each one is for:

---

## 🎯 Quick Recommendation

**For most users:** Download `AuraSwift-X.X.X-win-x64.exe` (64-bit NSIS Installer)

---

## 📋 Detailed Comparison

### 1. **64-bit NSIS Installer** (Recommended) ⭐

**File:** `AuraSwift-X.X.X-win-x64.exe`

**Size:** ~104 MB

**Best For:**

- ✅ Windows 10/11 (64-bit)
- ✅ Modern computers (most common)
- ✅ Users who want proper installation
- ✅ Automatic updates support

**Features:**

- ✅ Installs to `C:\Program Files\AuraSwift`
- ✅ Creates Start Menu shortcut
- ✅ Creates Desktop shortcut
- ✅ Adds to Windows Apps & Features
- ✅ Clean uninstall available
- ✅ Auto-update support built-in
- ✅ Requires admin rights to install

**Installation:**

1. Double-click the `.exe` file
2. Click "Yes" when Windows asks for permission
3. Follow the installation wizard
4. Launch from Start Menu or Desktop

---

### 2. **32-bit NSIS Installer** (For Older Systems)

**File:** `AuraSwift-X.X.X-win-ia32.exe`

**Size:** ~110 MB

**Best For:**

- ✅ Windows 7/8/10 (32-bit)
- ✅ Older computers (pre-2010)
- ✅ 32-bit operating systems

**Features:**

- Same as 64-bit installer
- Compatible with older processors
- Works on both 32-bit and 64-bit Windows

**How to check if you need 32-bit:**

1. Right-click "This PC" or "My Computer"
2. Click "Properties"
3. Look for "System type"
4. If it says "32-bit" → use this installer
5. If it says "64-bit" → use the 64-bit installer

---

### 3. **Portable Version** (No Installation)

**File:** `AuraSwift-X.X.X-win-Portable-x64.exe`

**Size:** ~214 MB (larger because includes all dependencies)

**Best For:**

- ✅ Users without admin rights
- ✅ USB drive / external drive usage
- ✅ Testing without installation
- ✅ Running from network drives
- ✅ Multiple installations on same PC

**Features:**

- ❌ No installation required
- ✅ Run directly from any folder
- ✅ All data stored in app folder
- ✅ Easy to move between computers
- ⚠️ Auto-updates work differently (requires manual download)
- ❌ No Start Menu shortcut
- ❌ No Windows integration

**How to Use:**

1. Download the portable `.exe` file
2. Create a folder (e.g., `C:\PortableApps\AuraSwift`)
3. Move the `.exe` file into that folder
4. Double-click to run (no installation)
5. Create your own desktop shortcut if needed

---

## 📊 Comparison Table

| Feature               | 64-bit NSIS         | 32-bit NSIS           | Portable              |
| --------------------- | ------------------- | --------------------- | --------------------- |
| **Size**              | 104 MB              | 110 MB                | 214 MB                |
| **System**            | 64-bit Windows      | 32-bit/64-bit Windows | 64-bit Windows        |
| **Admin Rights**      | Required to install | Required to install   | Not required          |
| **Installation**      | Full installation   | Full installation     | No installation       |
| **Start Menu**        | ✅ Yes              | ✅ Yes                | ❌ No                 |
| **Desktop Shortcut**  | ✅ Yes              | ✅ Yes                | ❌ Manual             |
| **Uninstaller**       | ✅ Yes              | ✅ Yes                | ❌ Just delete folder |
| **Auto-Updates**      | ✅ Automatic        | ✅ Automatic          | ⚠️ Manual             |
| **Data Location**     | `%APPDATA%`         | `%APPDATA%`           | App folder            |
| **USB Drive Use**     | ❌ No               | ❌ No                 | ✅ Yes                |
| **Multiple Installs** | ❌ One per PC       | ❌ One per PC         | ✅ Multiple           |

---

## 🤔 Which One Should I Choose?

### **Choose 64-bit NSIS if:**

- ✅ You have a modern computer (bought after 2010)
- ✅ You're running Windows 10 or 11
- ✅ You have admin rights
- ✅ You want automatic updates
- ✅ You want proper Windows integration

### **Choose 32-bit NSIS if:**

- ✅ You have an older computer
- ✅ Your Windows is 32-bit
- ✅ The 64-bit installer doesn't work

### **Choose Portable if:**

- ✅ You don't have admin rights
- ✅ You want to run from USB drive
- ✅ You want to test before installing
- ✅ You need multiple installations
- ✅ You want complete control over the app location

---

## 🔄 Auto-Update Behavior

### **NSIS Installers (Recommended)**

```
1. App checks GitHub on startup
2. Finds new version → Shows dialog
3. User clicks "Download"
4. Downloads in background (~5-20 MB delta update)
5. Prompts to restart
6. App updates automatically ✨
```

### **Portable Version**

```
1. App checks GitHub on startup
2. Finds new version → Shows dialog
3. User clicks "Download"
4. Downloads full portable .exe (~214 MB)
5. User must manually replace old .exe
```

**Note:** Portable updates are larger because they download the full app, not just changes.

---

## 📦 GitHub Release Asset Labels

When you visit the GitHub Releases page, you'll see these labels:

| File Name                | Label in GitHub                 | What It Is                |
| ------------------------ | ------------------------------- | ------------------------- |
| `*-win-x64.exe`          | Windows Installer (64-bit NSIS) | Main installer for 64-bit |
| `*-win-ia32.exe`         | Windows Installer (32-bit NSIS) | Installer for 32-bit      |
| `*-win-Portable-x64.exe` | Windows Portable (64-bit)       | Portable version          |
| `*.exe.blockmap`         | Update Delta File               | For faster updates        |
| `latest*.yml`            | Auto-updater Manifest           | Update metadata           |

---

## 🛠️ Technical Details

### **NSIS (Nullsoft Scriptable Install System)**

- Industry-standard Windows installer
- Used by major apps (VLC, Audacity, etc.)
- Creates proper Windows installer with uninstaller
- Integrates with Windows registry
- Supports silent installation (`/S` flag)

### **Portable Format**

- Self-contained executable
- No registry modifications
- All data in app directory
- Can run from read-only media (with limitations)
- Ideal for system administrators

### **Architecture Differences**

- **x64 (64-bit):** Can use more than 4GB RAM, faster for large operations
- **ia32 (32-bit):** Compatible with older systems, limited to ~4GB RAM
- **Modern PCs:** Almost all are 64-bit (since ~2010)

---

## 🎯 Common Questions

### **Q: Can I install both 32-bit and 64-bit on the same PC?**

A: No, only one NSIS installation at a time. Use portable version for multiple instances.

### **Q: Can I convert from NSIS to Portable?**

A: Yes, just install portable version and copy your data from `%APPDATA%\AuraSwift`.

### **Q: Which is faster?**

A: 64-bit NSIS is generally faster on modern systems.

### **Q: Can portable version use auto-update?**

A: Yes, it detects updates but requires manual .exe replacement.

### **Q: Do I need all three files?**

A: No! Just download ONE that matches your needs.

### **Q: What about the .blockmap files?**

A: These are for the auto-updater. You don't download them manually.

### **Q: What are the latest\*.yml files?**

A: Update manifests for auto-updater. You don't need to download these.

---

## 📝 Installation Tips

### **For IT Administrators:**

**Silent Installation:**

```batch
AuraSwift-1.1.0-win-x64.exe /S /D=C:\Program Files\AuraSwift
```

**Unattended Installation:**

```batch
AuraSwift-1.1.0-win-x64.exe /S /NCRC /D=%ProgramFiles%\AuraSwift
```

**Deploy Portable:**

```batch
xcopy AuraSwift-1.1.0-win-Portable-x64.exe "C:\Apps\AuraSwift\" /Y
```

---

## 🔒 Security Notes

**All installers:**

- ✅ Signed with SHA256 checksums
- ✅ Verified by electron-updater
- ✅ Downloaded via HTTPS from GitHub
- ⚠️ Windows may show "Unknown Publisher" warning (until code signing certificate is purchased)

**To verify authenticity:**

1. Download from official GitHub Releases only: `https://github.com/Sam231221/AuraSwift/releases`
2. Check file size matches what's shown on GitHub
3. Compare SHA256 hash if needed

---

## 🎉 Recommendation Summary

| User Type                      | Recommended Installer        |
| ------------------------------ | ---------------------------- |
| **Home users (Windows 10/11)** | 64-bit NSIS                  |
| **Business/Office**            | 64-bit NSIS                  |
| **Older computers**            | 32-bit NSIS                  |
| **Without admin rights**       | Portable                     |
| **USB drive usage**            | Portable                     |
| **System administrators**      | 64-bit NSIS (silent install) |
| **Testing/Evaluation**         | Portable                     |

---

**Still unsure?** → Download **64-bit NSIS** (it works for 95% of users)
