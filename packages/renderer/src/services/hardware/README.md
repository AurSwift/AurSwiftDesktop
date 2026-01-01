# Hardware Services

Hardware integration services for the aurswift POS application.

## Overview

This directory contains infrastructure-level hardware integration services, separate from business domain features. These services provide abstraction over hardware devices and can be used by any feature in the application.

## Structure

```
services/hardware/
├── scanner/          # Barcode scanner integration
├── printer/          # Thermal printer integration
├── scale/            # Scale device integration
├── payment/          # Payment hardware (placeholder)
└── index.ts          # Central export
```

## Services

### Scanner (`scanner/`)

Barcode scanner hardware integration via keyboard emulation.

**Hook**: `useProductionScanner`

```tsx
import { useProductionScanner } from "@/services/hardware/scanner";

const { scannerStatus, scanLog, manualScan } = useProductionScanner({
  onScan: async (barcode) => {
    // Handle scanned barcode
    return true;
  },
});
```

### Printer (`printer/`)

Thermal receipt printer integration.

**Hooks**:

- `useThermalPrinter` - Main printer operations
- `usePrinterSetup` - Printer setup dialog management
- `useReceiptPrintingFlow` - Receipt printing flow

```tsx
import { useThermalPrinter } from "@/services/hardware/printer";

const { printReceipt, isConnected, printStatus } = useThermalPrinter();
```

### Scale (`scale/`)

Scale device integration for weight-based products.

**Hook**: `useScaleManager`

```tsx
import { useScaleManager } from "@/services/hardware/scale";

const { scaleStatus, currentReading, connectToScale, isConnected } = useScaleManager();
```

### Payment (`payment/`)

Placeholder for future payment hardware integrations (Stripe Terminal, etc.).

## Usage

### Direct Import

```tsx
import { useProductionScanner } from "@/services/hardware/scanner";
import { useThermalPrinter } from "@/services/hardware/printer";
import { useScaleManager } from "@/services/hardware/scale";
```

### Central Export

```tsx
import { useProductionScanner, useThermalPrinter, useScaleManager } from "@/services/hardware";
```

## Architecture

These services follow the **Hexagonal Architecture** pattern:

- **Infrastructure Layer**: Hardware integrations are adapters
- **Separation of Concerns**: Hardware code is separate from business logic
- **Reusability**: Services can be used by any feature
- **Testability**: Hardware services can be easily mocked

## Migration Notes

This structure was migrated from:

- `features/barcode-scanner/` → `services/hardware/scanner/`
- `features/sales/hooks/use-thermal-printer.ts` → `services/hardware/printer/hooks/`
- `shared/hooks/use-scale-manager.ts` → `services/hardware/scale/hooks/`

All hardware hooks should be imported directly from `@/services/hardware` or `@/services/hardware/{service}`.

## Best Practices

1. **Import directly from hardware services**: Use `@/services/hardware/{service}` for new code
2. **Don't mix hardware and business logic**: Keep hardware concerns separate
3. **Mock for testing**: Hardware services should be mocked in unit tests
4. **Error handling**: Always handle hardware connection errors gracefully

## Related Documentation

- [Hardware Integration Architecture](../../features/docs/HARDWARE_INTEGRATION_ARCHITECTURE.md)
- [Feature Structure Guide](../../features/docs/FEATURE_STRUCTURE.md)
