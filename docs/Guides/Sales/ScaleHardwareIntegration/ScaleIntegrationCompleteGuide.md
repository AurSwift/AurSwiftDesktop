# Scale Hardware Integration & POS Logic Guide

This guide consolidates the strategy, hardware integration, business logic, and workflows for integrating scale hardware into the AuraSwift POS system.

---

## Part 1: Critical Setup Strategy

*Best practices for category structure and product classification to ensure smooth scale integration.*

### Critical Phase: POS Setup & Category Structure

This is the **critical setup phase** that determines how well the POS will work. Below is a practical, step-by-step guide for a new business owner.

### Phase 1: Category Structure Setup

#### Step 1: Plan Your Store Layout First

**Think physically:** How is your store organized?

```
Grocery Store Example:
┌─────────────────┐
│   STORE LAYOUT  │
├─────────────────┤
│ • Fresh Produce │
│ • Dairy & Eggs  │
│ • Meat & Poultry│
│ • Beverages     │
│ • Bakery        │
│ • Frozen Foods  │
│ • Household     │
└─────────────────┘
```

#### Step 2: Create Category Hierarchy

**In POS Management Website → Categories**

```sql
-- Top-level categories (match your store sections)
INSERT INTO categories (id, name, parent_id, display_order) VALUES
('cat-fresh', 'Fresh Produce', NULL, 1),
('cat-dairy', 'Dairy & Eggs', NULL, 2),
('cat-meat', 'Meat & Poultry', NULL, 3),
('cat-beverages', 'Beverages', NULL, 4),
('cat-bakery', 'Bakery', NULL, 5),
('cat-frozen', 'Frozen Foods', NULL, 6),
('cat-household', 'Household', NULL, 7);

-- Subcategories for better organization
INSERT INTO categories (id, name, parent_id, display_order) VALUES
('cat-fresh-fruits', 'Fruits', 'cat-fresh', 1),
('cat-fresh-vegetables', 'Vegetables', 'cat-fresh', 2),
('cat-fresh-herbs', 'Herbs', 'cat-fresh', 3),

('cat-dairy-milk', 'Milk & Cream', 'cat-dairy', 1),
('cat-dairy-cheese', 'Cheese', 'cat-dairy', 2),
('cat-dairy-yogurt', 'Yogurt', 'cat-dairy', 3),
('cat-dairy-eggs', 'Eggs', 'cat-dairy', 4);
```

**UI Example:**

```tsx
// In management website - Category setup form
const CategorySetup = () => {
  return (
    <div className="category-setup">
      <h2>Store Categories Setup</h2>

      <CategoryForm name="Fresh Produce" description="Fruits, vegetables, herbs" parentCategory={null} displayOrder={1} />

      <SubcategoryForm
        parentCategory="Fresh Produce"
        subcategories={[
          { name: "Fruits", order: 1 },
          { name: "Vegetables", order: 2 },
          { name: "Herbs", order: 3 },
        ]}
      />
    </div>
  );
};
```

### Phase 2: Product Setup & Classification

#### Step 3: Product Data Entry Decision Framework

**Ask these questions for EACH product:**

##### **Question 1: "How do customers buy this?"**

- ✅ **UNIT**: Sold as individual units (cans, bottles, packages)
- ✅ **WEIGHT**: Sold by weight (customer chooses quantity)

##### **Question 2: "Does this product expire?"**

- ✅ **SIMPLE**: No expiry tracking (canned goods, cleaning supplies)
- ✅ **BATCH_TRACKED**: Has expiry date (dairy, meat, fresh foods)

#### Step 4: Practical Product Classification Guide

| Product Examples      | Category               | Sale Type | Inventory Type | Why?                               |
| --------------------- | ---------------------- | --------- | -------------- | ---------------------------------- |
| **Apples**            | Fresh Produce → Fruits | WEIGHT    | SIMPLE         | Sold by weight, no specific expiry |
| **Bananas**           | Fresh Produce → Fruits | WEIGHT    | SIMPLE         | Sold by weight, no batch tracking  |
| **Milk 1L**           | Dairy → Milk           | UNIT      | BATCH_TRACKED  | Fixed unit, expires quickly        |
| **Chicken Breast**    | Meat → Poultry         | WEIGHT    | BATCH_TRACKED  | Sold by weight, expires quickly    |
| **Coca-Cola**         | Beverages              | UNIT      | SIMPLE         | Fixed unit, long shelf life        |
| **Bread**             | Bakery                 | UNIT      | BATCH_TRACKED  | Fixed unit, expires in days        |
| **Laundry Detergent** | Household              | UNIT      | SIMPLE         | Fixed unit, no expiry concern      |

#### Step 5: Product Data Entry in Management System

```tsx
// Product Management Interface
const ProductManagement = () => {
  return (
    <div className="product-setup">
      <h2>Add New Products</h2>

      {/* Example: Adding Milk */}
      <ProductForm
        basicInfo={{
          name: "Fresh Milk 1L",
          barcode: "123456789012",
          sku: "MILK-1L-001",
          category: "cat-dairy-milk",
        }}
        sellingType={{
          saleType: "UNIT", // Sold as bottle
          unitPrice: 2.99, // Price per bottle
          inventoryType: "BATCH_TRACKED", // Expires!
        }}
        restrictions={{
          ageRestriction: "NONE",
          requireIdScan: false,
        }}
      />

      {/* Example: Adding Apples */}
      <ProductForm
        basicInfo={{
          name: "Fresh Apples",
          barcode: "123456789013",
          sku: "APPLES-RED",
          category: "cat-fresh-fruits",
        }}
        sellingType={{
          saleType: "WEIGHT", // Sold by weight
          pricePerUnit: 3.99, // Price per kg
          unitOfMeasure: "kg", // Kilograms
          inventoryType: "SIMPLE", // No expiry tracking
        }}
        scaleSettings={{
          tareWeight: 0.005, // Bag weight
          minWeight: 0.1, // Min 100g sale
          maxWeight: 5.0, // Max 5kg
        }}
      />
    </div>
  );
};
```

### Phase 3: Batch Tracking Decision Guide

#### Step 6: When to Use Batch Tracking?

**USE BATCH TRACKING for:**

```
✅ DAIRY PRODUCTS
   - Milk, yogurt, cheese, cream, butter

✅ MEAT & POULTRY
   - Chicken, beef, pork, fish

✅ FRESH PREPARED FOODS
   - Sandwiches, salads, ready meals

✅ BAKERY ITEMS
   - Bread, cakes, pastries

✅ FRESH PRODUCE (some)
   - Packaged salads, cut fruits

✅ MEDICATIONS
   - All pharmacy items
```

**NO BATCH TRACKING for:**

```
❌ CANNED GOODS
   - Canned vegetables, soups, tuna

❌ PACKAGED GROCERY
   - Pasta, rice, cereals, flour

❌ BEVERAGES (shelf-stable)
   - Soda, juice boxes, bottled water

❌ HOUSEHOLD ITEMS
   - Cleaning supplies, toilet paper

❌ FROZEN FOODS (long shelf life)
   - Frozen vegetables, ice cream
```

#### Step 7: Batch Setup Process

**For each batch-tracked product, you'll create batches when stock arrives:**

```tsx
// When milk delivery arrives
const BatchCreation = () => {
  return (
    <div className="batch-setup">
      <h3>Receive New Batch</h3>

      <BatchForm
        product="Fresh Milk 1L"
        batchInfo={{
          batchNumber: "MILK-2024-OCT25", // From supplier or generate
          expiryDate: "2024-10-25", // Check on packaging
          quantityReceived: 100, // Number of units
          costPrice: 1.5, // For profit calculation
          supplier: "Local Dairy Co.",
          location: "Cool Room A",
        }}
      />
    </div>
  );
};
```

### Phase 4: Practical Implementation Workflow

#### Step 8: Data Entry Priority List

**WEEK 1: Essential Setup**

1. **Create main categories** (match store layout)
2. **Add top-selling products** (start with 50-100 items)
3. **Focus on products you sell daily**

**WEEK 2: Expand & Refine**

1. **Add subcategories** for better organization
2. **Add remaining products**
3. **Set up batches for perishables**

**WEEK 3: Optimize**

1. **Add barcodes** for faster scanning
2. **Set up reorder points**
3. **Train staff on the system**

#### Step 9: Sample Starter Product List

```sql
-- Essential products to start with
INSERT INTO products (id, name, category_id, sale_type, inventory_type, unit_price, price_per_unit, unit_of_measure) VALUES
-- DAIRY (Batch-tracked)
('milk-1l', 'Fresh Milk 1L', 'cat-dairy-milk', 'UNIT', 'BATCH_TRACKED', 2.99, NULL, NULL),
('eggs-12', 'Eggs 12pk', 'cat-dairy-eggs', 'UNIT', 'BATCH_TRACKED', 4.99, NULL, NULL),
('yogurt', 'Greek Yogurt 500g', 'cat-dairy-yogurt', 'UNIT', 'BATCH_TRACKED', 3.49, NULL, NULL),

-- MEAT (Weighted + Batch-tracked)
('chicken-breast', 'Chicken Breast', 'cat-meat', 'WEIGHT', 'BATCH_TRACKED', NULL, 12.99, 'kg'),
('ground-beef', 'Ground Beef', 'cat-meat', 'WEIGHT', 'BATCH_TRACKED', NULL, 9.99, 'kg'),

-- PRODUCE (Weighted + Simple)
('apples', 'Red Apples', 'cat-fresh-fruits', 'WEIGHT', 'SIMPLE', NULL, 3.99, 'kg'),
('bananas', 'Bananas', 'cat-fresh-fruits', 'WEIGHT', 'SIMPLE', NULL, 2.99, 'kg'),
('potatoes', 'Potatoes', 'cat-fresh-vegetables', 'WEIGHT', 'SIMPLE', NULL, 1.99, 'kg'),

-- GROCERY (Unit + Simple)
('coke', 'Coca-Cola 330ml', 'cat-beverages', 'UNIT', 'SIMPLE', 1.50, NULL, NULL),
('bread', 'White Bread', 'cat-bakery', 'UNIT', 'BATCH_TRACKED', 2.49, NULL, NULL);
```

### Phase 5: Training & Go-Live

#### Step 10: Staff Training Guide

**For Cashiers:**

- "Green items are weighted - place on scale"
- "Red warnings mean expiry check needed"
- "ID verification for age-restricted items"

**For Managers:**

- "Create batches when delivery arrives"
- "Check expiry reports daily"
- "Use categories to find products quickly"

#### Step 11: Daily Operations Checklist

```markdown
MORNING:
☐ Check expiry reports for today/tomorrow
☐ Create batches for new deliveries
☐ Ensure scale is connected and calibrated

DURING DAY:
☐ Scan products - system handles the rest!
☐ Follow age verification prompts
☐ Handle scale items as prompted

EVENING:
☐ Review sales reports
☐ Check low stock alerts
☐ Print expiry report for next day
```

### Key Success Tips

1. **Start Simple**: Don't batch-track everything initially
2. **Use Barcodes**: Speeds up data entry dramatically
3. **Train with Real Scenarios**: "What happens when...?"
4. **Regular Maintenance**: Update prices, categories as needed
5. **Listen to Cashiers**: They'll tell you what's working/not working

---

## Part 2: Hardware Integration

*Technical specifications and Electron architecture for scale communication.*

### Hardware Compatibility & Selection

#### **Recommended Scale Models for POS Integration**

```typescript
// types/scale-hardware.ts
export interface ScaleHardwareSpec {
  model: string;
  manufacturer: string;
  connectionType: "USB" | "RS-232" | "Bluetooth" | "TCP/IP";
  protocol: "Mettler Toledo" | "Sartorius" | "Ohaus" | "Generic HID";
  supportedPlatforms: ("windows" | "macos" | "linux")[];
  priceRange: "budget" | "mid-range" | "enterprise";
  weightCapacity: number; // in kg
  accuracy: number; // in grams
}

export const RECOMMENDED_SCALES: ScaleHardwareSpec[] = [
  // Budget Options
  {
    model: "DYMO S100",
    manufacturer: "DYMO",
    connectionType: "USB",
    protocol: "Generic HID",
    supportedPlatforms: ["windows", "macos"],
    priceRange: "budget",
    weightCapacity: 5,
    accuracy: 1,
  },
  {
    model: "Stamps.com 5lb Scale",
    manufacturer: "Stamps.com",
    connectionType: "USB",
    protocol: "Generic HID",
    supportedPlatforms: ["windows", "macos"],
    priceRange: "budget",
    weightCapacity: 2.2,
    accuracy: 1,
  },

  // Mid-Range Options
  {
    model: "Mettler Toledo J-Series",
    manufacturer: "Mettler Toledo",
    connectionType: "USB",
    protocol: "Mettler Toledo",
    supportedPlatforms: ["windows", "macos", "linux"],
    priceRange: "mid-range",
    weightCapacity: 15,
    accuracy: 0.5,
  },
  {
    model: "Sartorius Entris",
    manufacturer: "Sartorius",
    connectionType: "USB",
    protocol: "Sartorius",
    supportedPlatforms: ["windows", "macos", "linux"],
    priceRange: "mid-range",
    weightCapacity: 12,
    accuracy: 0.1,
  },

  // Enterprise Options
  {
    model: "Mettler Toledo IND560",
    manufacturer: "Mettler Toledo",
    connectionType: "TCP/IP",
    protocol: "Mettler Toledo",
    supportedPlatforms: ["windows", "macos", "linux"],
    priceRange: "enterprise",
    weightCapacity: 30,
    accuracy: 0.01,
  },
];
```

### Electron Integration Architecture

#### **1. Main Process Scale Service**

```typescript
// main/scaleService.ts
import { app, ipcMain } from "electron";
import { SerialPort } from "serialport";
import { HID } from "node-hid";
import net from "net";

export class ScaleHardwareService {
  private connectedScale: any = null;
  private isReading: boolean = false;
  private currentWeight: number = 0;
  private isStable: boolean = false;

  constructor() {
    this.initializeIPCHandlers();
  }

  private initializeIPCHandlers() {
    ipcMain.handle("scale:discover", async () => {
      return await this.discoverScales();
    });

    ipcMain.handle("scale:connect", async (event, scaleConfig) => {
      return await this.connectToScale(scaleConfig);
    });

    ipcMain.handle("scale:disconnect", async () => {
      return await this.disconnectScale();
    });

    ipcMain.handle("scale:tare", async () => {
      return await this.tareScale();
    });

    ipcMain.on("scale:start-reading", () => {
      this.startReading();
    });

    ipcMain.on("scale:stop-reading", () => {
      this.stopReading();
    });
  }

  // Scale Discovery Methods
  private async discoverScales() {
    const discoveredScales = [];

    try {
      // Discover USB HID Scales
      const hidDevices = HID.devices();
      const scaleDevices = hidDevices.filter((device) => this.isScaleDevice(device));
      discoveredScales.push(
        ...scaleDevices.map((device) => ({
          type: "HID",
          path: device.path,
          vendorId: device.vendorId,
          productId: device.productId,
          manufacturer: device.manufacturer,
          product: device.product,
        }))
      );

      // Discover Serial Scales
      const ports = await SerialPort.list();
      const serialScales = ports.filter((port) => this.isSerialScale(port));
      discoveredScales.push(
        ...serialScales.map((port) => ({
          type: "SERIAL",
          path: port.path,
          manufacturer: port.manufacturer,
          serialNumber: port.serialNumber,
        }))
      );
    } catch (error) {
      console.error("Scale discovery error:", error);
    }

    return discoveredScales;
  }

  private isScaleDevice(device: any): boolean {
    // Common scale vendor IDs
    const scaleVendors = [
      0x0922, // Mettler Toledo
      0x1a86, // QinHeng Electronics (common in cheap scales)
      0x04d8, // Microchip (some scales)
      0x1c4f, // SIGMA
    ];

    return scaleVendors.includes(device.vendorId) || device.product?.toLowerCase().includes("scale") || device.manufacturer?.toLowerCase().includes("scale");
  }

  private isSerialScale(port: any): boolean {
    // Common scale manufacturers in serial port info
    const scaleManufacturers = ["metter", "sartorius", "ohaus", "scale", "balance"];

    return scaleManufacturers.some((manufacturer) => port.manufacturer?.toLowerCase().includes(manufacturer));
  }
}
```

#### **2. Platform-Specific Implementations**

```typescript
// main/scaleDrivers/
export interface IScaleDriver {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  startReading(callback: (weight: number, stable: boolean) => void): void;
  stopReading(): void;
  tare(): Promise<void>;
  getStatus(): ScaleStatus;
}

// USB HID Scale Driver
export class HIDScaleDriver implements IScaleDriver {
  private device: HID.HID | null = null;
  private isReading: boolean = false;

  constructor(private devicePath: string) {}

  async connect(): Promise<boolean> {
    try {
      this.device = new HID.HID(this.devicePath);

      this.device.on('data', (data: Buffer) => {
        this.parseHIDData(data);
      });

      this.device.on('error', (error) => {
        console.error('HID Scale error:', error);
        this.disconnect();
      });

      return true;
    } catch (error) {
      console.error('Failed to connect to HID scale:', error);
      return false;
    }
  }

  private parseHIDData(data: Buffer) {
    // Common HID scale data formats
    // Most scales send 6-8 byte packets with weight data

    let weight = 0;
    let stable = false;

    // Example: Parse common HID scale format
    if (data.length >= 6) {
      // Byte 2-3: Weight in grams (little-endian)
      weight = data.readUInt16LE(1);

      // Byte 5: Status (0x4 = stable, 0x5 = unstable)
      stable = data[4] === 0x04;

      // Convert to kg if needed
      weight = weight / 1000;
    }

    // Send to main process
    if (this.onWeightCallback) {
      this.onWeightCallback(weight, stable);
    }
  }
}

// Serial Scale Driver
export class SerialScaleDriver implements IScaleDriver {
  private port: SerialPort | null = null;
  private parser: any = null;

  constructor(private portPath: string, private baudRate: number = 9600) {}

  async connect(): Promise<boolean> {
    try {
      this.port = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      this.parser.on('data', (data: string) => {
        this.parseSerialData(data);
      });

      this.port.on('error', (error) => {
        console.error('Serial scale error:', error);
      });

      return true;
    } catch (error) {
      console.error('Failed to connect to serial scale:', error);
      return false;
    }
  }

  private parseSerialData(data: string) {
    // Common serial scale formats:
    // "S   1.234 kg" - Sartorius
    // "NT  0.567 kg" - Mettler Toledo
    // "+    1234 g" - Ohaus

    const match = data.match/([+-]?)\s*(\d+\.?\d*)\s*([k]?g)/i);
    if (match) {
      let weight = parseFloat(match[2]);
      const unit = match[3].toLowerCase();

      if (unit === 'g') {
        weight = weight / 1000; // Convert to kg
      }

      const stable = !data.includes('?') && !data.includes('NT');

      if (this.onWeightCallback) {
        this.onWeightCallback(weight, stable);
      }
    }
  }
}
```

### React Component Integration

#### **3. Scale Manager Hook**

```typescript
// renderer/hooks/useScaleManager.ts
import { useState, useCallback, useEffect } from "react";
import { ipcRenderer } from "electron";

export const useScaleManager = () => {
  const [scaleStatus, setScaleStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [availableScales, setAvailableScales] = useState<ScaleDevice[]>([]);
  const [currentReading, setCurrentReading] = useState<ScaleReading | null>(null);
  const [selectedScale, setSelectedScale] = useState<ScaleDevice | null>(null);

  // Discover available scales
  const discoverScales = useCallback(async () => {
    try {
      setScaleStatus("connecting");
      const scales = await ipcRenderer.invoke("scale:discover");
      setAvailableScales(scales);

      if (scales.length > 0) {
        // Auto-connect to first scale
        await connectToScale(scales[0]);
      } else {
        setScaleStatus("disconnected");
      }
    } catch (error) {
      console.error("Scale discovery failed:", error);
      setScaleStatus("error");
    }
  }, []);

  // Connect to specific scale
  const connectToScale = useCallback(async (scale: ScaleDevice) => {
    try {
      setScaleStatus("connecting");
      const success = await ipcRenderer.invoke("scale:connect", scale);

      if (success) {
        setSelectedScale(scale);
        setScaleStatus("connected");

        // Start reading
        ipcRenderer.send("scale:start-reading");
      } else {
        setScaleStatus("error");
      }
    } catch (error) {
      console.error("Scale connection failed:", error);
      setScaleStatus("error");
    }
  }, []);

  // Listen for scale readings
  useEffect(() => {
    const handleScaleData = (event: any, weight: number, stable: boolean) => {
      setCurrentReading({
        weight,
        stable,
        timestamp: new Date(),
        unit: "kg",
      });
    };

    ipcRenderer.on("scale-data", handleScaleData);

    return () => {
      ipcRenderer.off("scale-data", handleScaleData);
    };
  }, []);

  return {
    scaleStatus,
    availableScales,
    currentReading,
    selectedScale,
    discoverScales,
    connectToScale,
    tareScale: () => ipcRenderer.invoke("scale:tare"),
    disconnectScale: () => ipcRenderer.invoke("scale:disconnect"),
  };
};
```

### Common Problems & Solutions

#### **1. Driver Compatibility Issues**

```typescript
// main/scaleCompatibility.ts
export class ScaleCompatibilityManager {
  static async installRequiredDrivers(scaleDevice: ScaleDevice): Promise<boolean> {
    switch (scaleDevice.type) {
      case "HID":
        // Most HID scales work without additional drivers
        return true;

      case "SERIAL":
        // Check if serial port drivers are needed
        const needsDriver = await this.checkSerialDriverRequirements(scaleDevice);
        if (needsDriver) {
          return await this.installSerialDrivers(scaleDevice);
        }
        return true;

      default:
        console.warn(`Unsupported scale type: ${scaleDevice.type}`);
        return false;
    }
  }

  private static async checkSerialDriverRequirements(device: ScaleDevice): Promise<boolean> {
    // Check platform-specific requirements
    const platform = process.platform;

    if (platform === "win32") {
      // Windows often needs FTDI or Prolific drivers
      return device.manufacturer?.includes("Prolific") || device.manufacturer?.includes("FTDI");
    }

    if (platform === "darwin") {
      // macOS usually has built-in drivers
      return false;
    }

    if (platform === "linux") {
      // Linux typically works with built-in drivers
      return false;
    }

    return false;
  }

  private static async installSerialDrivers(device: ScaleDevice): Promise<boolean> {
    // Implement driver installation logic
    // This might involve:
    // 1. Downloading drivers from manufacturer website
    // 2. Running installer scripts
    // 3. Registering DLLs on Windows

    console.log(`Installing drivers for ${device.manufacturer} scale`);
    // Implementation depends on specific scale model
    return true;
  }
}
```

#### **2. Cross-Platform Considerations**

```typescript
// main/platformScaleConfig.ts
export const PLATFORM_SCALE_CONFIG = {
  win32: {
    defaultBaudRate: 9600,
    serialDriver: "win32-serialport",
    hidDriver: "node-hid",
    commonPorts: ["COM1", "COM2", "COM3", "COM4"],
  },
  darwin: {
    defaultBaudRate: 9600,
    serialDriver: "macos-serialport",
    hidDriver: "node-hid",
    commonPorts: ["/dev/tty.usbserial", "/dev/ttyUSB"],
  },
  linux: {
    defaultBaudRate: 9600,
    serialDriver: "linux-serialport",
    hidDriver: "node-hid",
    commonPorts: ["/dev/ttyUSB", "/dev/ttyACM"],
  },
};

export function getPlatformScaleConfig() {
  return PLATFORM_SCALE_CONFIG[process.platform as keyof typeof PLATFORM_SCALE_CONFIG];
}
```

#### **3. Error Handling & Recovery**

```typescript
// main/scaleErrorHandler.ts
export class ScaleErrorHandler {
  static handleError(error: ScaleError): ScaleErrorResponse {
    switch (error.code) {
      case "DEVICE_NOT_FOUND":
        return {
          userMessage: "Scale not found. Please check connections.",
          recoverySteps: ["Check USB cable connection", "Ensure scale is powered on", "Try reconnecting the scale"],
          autoRetry: true,
          retryDelay: 2000,
        };

      case "PERMISSION_DENIED":
        return {
          userMessage: "Permission denied. Please check scale permissions.",
          recoverySteps: ["Check system permissions for scale", "Try running as administrator (Windows)", "Add user to dialout group (Linux)"],
          autoRetry: false,
        };

      case "DRIVER_MISSING":
        return {
          userMessage: "Scale drivers not installed.",
          recoverySteps: ["Install required scale drivers", "Download drivers from manufacturer website", "Restart application after installation"],
          autoRetry: false,
        };

      default:
        return {
          userMessage: "Scale communication error.",
          recoverySteps: ["Restart the scale", "Reconnect USB cable", "Restart the application"],
          autoRetry: true,
          retryDelay: 5000,
        };
    }
  }
}
```

### Package.json Dependencies

```json
{
  "dependencies": {
    "serialport": "^12.0.0",
    "node-hid": "^3.0.0",
    "usb": "^2.9.0"
  },
  "devDependencies": {
    "electron-rebuild": "^3.2.9"
  }
}
```

### Build & Distribution Considerations

#### **Native Module Rebuilding**

```bash
# Required for serialport and node-hid to work with Electron
npm install --save-dev electron-rebuild
./node_modules/.bin/electron-rebuild
```

#### **Platform-Specific Builds**

```json
{
  "build": {
    "files": ["node_modules/serialport/**/*", "node_modules/node-hid/**/*", "node_modules/usb/**/*"],
    "extraResources": [
      {
        "from": "drivers/",
        "to": "drivers/",
        "filter": ["**/*"]
      }
    ]
  }
}
```

### Testing Strategy

```typescript
// test/scaleMockService.ts
export class MockScaleService {
  private mockWeight: number = 0;
  private isStable: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  startMockReading(callback: (weight: number, stable: boolean) => void) {
    this.intervalId = setInterval(() => {
      // Simulate weight fluctuations
      const fluctuation = Math.random() * 0.02 - 0.01; // -10g to +10g
      this.mockWeight = Math.max(0, this.mockWeight + fluctuation);

      // Randomly become stable
      this.isStable = Math.random() > 0.7;

      callback(this.mockWeight, this.isStable);
    }, 500);
  }

  simulateItemPlacement(weight: number) {
    this.mockWeight = weight;
    this.isStable = false;

    // Simulate stabilization after 2 seconds
    setTimeout(() => {
      this.isStable = true;
    }, 2000);
  }
}
```

### Key Recommendations

1. **Start with HID scales** - Easier compatibility across platforms
2. **Test on target platforms** - Scale behavior varies by OS
3. **Provide mock mode** - Essential for development without hardware
4. **Implement auto-reconnection** - Scales disconnect frequently
5. **Include comprehensive error handling** - Guide users through troubleshooting
6. **Consider scale calibration** - Build tools for weight verification
7. **Plan for multiple scale support** - Some stores need multiple scales

---

## Part 3: Business Logic & Implementation

*Core business logic, types, and component structures for the POS terminal.*

### 1. Product Types and Interfaces

```typescript
// types/product.ts
export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  type: "regular" | "weighted";
  pricePerUnit?: number; // For weighted items (per kg/g)
  barcode?: string;
  stock: number;
  vatRate: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  vatRate: number;
  parentId?: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  weight?: number; // For weighted items
  totalPrice: number;
  vatAmount: number;
  addedAt: Date;
}

export interface ScaleReading {
  weight: number; // in grams
  stable: boolean;
  timestamp: Date;
  unit: "g" | "kg";
}
```

### 2. Scale Service

```typescript
// services/scaleService.ts
export class ScaleService {
  private isConnected: boolean = false;
  private currentWeight: number = 0;
  private isStable: boolean = false;
  private unit: "g" | "kg" = "g";
  private listeners: ((reading: ScaleReading) => void)[] = [];

  constructor() {
    this.initializeScale();
  }

  private async initializeScale(): Promise<void> {
    try {
      // Simulate scale connection - replace with actual hardware integration
      await this.connectToScale();
      this.isConnected = true;
      this.startReading();
    } catch (error) {
      console.error("Failed to initialize scale:", error);
      this.isConnected = false;
    }
  }

  private async connectToScale(): Promise<void> {
    // Hardware integration logic here
    // This would interface with scale drivers/APIs
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate connection success
        Math.random() > 0.1 ? resolve() : reject(new Error("Scale connection failed"));
      }, 1000);
    });
  }

  private startReading(): void {
    // Simulate continuous weight readings
    setInterval(() => {
      this.simulateWeightReading();
    }, 500);
  }

  private simulateWeightReading(): void {
    // Simulate weight fluctuations and stabilization
    const fluctuation = Math.random() * 10 - 5; // -5g to +5g
    const newWeight = Math.max(0, this.currentWeight + fluctuation);

    // Consider stable if change is less than 2g for 3 consecutive readings
    const isStableNow = Math.abs(newWeight - this.currentWeight) < 2;

    if (isStableNow) {
      this.isStable = this.isStable || Math.random() > 0.3;
    } else {
      this.isStable = false;
    }

    this.currentWeight = newWeight;

    const reading: ScaleReading = {
      weight: this.currentWeight,
      stable: this.isStable,
      timestamp: new Date(),
      unit: this.unit,
    };

    this.notifyListeners(reading);
  }

  public addListener(listener: (reading: ScaleReading) => void): void {
    this.listeners.push(listener);
  }

  public removeListener(listener: (reading: ScaleReading) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private notifyListeners(reading: ScaleReading): void {
    this.listeners.forEach((listener) => {
      try {
        listener(reading);
      } catch (error) {
        console.error("Error in scale listener:", error);
      }
    });
  }

  public tare(): void {
    this.currentWeight = 0;
    this.isStable = false;
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public async reconnect(): Promise<void> {
    await this.initializeScale();
  }
}
```

### 3. POS Cart Management

```typescript
// hooks/usePOSCart.ts
import { useState, useCallback, useEffect } from "react";
import { Product, CartItem, ScaleReading } from "../types/product";
import { ScaleService } from "../services/scaleService";

export const usePOSCart = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [scaleService] = useState(() => new ScaleService());
  const [currentScaleReading, setCurrentScaleReading] = useState<ScaleReading | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Scale listener
  useEffect(() => {
    const handleScaleReading = (reading: ScaleReading) => {
      setCurrentScaleReading(reading);
    };

    scaleService.addListener(handleScaleReading);
    return () => scaleService.removeListener(handleScaleReading);
  }, [scaleService]);

  const addRegularProduct = useCallback((product: Product, quantity: number = 1) => {
    if (product.type !== "regular") {
      throw new Error("Product is not a regular item");
    }

    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    if (product.stock < quantity) {
      throw new Error("Insufficient stock");
    }

    setCartItems((prev) => {
      const existingItem = prev.find((item) => item.product.id === product.id && !item.weight);

      if (existingItem) {
        // Update quantity
        return prev.map((item) => (item.id === existingItem.id ? updateCartItemQuantity(item, quantity) : item));
      } else {
        // Add new item
        const newItem = createCartItem(product, quantity);
        return [...prev, newItem];
      }
    });
  }, []);

  const addWeightedProduct = useCallback(
    (product: Product, weight: number) => {
      if (product.type !== "weighted") {
        throw new Error("Product is not a weighted item");
      }

      if (!product.pricePerUnit) {
        throw new Error("Weighted product must have price per unit");
      }

      if (weight <= 0) {
        throw new Error("Weight must be greater than 0");
      }

      const totalPrice = weight * product.pricePerUnit;
      const vatAmount = totalPrice * product.vatRate;

      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        product,
        quantity: 1,
        weight,
        totalPrice,
        vatAmount,
        addedAt: new Date(),
      };

      setCartItems((prev) => [...prev, newItem]);
      scaleService.tare(); // Reset scale after adding
    },
    [scaleService]
  );

  const updateCartItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeCartItem(itemId);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId && item.product.type === "regular") {
          if (item.product.stock < quantity) {
            throw new Error("Insufficient stock");
          }
          return updateCartItemQuantity(item, quantity);
        }
        return item;
      })
    );
  }, []);

  const removeCartItem = useCallback((itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    scaleService.tare();
  }, [scaleService]);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.totalPrice, 0);
  }, [cartItems]);

  const getVatBreakdown = useCallback(() => {
    const breakdown = cartItems.reduce((acc, item) => {
      const vatRate = item.product.vatRate;
      if (!acc[vatRate]) {
        acc[vatRate] = { vatRate, total: 0, vatAmount: 0 };
      }
      acc[vatRate].total += item.totalPrice;
      acc[vatRate].vatAmount += item.vatAmount;
      return acc;
    }, {} as Record<number, { vatRate: number; total: number; vatAmount: number }>);

    return Object.values(breakdown);
  }, [cartItems]);

  // Auto-add weighted product when scale is stable and has weight
  useEffect(() => {
    if (selectedProduct?.type === "weighted" && currentScaleReading?.stable && currentScaleReading.weight > 0) {
      addWeightedProduct(selectedProduct, currentScaleReading.weight / 1000); // Convert to kg
      setSelectedProduct(null);
    }
  }, [selectedProduct, currentScaleReading, addWeightedProduct]);

  return {
    cartItems,
    currentScaleReading,
    selectedProduct,
    setSelectedProduct,
    addRegularProduct,
    addWeightedProduct,
    updateCartItemQuantity,
    removeCartItem,
    clearCart,
    getCartTotal,
    getVatBreakdown,
    scaleConnected: scaleService.getConnectionStatus(),
    reconnectScale: () => scaleService.reconnect(),
    tareScale: () => scaleService.tare(),
  };
};

// Helper functions
function createCartItem(product: Product, quantity: number): CartItem {
  const totalPrice = product.price * quantity;
  const vatAmount = totalPrice * product.vatRate;

  return {
    id: `${product.id}-${Date.now()}`,
    product,
    quantity,
    totalPrice,
    vatAmount,
    addedAt: new Date(),
  };
}

function updateCartItemQuantity(item: CartItem, quantity: number): CartItem {
  const totalPrice = item.product.price * quantity;
  const vatAmount = totalPrice * item.product.vatRate;

  return {
    ...item,
    quantity,
    totalPrice,
    vatAmount,
    addedAt: new Date(),
  };
}
```

### 4. Product Catalog Management

```typescript
// hooks/useProductCatalog.ts
import { useState, useCallback } from "react";
import { Product, ProductCategory } from "../types/product";

export const useProductCatalog = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  const addProduct = useCallback((product: Omit<Product, "id">) => {
    const newProduct: Product = {
      ...product,
      id: generateId(),
    };

    setProducts((prev) => [...prev, newProduct]);
    return newProduct;
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    setProducts((prev) => prev.map((product) => (product.id === id ? { ...product, ...updates } : product)));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((product) => product.id !== id));
  }, []);

  const addCategory = useCallback((category: Omit<ProductCategory, "id">) => {
    const newCategory: ProductCategory = {
      ...category,
      id: generateId(),
    };

    setCategories((prev) => [...prev, newCategory]);
    return newCategory;
  }, []);

  const getProductsByCategory = useCallback(
    (categoryId: string) => {
      return products.filter((product) => product.category.id === categoryId);
    },
    [products]
  );

  const getWeightedProducts = useCallback(() => {
    return products.filter((product) => product.type === "weighted");
  }, [products]);

  const getRegularProducts = useCallback(() => {
    return products.filter((product) => product.type === "regular");
  }, [products]);

  return {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    getProductsByCategory,
    getWeightedProducts,
    getRegularProducts,
  };
};

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
```

### 5. Main POS Component

```tsx
// components/POSTerminal.tsx
import React from "react";
import { usePOSCart } from "../hooks/usePOSCart";
import { useProductCatalog } from "../hooks/useProductCatalog";
import { ProductGrid } from "./ProductGrid";
import { CartDisplay } from "./CartDisplay";
import { ScaleDisplay } from "./ScaleDisplay";
import { PaymentPanel } from "./PaymentPanel";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertTriangle, Scale } from "lucide-react";

export const POSTerminal: React.FC = () => {
  const {
    cartItems,
    currentScaleReading,
    selectedProduct,
    setSelectedProduct,
    addRegularProduct,
    updateCartItemQuantity,
    removeCartItem,
    clearCart,
    getCartTotal,
    getVatBreakdown,
    scaleConnected,
    reconnectScale,
    tareScale,
  } = usePOSCart();

  const { products, categories, getWeightedProducts, getRegularProducts } = useProductCatalog();

  const handleProductSelect = (product: Product) => {
    if (product.type === "weighted") {
      setSelectedProduct(product);
      tareScale(); // Reset scale when selecting weighted product
    } else {
      addRegularProduct(product, 1);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Panel - Products */}
      <div className="w-2/3 p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">POS Terminal</h1>
          {!scaleConnected && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Scale disconnected.
                <Button variant="outline" size="sm" onClick={reconnectScale} className="ml-2">
                  Reconnect
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <ProductGrid products={products} categories={categories} onProductSelect={handleProductSelect} />
      </div>

      {/* Right Panel - Cart & Payment */}
      <div className="w-1/3 p-4 space-y-4">
        {/* Scale Display */}
        {selectedProduct?.type === "weighted" && <ScaleDisplay currentReading={currentScaleReading} selectedProduct={selectedProduct} onCancel={() => setSelectedProduct(null)} />}

        {/* Cart Display */}
        <CartDisplay items={cartItems} onUpdateQuantity={updateCartItemQuantity} onRemoveItem={removeCartItem} onClearCart={clearCart} total={getCartTotal()} vatBreakdown={getVatBreakdown()} />

        {/* Payment Panel */}
        <PaymentPanel cartTotal={getCartTotal()} cartItems={cartItems} onPaymentComplete={clearCart} />
      </div>
    </div>
  );
};
```

### 6. Scale Display Component

```tsx
// components/ScaleDisplay.tsx
import React from "react";
import { ScaleReading, Product } from "../types/product";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Scale, AlertTriangle, CheckCircle, X } from "lucide-react";

interface ScaleDisplayProps {
  currentReading: ScaleReading | null;
  selectedProduct: Product;
  onCancel: () => void;
}

export const ScaleDisplay: React.FC<ScaleDisplayProps> = ({ currentReading, selectedProduct, onCancel }) => {
  const getStatusColor = () => {
    if (!currentReading) return "text-gray-500";
    if (currentReading.stable && currentReading.weight > 0) return "text-green-600";
    if (currentReading.weight > 0) return "text-yellow-600";
    return "text-gray-500";
  };

  const getStatusIcon = () => {
    if (!currentReading) return <Scale className="h-4 w-4" />;
    if (currentReading.stable && currentReading.weight > 0) return <CheckCircle className="h-4 w-4" />;
    if (currentReading.weight > 0) return <AlertTriangle className="h-4 w-4" />;
    return <Scale className="h-4 w-4" />;
  };

  const calculatePrice = () => {
    if (!currentReading || !selectedProduct.pricePerUnit) return 0;
    return (currentReading.weight / 1000) * selectedProduct.pricePerUnit;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Weighing: {selectedProduct.name}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-center space-y-2">
          <div className={`text-3xl font-bold ${getStatusColor()}`}>{currentReading ? `${currentReading.weight}${currentReading.unit}` : "0g"}</div>

          <div className="flex items-center justify-center text-sm">
            {getStatusIcon()}
            <span className="ml-1">{!currentReading ? "Waiting for scale..." : currentReading.stable ? "Stable" : "Unstable"}</span>
          </div>

          {currentReading && currentReading.weight > 0 && <div className="text-lg font-semibold">${calculatePrice().toFixed(2)}</div>}

          {currentReading?.stable && currentReading.weight > 0 && (
            <Alert className="mt-2">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Weight stable. Item will be added automatically.</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
```

### Key Features and Mitigations:

#### 1. **Scale Integration**

- Continuous weight monitoring
- Stability detection
- Automatic tare functionality
- Connection status monitoring and reconnection

#### 2. **Product Management**

- Support for both regular and weighted items
- Category-based VAT handling
- Stock management
- Price calculation flexibility

#### 3. **Error Handling**

- Insufficient stock validation
- Scale connectivity issues
- Invalid weight/quantity detection
- Graceful error recovery

#### 4. **Business Logic**

- Accurate VAT calculation and breakdown
- Real-time price updates
- Proper cart management
- Payment processing readiness

#### 5. **User Experience**

- Visual feedback for scale status
- Clear product categorization
- Intuitive cart management
- Responsive design

---

## Part 4: Workflows

*Detailed operational workflows for user interaction with the scale system.*

### Workflow: Adding Weighted Items to POS Cart

### Phase 1: Product Selection

```typescript
// Step 1: Cashier selects weighted product
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCT SELECTION                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
1.1 Cashier browses product catalog
1.2 Identifies weighted product (fruits, vegetables, meats, etc.)
1.3 Clicks on weighted product item
1.4 System recognizes product type as 'weighted'
1.5 System automatically switches to "Scale Mode"
```

### Phase 2: Scale Preparation & Item Weighing

```typescript
// Step 2: Scale initialization and item placement
┌─────────────────────────────────────────────────────────────┐
│                    SCALE PREPARATION                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
2.1 System automatically tares the scale (resets to zero)
2.2 UI displays: "Please place item on scale"
2.3 Scale display shows real-time weight readings
2.4 Cashier places the item on the scale platform
2.5 System detects weight change and starts monitoring
```

### Phase 3: Weight Stabilization & Verification

```typescript
// Step 3: Waiting for stable weight reading
┌─────────────────────────────────────────────────────────────┐
│                  WEIGHT STABILIZATION                       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
3.1 System monitors weight fluctuations
3.2 Weight indicator shows:
    - Flashing/Yellow: Weight unstable
    - Solid/Green: Weight stable
3.3 System checks for consecutive stable readings
3.4 Once stabilized, system calculates:
    - Final weight
    - Total price (weight × price per unit)
    - VAT amount
3.5 UI displays calculated price for confirmation
```

### Phase 4: Item Addition to Cart

```typescript
// Step 4: Automatic cart addition
┌─────────────────────────────────────────────────────────────┐
│                    CART ADDITION                           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
4.1 System automatically adds item to cart with:
    - Product details
    - Measured weight
    - Calculated price
    - VAT breakdown
    - Batch information (if applicable)
4.2 Cart updates in real-time
4.3 System plays confirmation sound/visual feedback
4.4 Scale automatically tares for next item
4.5 System returns to product selection mode
```

### Detailed Step-by-Step with UI States

#### Step 1: **Product Selection**

```tsx
// UI State: Normal product browsing
State: {
  mode: 'browsing',
  selectedProduct: null,
  scaleReading: null
}

Action: Cashier clicks "Apples" (weighted product)
→ System: setSelectedProduct(appleProduct)
→ Transition to: 'weighing_mode'
```

#### Step 2: **Scale Initialization**

```tsx
// UI State: Scale preparation
State: {
  mode: 'weighing',
  selectedProduct: appleProduct,
  scaleReading: { weight: 0, stable: false, unit: 'g' }
}

UI Display:
┌─────────────────────────────────┐
│ 🍎 WEIGHING: Apples            │
│                                 │
│        ⚖️ 0g                    │
│                                 │
│   Please place item on scale   │
│                                 │
│      [Cancel Weighing]         │
└─────────────────────────────────┘

Actions:
- System automatically calls tareScale()
- Scale starts sending weight readings
- Cashier places apples on scale
```

#### Step 3: **Weight Detection & Stabilization**

```tsx
// UI State: Weight detecting
State: {
  mode: 'weighing',
  selectedProduct: appleProduct,
  scaleReading: { weight: 347, stable: false, unit: 'g' }
}

UI Display:
┌─────────────────────────────────┐
│ 🍎 WEIGHING: Apples            │
│                                 │
│        ⚖️ 347g                  │
│        🟡 Unstable             │
│                                 │
│   Weight stabilizing...        │
│                                 │
│      [Cancel Weighing]         │
└─────────────────────────────────┘

Process:
- Weight fluctuates: 345g → 348g → 347g → 347g → 347g
- After 3 consistent readings (±2g): stable = true
```

#### Step 4: **Price Calculation & Confirmation**

```tsx
// UI State: Weight stabilized
State: {
  mode: 'weighing',
  selectedProduct: appleProduct, // pricePerUnit: $5.99/kg
  scaleReading: { weight: 347, stable: true, unit: 'g' }
}

Calculations:
- Weight in kg: 347g / 1000 = 0.347kg
- Price: 0.347 × 5.99 = $2.08
- VAT: $2.08 × 0.05 = $0.10 (assuming 5% VAT)

UI Display:
┌─────────────────────────────────┐
│ 🍎 WEIGHING: Apples            │
│                                 │
│        ⚖️ 347g                  │
│        🟢 Stable               │
│                                 │
│   Price: $2.08                 │
│   (0.347 kg × $5.99/kg)        │
│                                 │
│   Adding to cart... ✅          │
└─────────────────────────────────┘
```

#### Step 5: **Automatic Cart Addition**

```tsx
// System automatically executes:
addWeightedProduct(appleProduct, 0.347);

// Cart item created:
{
  id: "apple-123456789",
  product: appleProduct,
  quantity: 1,
  weight: 0.347,
  totalPrice: 2.08,
  vatAmount: 0.10,
  addedAt: "2024-01-15T10:30:00.000Z"
}

// UI State: Success confirmation
State: {
  mode: 'browsing',
  selectedProduct: null,
  scaleReading: null
}

UI Feedback:
- Cart updates: +1 item, total increases by $2.08
- Brief "✅ Added to cart" notification
- Scale automatically tared (reset to zero)
```

### Error Scenarios & Recovery

#### Scenario A: **Unstable Weight**

```typescript
Workflow:
1. Weight keeps fluctuating beyond threshold
2. System waits for 10 seconds maximum
3. If not stabilized, shows:
   ┌─────────────────────────────────┐
   │ ⚠️  Weight Unstable             │
   │                                 │
   │ Please ensure item is:          │
   │ • Properly placed               │
   │ • Not moving                    │
   │ • Not overflowing               │
   │                                 │
   │ [Retry] [Enter Weight Manually] │
   └─────────────────────────────────┘
```

#### Scenario B: **Scale Disconnected**

```typescript
Workflow:
1. System detects scale disconnection
2. Shows immediate notification:
   ┌─────────────────────────────────┐
   │ ❌ Scale Disconnected           │
   │                                 │
   │ Please:                         │
   │ 1. Check scale power            │
   │ 2. Ensure USB connection        │
   │ 3. Try reconnecting             │
   │                                 │
   │ [Reconnect] [Enter Manually]    │
   └─────────────────────────────────┘
```

#### Scenario C: **Zero or Negative Weight**

```typescript
Workflow:
1. Scale shows zero/negative weight after placement
2. System detects and shows:
   ┌─────────────────────────────────┐
   │ ⚠️  No Weight Detected          │
   │                                 │
   │ Please:                         │
   │ • Ensure item is on scale       │
   │ • Check if scale needs reset    │
   │ • Remove any previous items     │
   │                                 │
   │ [Retry] [Cancel]                │
   └─────────────────────────────────┘
```

### Complete Workflow Sequence Diagram

```
Cashier          POS System          Scale Hardware
  │                   │                    │
  │─1. Select weighted product→│                    │
  │                   │─2. Tare scale─────→│
  │                   │←─────Weight: 0g────│
  │                   │                    │
  │─3. Place item on scale→│                    │
  │                   │                    │─4. Detect weight──→│
  │                   │←────Weight: 347g───│
  │                   │─5. Monitor stability→│
  │                   │←──Weight: stable───│
  │                   │─6. Calculate price │
  │                   │─7. Add to cart─────│
  │                   │─8. Tare scale─────→│
  │←9. Show confirmation─│                    │
  │                   │                    │
```

### Key Success Indicators

1. **Smooth Transitions**: No manual steps between product selection and weighing
2. **Automatic Handling**: No "Add to Cart" button needed for weighted items
3. **Real-time Feedback**: Immediate visual feedback for all scale states
4. **Error Recovery**: Clear paths for all failure scenarios
5. **Audit Trail**: Complete record of weight, price calculations, and timing
