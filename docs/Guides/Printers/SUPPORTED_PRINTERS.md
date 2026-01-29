# Supported Printers - Complete Reference

**Last Updated:** November 4, 2025  
**Platform:** Windows 10/11, macOS, Linux

---

## 📋 **TABLE OF CONTENTS**

1. [Thermal Receipt Printers](#thermal-receipt-printers) - For receipts (58mm/80mm)
2. [Office/Laser Printers](#officelaser-printers) - For documents (Letter/A4) ⭐ NEW
3. [Configuration Examples](#configuration-examples)
4. [Troubleshooting](#troubleshooting)

---

## 🧾 **THERMAL RECEIPT PRINTERS**

**Library:** node-thermal-printer v4.5.0  
**Status:** ⚠️ **MOSTLY PRODUCTION READY** - See [Production Analysis](./Hardwares/PRINTER_PRODUCTION_ANALYSIS.md)

### ⚠️ IMPORTANT NOTICE

This printer integration is **closer to production ready** than the payment system, but still requires fixes:

**Current Status:**

- ✅ Proper library integration (node-thermal-printer v4.5.0)
- ✅ Professional receipt formatting
- ✅ USB printer support working
- ⚠️ Bluetooth support needs testing
- ⚠️ Error recovery needs improvement
- ❌ No automated testing

**Before Production:**

- Remove mock printer service file
- Add retry logic and failed job persistence
- Implement real Bluetooth device discovery
- Add comprehensive testing
- Set up monitoring and logging

**Timeline:** 3.5-5.5 weeks to production ready  
**See:** [Printer Production Analysis](./Hardwares/PRINTER_PRODUCTION_ANALYSIS.md) for details

---

## 🖨️ **WIRED (USB) PRINTERS** ✅ Working

### **Epson Models** (Primary Support)

| Model    | Type         | Width     | Notes                             |
| -------- | ------------ | --------- | --------------------------------- |
| TM-T20   | USB          | 80mm      | Entry-level, widely available     |
| TM-T82   | USB          | 80mm      | Standard retail printer           |
| TM-T88V  | USB          | 80mm      | **Most common in POS systems** ⭐ |
| TM-T88VI | USB/Ethernet | 80mm      | Latest generation                 |
| TM-m10   | USB          | 58mm/80mm | Compact, mobile-ready             |
| TM-m30   | USB/Ethernet | 80mm      | Space-saving design               |

### **Star Micronics Models**

| Model  | Type                | Width | Notes                          |
| ------ | ------------------- | ----- | ------------------------------ |
| TSP100 | USB                 | 80mm  | Popular budget option          |
| TSP143 | USB                 | 80mm  | High-speed printing            |
| TSP654 | USB/Serial/Ethernet | 80mm  | Multi-interface                |
| TSP650 | USB/Serial          | 80mm  | Older but reliable             |
| mPOP   | USB                 | 58mm  | Combined printer + cash drawer |

### **Citizen Models**

| Model    | Type                | Width | Notes            |
| -------- | ------------------- | ----- | ---------------- |
| CT-S310A | USB                 | 80mm  | Compact design   |
| CT-S4000 | USB/Ethernet        | 80mm  | High performance |
| CT-E651  | USB/Ethernet/Serial | 80mm  | Triple interface |

### **Bixolon Models**

| Model      | Type | Width | Notes                    |
| ---------- | ---- | ----- | ------------------------ |
| SRP-350    | USB  | 80mm  | Standard receipt printer |
| SRP-275III | USB  | 80mm  | Compact size             |

### **Generic Brands**

- ✅ **DIERI** USB thermal printers
- ✅ Any **ESC/POS compatible** USB printer
- ✅ Most generic receipt printers with USB interface

---

## 📡 **WIRELESS (BLUETOOTH) PRINTERS** ⚠️ Needs Testing

**Status:** Code exists but requires real-world testing and proper device discovery implementation.

### **Mobile/Portable Models**

| Model        | Brand   | Width | Battery | Notes                    |
| ------------ | ------- | ----- | ------- | ------------------------ |
| **DIERI BT** | DIERI   | 58mm  | Yes     | **Explicitly tested** ⭐ |
| TM-P20       | Epson   | 58mm  | Yes     | Popular mobile printer   |
| TM-P80       | Epson   | 80mm  | Yes     | Advanced mobile with NFC |
| SM-L200      | Star    | 58mm  | Yes     | Compact portable         |
| SM-L300      | Star    | 80mm  | Yes     | Rugged, weatherproof     |
| SPP-R200III  | Bixolon | 58mm  | Yes     | Lightweight mobile       |
| SPP-R400     | Bixolon | 104mm | Yes     | Wide format mobile       |

### **Bluetooth Requirements:**

- Bluetooth 2.0 or higher
- Serial Port Profile (SPP) support
- Must be paired with computer via OS Bluetooth settings
- MAC address format: `BT:XX:XX:XX:XX:XX:XX`
- Recommended range: ≤10 meters for stable connection

---

## ⚙️ **CONFIGURATION EXAMPLES**

### **USB Connection (Windows):**

```typescript
{
  type: "epson",
  interface: "COM3",  // Check Device Manager
  options: {
    timeout: 5000,
    characterSet: "CP437"
  }
}
```

### **USB Connection (macOS):**

```typescript
{
  type: "epson",
  interface: "/dev/tty.usbserial-XXXXXXXX",  // Check with ls -la /dev/tty.*
  options: {
    timeout: 5000,
    characterSet: "CP437"
  }
}
```

### **Bluetooth Connection:**

```typescript
{
  type: "epson",
  interface: "COM5",  // Bluetooth COM port (Windows)
  // OR
  interface: "/dev/tty.printer-SerialPort",  // macOS
  // OR
  interface: "BT:00:11:62:AA:BB:CC",  // Direct MAC address
  options: {
    timeout: 5000,
    characterSet: "CP437"
  }
}
```

---

## 🎯 **RECOMMENDED MODELS**

### **For Fixed POS Stations:**

| Priority | Model              | Why                               |
| -------- | ------------------ | --------------------------------- |
| 🥇 1st   | **Epson TM-T88VI** | Industry standard, reliable, fast |
| 🥈 2nd   | Star TSP143        | Cost-effective, high speed        |
| 🥉 3rd   | Citizen CT-S4000   | High performance alternative      |

### **For Mobile/Portable Use:**

| Priority | Model            | Why                            |
| -------- | ---------------- | ------------------------------ |
| 🥇 1st   | **Epson TM-P20** | Lightweight, long battery life |
| 🥈 2nd   | DIERI BT         | Budget-friendly, tested        |
| 🥉 3rd   | Star SM-L200     | Compact, reliable              |

---

## 🔧 **PAPER SPECIFICATIONS**

### **58mm Printers:**

- Paper width: 58mm (2.25 inches)
- Characters per line: **32 characters**
- Best for: Mobile, compact setups

### **80mm Printers:**

- Paper width: 80mm (3.15 inches)
- Characters per line: **48 characters**
- Best for: Fixed POS stations, detailed receipts

---

## ✅ **COMPATIBILITY MATRIX**

| Feature          | USB     | Bluetooth  | Notes                     |
| ---------------- | ------- | ---------- | ------------------------- |
| ESC/POS Commands | ✅      | ✅         | Full support              |
| Auto-detection   | ✅      | ⚠️         | BT requires pairing first |
| Print Queue      | ✅      | ✅         | Managed by software       |
| Paper Cut        | ✅      | ✅         | If printer supports       |
| Graphics/Logos   | ✅      | ✅         | ESC/POS compatible        |
| Character Sets   | ✅      | ✅         | CP437, CP850, etc.        |
| Connection Speed | ⚡ Fast | 🐢 Slower  | USB more reliable         |
| Setup Complexity | 🟢 Easy | 🟡 Medium  | BT needs pairing          |
| Production Ready | ✅ Yes  | ⚠️ Testing | USB recommended           |

---

## 🚫 **NOT SUPPORTED**

- ❌ Inkjet printers
- ❌ Laser printers
- ❌ Non-ESC/POS thermal printers
- ❌ Printers without USB/Bluetooth
- ❌ WiFi-only printers (no direct support)
- ❌ Parallel port printers

---

## 🆘 **QUICK TROUBLESHOOTING**

| Problem              | Solution                                  |
| -------------------- | ----------------------------------------- |
| Printer not detected | Check USB cable, drivers, COM port        |
| Bluetooth won't pair | Enable BT on printer, update drivers      |
| Prints blank         | Check paper orientation (thermal side)    |
| Garbled text         | Try different character set (CP437/CP850) |
| Connection timeout   | Increase timeout to 10000ms               |
| Queue stuck          | Restart app or call cancelPrint()         |

---

## 📞 **VENDOR SUPPORT**

### **Epson:**

- Website: epson.com/pos
- Support: epson.com/support
- SDK: epson.com/pos-sdk

### **Star Micronics:**

- Website: starmicronics.com
- Support: starmicronics.com/support
- SDK: starmicronics.com/sdk

### **Citizen:**

- Website: citizen-systems.com
- Support: citizen-systems.com/support

### **Bixolon:**

- Website: bixolon.com
- Support: bixolon.com/support

---

## �️ **OFFICE/LASER PRINTERS** ⭐ NEW

**Libraries:** printer v0.4.0, pdf-to-printer v5.6.0  
**Status:** ✅ **PRODUCTION READY**

### ✅ FULLY SUPPORTED

This office printer integration is **production-ready** with comprehensive features:

**Current Status:**

- ✅ Full system printer integration (Windows/macOS/Linux)
- ✅ Retry logic with exponential backoff (3 attempts)
- ✅ Failed job persistence in database
- ✅ Health monitoring every 60 seconds
- ✅ Structured logging with Winston (rotating files)
- ✅ Metrics tracking (success rate, avg time, retries)
- ✅ Queue management and job cancellation
- ✅ TypeScript types and React hooks

**Production Features:**

- **Retry Logic**: 3 attempts with 5s, 15s, 30s delays
- **Job Persistence**: All jobs saved to SQLite database
- **Health Monitoring**: Periodic printer health checks
- **Logging**: Winston with error.log and combined.log files
- **Metrics**: Success rate, average print time, retry counts
- **No Security Issues**: No hardcoded credentials or tokens

**Timeline:** ✅ **Ready Now** (complete implementation)  
**Cost:** $0 additional (vs $6.5k-$12k for thermal printer fixes)

---

### **Supported Manufacturers**

✅ **All major office printer brands:**

| Brand       | Models                                  | Notes                 |
| ----------- | --------------------------------------- | --------------------- |
| **HP**      | LaserJet Pro, OfficeJet, Color LaserJet | ⭐ Including M3302fdw |
| **Canon**   | imageCLASS, PIXMA, Color imageRUNNER    | All series supported  |
| **Epson**   | WorkForce, EcoTank, Expression          | Inkjet & laser        |
| **Brother** | HL, MFC, DCP series                     | Laser & multifunction |
| **Dell**    | Laser Printer, Color Laser              | All models            |
| **Lexmark** | MS, CX, MB series                       | Monochrome & color    |
| **Samsung** | Xpress, ProXpress                       | Now HP-owned          |
| **Xerox**   | Phaser, WorkCentre, VersaLink           | Enterprise support    |
| **Kyocera** | ECOSYS, TASKalfa                        | Professional printers |
| **Ricoh**   | SP, C series                            | Office equipment      |

**Compatibility:** Any printer with Windows/macOS/Linux system drivers

---

### **Print Capabilities**

#### **Document Types**

- ✅ PDF documents (primary)
- ✅ Images (JPG, PNG, BMP, TIFF)
- ✅ Text files
- ✅ Raw print data

#### **Print Options**

- **Copies**: 1-999
- **Color**: Color or Black & White
- **Duplex**: Simplex, Vertical, Horizontal
- **Paper Size**: Letter, Legal, A4, A3, Custom
- **Orientation**: Portrait, Landscape
- **Quality**: Draft, Normal, High, Best
- **Page Range**: Specific pages (e.g., "1-5,8,10-12")
- **Scaling**: 25%-400%
- **Collation**: Enabled/Disabled

---

### **Usage Example**

```typescript
// Discover available printers
const { printers } = await window.officePrinterAPI.list();

// Print a PDF invoice
const result = await window.officePrinterAPI.print({
  jobId: `invoice_${Date.now()}`,
  printerName: "HP Color LaserJet Pro MFP M3302fdw",
  documentPath: "/path/to/invoice.pdf",
  documentType: "pdf",
  options: {
    copies: 2,
    color: true,
    duplex: "vertical",
    paperSize: "letter",
    quality: "high",
    collate: true,
  },
});

// Monitor print job
const status = await window.officePrinterAPI.getJobStatus(result.jobId);
```

---

### **React Hook Usage**

```typescript
import { useOfficePrinter } from "@/hooks/useOfficePrinter";

const MyComponent = () => {
  const { printers, selectedPrinter, printDocument, discoverPrinters, printState, jobStatus } = useOfficePrinter();

  // Discover printers on mount
  useEffect(() => {
    discoverPrinters();
  }, []);

  // Print a document
  const handlePrint = async () => {
    await printDocument("/path/to/document.pdf", "pdf", {
      copies: 1,
      color: true,
      quality: "high",
    });
  };

  return (
    <div>
      <select onChange={(e) => setSelectedPrinter(e.target.value)}>
        {printers.map((p) => (
          <option key={p.name} value={p.name}>
            {p.displayName}
          </option>
        ))}
      </select>
      <button onClick={handlePrint}>Print</button>
      {printState === "printing" && <p>Printing... {jobStatus?.progress}%</p>}
    </div>
  );
};
```

---

### **Admin Dashboard Features**

- **Failed Jobs View**: See all failed print jobs with retry option
- **Printer Health**: Monitor printer status, paper, toner
- **Metrics Dashboard**: Success rate, average time, retry counts
- **Queue Management**: Clear pending jobs, cancel active jobs
- **Job History**: Complete audit trail in database

---

## ⚙️ **CONFIGURATION EXAMPLES**

### **Thermal Receipt Printers**

#### **USB Connection (Windows):**

For detailed information, see:

- **[PRINTER_PRODUCTION_ANALYSIS.md](./Hardwares/PRINTER_PRODUCTION_ANALYSIS.md)** - Production readiness analysis ⭐
- **PRINTER_TESTING_GUIDE.md** - Complete testing procedures
- **PRINTER_INTEGRATION_SUMMARY.md** - Technical overview

---

**Last Updated:** November 4, 2025

**Thermal Receipt Printers:**

- Library: node-thermal-printer v4.5.0
- Status: ⚠️ Mostly Production Ready - [See Analysis](./Hardwares/PRINTER_PRODUCTION_ANALYSIS.md)

**Office/Laser Printers:**

- Libraries: printer v0.4.0, pdf-to-printer v5.6.0
- Status: ✅ Production Ready with full feature set

**Platform:** Windows 10/11 (Primary), macOS, Linux

---

## 📚 **DOCUMENTATION**

### Thermal Printers

- **[PRINTER_PRODUCTION_ANALYSIS.md](./Hardwares/PRINTER_PRODUCTION_ANALYSIS.md)** - Production readiness analysis
- **PRINTER_TESTING_GUIDE.md** - Complete testing procedures
- **PRINTER_INTEGRATION_SUMMARY.md** - Technical overview

### Office Printers

- **TypeScript Types**: `packages/renderer/src/types/officePrinter.ts`
- **React Hooks**: `packages/renderer/src/hooks/useOfficePrinter.ts`
- **Service**: `packages/main/src/services/officePrinterService.ts`
- **IPC Bridge**: `packages/preload/src/index.ts` (officePrinterAPI)

---

## 🆚 **COMPARISON**

| Feature               | Thermal Printer          | Office Printer             |
| --------------------- | ------------------------ | -------------------------- |
| **Purpose**           | Small receipts (58/80mm) | Full documents (Letter/A4) |
| **Status**            | ⚠️ Needs work            | ✅ Production ready        |
| **Retry Logic**       | ❌ Missing               | ✅ 3 attempts with backoff |
| **Job Persistence**   | ❌ Lost on failure       | ✅ Database saved          |
| **Health Monitoring** | ❌ No checks             | ✅ Every 60 seconds        |
| **Logging**           | ❌ Console only          | ✅ Winston rotating files  |
| **Metrics**           | ❌ None                  | ✅ Full tracking           |
| **Timeline to Prod**  | 3.5-5.5 weeks            | ✅ Ready now               |
| **Cost to Fix**       | $6.5k-$12k               | $0                         |

---

## ✅ **RECOMMENDATION**

For **HP Color LaserJet Pro MFP M3302fdw** and similar office printers:

- ✅ **Use the Office Printer integration** (production-ready)
- ✅ Full retry logic, persistence, and monitoring included
- ✅ Supports all print options (color, duplex, quality, etc.)
- ✅ Complete React hooks and TypeScript types
- ✅ Ready for immediate use

For **thermal receipt printers**:

- ⚠️ Working but needs production hardening
- ⚠️ Best for quick receipt printing (not critical documents)
- ⚠️ Plan 3.5-5.5 weeks for production readiness
