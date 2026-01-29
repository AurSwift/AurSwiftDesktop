# Viva Wallet Local Terminal API Integration Plan

## Executive Summary

This document outlines a comprehensive, strategic plan for integrating Viva Wallet's Local Terminal API into the AuraSwift Electron.js POS system. The integration will enable peer-to-peer communication between the POS application and Viva Wallet payment terminals over local network, providing a seamless, secure payment processing experience.

**Key Objectives:**

- Enable card payment processing through Viva Wallet terminals
- Support device-as-terminal capability (turn any compatible device into a payment terminal)
- Maintain compatibility with existing payment methods (cash, mobile, voucher, split)
- Ensure PCI DSS compliance and security best practices
- Provide robust error handling and transaction recovery
- Support refunds and transaction management through terminal API
- Design for easy extensibility (card reader attachments, future device types)

**Integration Type:** Local Terminal API (Peer-to-Peer Communication)
**Communication Protocol:** HTTP/HTTPS over Local Network
**Supported Devices:** Android devices running Viva.com Terminal app, iOS with Apple Tap to Pay, Paydroid devices

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Viva Wallet Local Terminal API Overview](#viva-wallet-local-terminal-api-overview)
3. [Integration Architecture Design](#integration-architecture-design)
4. [Device-as-Terminal Implementation Guide](#device-as-terminal-implementation-guide)
5. [Implementation Strategy](#implementation-strategy)
6. [Technical Specifications](#technical-specifications)
7. [Security & Compliance](#security--compliance)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Plan](#deployment-plan)
11. [Risk Management](#risk-management)
12. [Timeline & Phases](#timeline--phases)

---

## Current Architecture Analysis

### Existing Payment System

**Current Payment Service Location:**

- `packages/main/src/services/paymentService.ts`
- Handles BBPOS WisePad 3 card reader integration
- Supports USB/HID and Bluetooth connections
- Simulated mode for development/testing

**Payment Methods Currently Supported:**

- `cash` - Cash transactions
- `card` - Card payments (currently via BBPOS reader)
- `mobile` - Mobile payment methods
- `voucher` - Voucher/credit transactions
- `split` - Split payment methods

**Transaction Schema:**

```typescript
paymentMethod: "cash" | "card" | "mobile" | "voucher" | "split";
```

**IPC Communication:**

- Preload API: `packages/preload/src/api/system.ts`
- IPC Handlers: `packages/main/src/services/paymentService.ts`
- Payment Flow: `packages/renderer/src/features/sales/services/payment-flow.ts`

### Key Components Identified

1. **PaymentService Class** - Main payment processing service
2. **IPC Handlers** - Communication bridge between main and renderer processes
3. **Payment Flow State Machine** - Manages payment workflow in renderer
4. **Transaction Manager** - Database operations for transactions
5. **Receipt Generator** - Generates payment receipts

### Integration Points

- ✅ Existing payment service can be extended
- ✅ IPC handlers follow consistent pattern
- ✅ Transaction schema supports card payments
- ✅ Payment flow can accommodate new payment providers
- ✅ Error handling infrastructure exists
- ✅ Hardware abstraction patterns exist (see ScaleService, PaymentService)
- ✅ Device capability detection patterns available

---

## Viva Wallet Local Terminal API Overview

### What is Local Terminal API?

The Viva Wallet Local Terminal API enables **peer-to-peer communication** between your ECR (Electronic Cash Register) system and EFT POS terminals on the same local network. This allows direct transaction initiation without going through external payment gateways for the communication layer.

### Key Concepts

1. **Peer-to-Peer Communication**

   - Direct HTTP/HTTPS communication between POS app and terminal
   - No external API gateway required for transaction initiation
   - Terminal acts as both payment processor and hardware interface

2. **Transaction Flow**

   ```
   POS App → HTTP Request → Terminal (Local IP) → Payment Processing
   POS App ← HTTP Response ← Terminal ← Status Updates (Polling)
   ```

3. **Supported Operations**
   - **Sales** - Process card payments
   - **Refunds** - Process refunds to original payment method
   - **Cancellations** - Cancel pending transactions
   - **Status Queries** - Check transaction status

### Device Compatibility

**Supported Terminals:**

- Android devices running Viva.com Terminal application
- iOS devices with Apple Tap to Pay support
- Paydroid devices (PAX A920 Pro, A35, A80) with Android 10+
- **Note:** Paydroid devices do NOT support peer-to-peer with REST API

### Device-as-Terminal Capability (Key Feature)

**Core Concept:**
One of the most powerful features of Viva Wallet's Local Terminal API is the ability to **turn any compatible device into a payment terminal** using the Viva.com Terminal application. This enables flexible deployment scenarios without requiring dedicated hardware.

**Supported Scenarios:**

1. **Smartphone/Tablet as Terminal**

   - Android or iOS device running Viva.com Terminal app
   - Acts as standalone payment terminal
   - Can accept card payments via NFC/Tap-to-Pay
   - Ideal for mobile/market stall scenarios

2. **Device with External Card Reader**

   - Compatible device + external card reader attachment
   - Enhanced card acceptance (chip, swipe, tap)
   - Better for high-volume scenarios
   - Supports all card types more reliably

3. **Hybrid Deployment**
   - Mix of dedicated terminals and device-based terminals
   - Flexibility to scale up/down based on needs
   - Cost-effective for small businesses

**Implementation Flexibility:**

- ✅ Can be easily implemented as an extension to the core integration
- ✅ Same API endpoints work regardless of terminal type
- ✅ No special handling required in POS application
- ✅ Future-proof architecture supports any terminal configuration

### Terminal Configuration Requirements

1. **Enable Peer-to-Peer Mode**

   - Open Viva.com Terminal app
   - Navigate to: **More > Integrations > Viva Peer to Peer**
   - Toggle **Enable Peer to Peer** to ON
   - Select operation mode
   - Set PIN (if required)

2. **Network Configuration**

   - Terminal must be on same local network as POS system
   - Note terminal's IP address and port
   - Ensure firewall allows communication on terminal port

3. **Authentication**
   - API key or authentication token (configured in terminal)
   - PIN protection for sensitive operations

---

## Integration Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AuraSwift POS (Electron)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Renderer Process (React/TypeScript)          │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │     Payment Flow UI Components                   │  │ │
│  │  │     - Payment Method Selector                    │  │ │
│  │  │     - Transaction Status Display                 │  │ │
│  │  │     - Terminal Selection (Optional)              │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↕ IPC                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Main Process (Node.js)                       │  │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │     VivaWalletService                            │  │ │
│  │  │     - Terminal Discovery                         │  │ │
│  │  │     - Transaction Processing                     │  │ │
│  │  │     - Status Polling                             │  │ │
│  │  │     - Error Recovery                             │  │ │
│  │  │     - Device-as-Terminal Support                 │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │     PaymentService (Existing)                    │  │ │
│  │  │     - Payment Provider Abstraction               │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↕ HTTP/HTTPS
                    (Local Network)
┌─────────────────────────────────────────────────────────────┐
│        Viva Wallet Terminal Device(s) - Flexible Options     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Option 1: Dedicated Terminal Device                   │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Paydroid/PAX Device                             │  │ │
│  │  │  - Hardware Terminal                             │  │ │
│  │  │  - Viva.com Terminal App                         │  │ │
│  │  │  - Built-in Card Reader                          │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Option 2: Smartphone/Tablet as Terminal              │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Android/iOS Device                              │  │ │
│  │  │  - Viva.com Terminal App                         │  │ │
│  │  │  - NFC/Tap-to-Pay (No Card Reader)               │  │ │
│  │  │  - Flexible Deployment                           │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Option 3: Device + External Card Reader              │  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Compatible Device                               │  │ │
│  │  │  - Viva.com Terminal App                         │  │ │
│  │  │  - External Card Reader (USB/Bluetooth)          │  │ │
│  │  │  - Enhanced Card Acceptance                      │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

All Terminal Types Use Same API Endpoints:
  • Same transaction flow
  • Same status polling
  • Same error handling
  • Transparent to POS application
```

### Service Architecture

#### 1. VivaWalletService (New Service)

**Location:** `packages/main/src/services/vivaWalletService.ts`

**Responsibilities:**

- Terminal discovery on local network
- Transaction initiation and management
- Status polling and event handling
- Error handling and retry logic
- Connection management

**Key Methods:**

```typescript
class VivaWalletService {
  // Terminal Management
  discoverTerminals(): Promise<Terminal[]>;
  connect(terminal: Terminal): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<TerminalStatus>;

  // Device-as-Terminal Support
  detectDeviceCapabilities(terminal: Terminal): Promise<DeviceCapabilities>;
  isDeviceBasedTerminal(terminal: Terminal): boolean;
  supportsCardReader(terminal: Terminal): Promise<boolean>;

  // Transaction Operations
  initiateSale(amount: number, currency: string): Promise<Transaction>;
  initiateRefund(transactionId: string, amount: number): Promise<Transaction>;
  cancelTransaction(transactionId: string): Promise<void>;

  // Status & Polling
  pollTransactionStatus(transactionId: string): Promise<TransactionStatus>;
  getTransactionDetails(transactionId: string): Promise<TransactionDetails>;
}
```

**Device-as-Terminal Features:**

- Automatic terminal type detection (dedicated vs. device-based)
- Capability detection (NFC-only vs. full card reader support)
- Unified interface regardless of terminal type
- Future-ready for additional device configurations

#### 2. Payment Provider Abstraction Layer

**Location:** `packages/main/src/services/paymentService.ts` (Extended)

**Pattern:** Strategy Pattern for payment providers

**Current Providers:**

- `BBPOSProvider` - BBPOS WisePad 3 reader
- `SimulatedProvider` - Development/testing

**New Provider:**

- `VivaWalletProvider` - Viva Wallet Terminal API

**Benefits:**

- Unified payment interface
- Easy provider switching
- Consistent error handling
- Shared transaction logging

#### 3. IPC Communication Layer

**Location:** `packages/preload/src/api/system.ts` (Extended)

**New IPC Handlers:**

```typescript
export const vivaWalletAPI = {
  // Terminal Discovery
  discoverTerminals: () => ipcRenderer.invoke("viva:discover-terminals"),
  connectTerminal: (terminalId: string) => ipcRenderer.invoke("viva:connect-terminal", terminalId),
  disconnectTerminal: () => ipcRenderer.invoke("viva:disconnect-terminal"),
  getTerminalStatus: () => ipcRenderer.invoke("viva:terminal-status"),

  // Transactions
  initiateSale: (amount: number, currency: string) => ipcRenderer.invoke("viva:initiate-sale", amount, currency),
  initiateRefund: (transactionId: string, amount: number) => ipcRenderer.invoke("viva:initiate-refund", transactionId, amount),
  cancelTransaction: (transactionId: string) => ipcRenderer.invoke("viva:cancel-transaction", transactionId),

  // Status
  getTransactionStatus: (transactionId: string) => ipcRenderer.invoke("viva:transaction-status", transactionId),
};
```

#### 4. Payment Flow Integration

**Location:** `packages/renderer/src/features/sales/services/payment-flow.ts` (Extended)

**Integration Points:**

- Add Viva Wallet as payment option in payment method selector
- Integrate transaction polling in payment flow state machine
- Handle terminal-specific error messages
- Display transaction status updates
- Show terminal type indicators (device-based vs. dedicated)

---

## Device-as-Terminal Implementation Guide

### Overview

The device-as-terminal capability allows any compatible smartphone, tablet, or device running the Viva.com Terminal app to function as a payment terminal. This provides maximum flexibility and cost-effectiveness for businesses of all sizes.

### Implementation Strategy

#### Phase 1: Core Support (Initial Implementation)

**Goal:** Establish foundation that works with all terminal types transparently.

**Approach:**

1. **Unified Terminal Interface**

   - Design terminal abstraction that doesn't differentiate between terminal types
   - Same API calls work for dedicated terminals and device-based terminals
   - Terminal type detection is informational only

2. **Capability Detection**

   - Query terminal capabilities on connection
   - Store capability metadata for UI/UX optimization
   - Gracefully handle differences (e.g., NFC-only devices)

3. **Future-Ready Architecture**
   - Design extensible for additional device configurations
   - Support card reader attachments as optional enhancement
   - No breaking changes when adding new terminal types

#### Phase 2: Enhanced Device Support (Future Enhancement)

**Goal:** Optimize for device-based terminal specific features.

**Potential Enhancements:**

- Device-specific UI optimizations
- Enhanced status indicators for mobile terminals
- Battery level monitoring for device terminals
- Location-based terminal discovery (for mobile scenarios)
- Multi-device terminal management

### Best Practices for Device-as-Terminal

#### 1. **Terminal Type Agnostic Design**

✅ **DO:**

- Use unified transaction API regardless of terminal type
- Query capabilities dynamically, don't hardcode assumptions
- Handle all terminal types through same code paths
- Display terminal type information to users for clarity

❌ **DON'T:**

- Create separate code paths for different terminal types
- Assume all terminals have card readers
- Hardcode terminal-specific behavior
- Limit functionality based on terminal type unnecessarily

**Example:**

```typescript
// ✅ GOOD: Unified interface
async processPayment(terminal: Terminal, amount: number) {
  // Same flow for all terminal types
  const transaction = await this.initiateSale(terminal, amount);
  return await this.pollForCompletion(transaction);
}

// ❌ BAD: Terminal-type specific code
async processPayment(terminal: Terminal, amount: number) {
  if (terminal.type === 'device-based') {
    // Different logic for device terminals
  } else {
    // Different logic for dedicated terminals
  }
}
```

#### 2. **Capability-Based Feature Access**

✅ **DO:**

- Check terminal capabilities before enabling features
- Provide clear UI feedback about supported payment methods
- Gracefully degrade functionality for limited-capability terminals
- Use capability metadata to optimize user experience

**Implementation:**

```typescript
interface PaymentCapability {
  supportsNFC: boolean;
  supportsCardReader: boolean;
  supportsChip: boolean;
  supportsSwipe: boolean;
  supportsTap: boolean;
}

function canProcessChipPayment(terminal: Terminal): boolean {
  return terminal.paymentCapabilities.supportsChip;
}

function getAvailablePaymentMethods(terminal: Terminal): string[] {
  const methods: string[] = [];
  if (terminal.paymentCapabilities.supportsTap) methods.push("Tap");
  if (terminal.paymentCapabilities.supportsChip) methods.push("Chip");
  if (terminal.paymentCapabilities.supportsSwipe) methods.push("Swipe");
  return methods;
}
```

#### 3. **Terminal Discovery Best Practices**

✅ **DO:**

- Support multiple discovery methods (network scan, mDNS, manual entry)
- Cache discovered terminals with capability metadata
- Provide terminal type indicators in discovery results
- Allow manual terminal configuration for flexibility

**Discovery Strategy:**

```typescript
class TerminalDiscovery {
  async discoverTerminals(): Promise<Terminal[]> {
    const terminals: Terminal[] = [];

    // Method 1: Network scanning
    terminals.push(...(await this.scanNetwork()));

    // Method 2: mDNS/Bonjour discovery (for device-based terminals)
    terminals.push(...(await this.discoverViaMDNS()));

    // Method 3: Previously configured terminals
    terminals.push(...(await this.loadConfiguredTerminals()));

    // Detect capabilities for each terminal
    for (const terminal of terminals) {
      terminal.capabilities = await this.detectCapabilities(terminal);
    }

    return this.deduplicate(terminals);
  }
}
```

#### 4. **Configuration Flexibility**

✅ **DO:**

- Support both automatic and manual terminal configuration
- Store terminal configurations securely (encrypted API keys)
- Allow configuration of multiple terminals
- Support terminal profile management

**Configuration Storage:**

```typescript
interface TerminalConfig {
  id: string;
  name: string; // User-friendly name (e.g., "Counter Tablet", "Mobile Terminal")
  ipAddress: string;
  port: number;
  apiKey: string; // Encrypted in storage
  enabled: boolean;
  autoConnect: boolean;
  terminalType: "dedicated" | "device-based";
  deviceInfo?: DeviceInfo; // Optional: device model, platform
  lastSeen?: Date;
}
```

#### 5. **Error Handling for Device Terminals**

✅ **DO:**

- Handle device-specific errors (battery low, app closed, etc.)
- Provide clear guidance for device terminal issues
- Support reconnection for mobile devices
- Handle network changes gracefully

**Device-Specific Error Handling:**

```typescript
class DeviceTerminalErrorHandler {
  handleError(error: Error, terminal: Terminal): UserMessage {
    if (terminal.terminalType === "device-based") {
      // Device-specific error messages
      if (error.code === "DEVICE_OFFLINE") {
        return {
          message: "Terminal device appears to be offline. Please ensure:",
          suggestions: ["Device is powered on", "Viva.com Terminal app is running", "Device is connected to the same network", "Peer-to-peer mode is enabled in the app"],
        };
      }
    }

    // Generic error handling for all terminal types
    return this.handleGenericError(error);
  }
}
```

#### 6. **UI/UX Considerations**

✅ **DO:**

- Display terminal type and capabilities in UI
- Show connection status for each terminal
- Provide terminal selection when multiple terminals available
- Indicate payment methods supported by selected terminal

**UI Component Example:**

```typescript
interface TerminalSelectorProps {
  terminals: Terminal[];
  selectedTerminal: Terminal | null;
  onSelect: (terminal: Terminal) => void;
}

function TerminalSelector({ terminals, selectedTerminal, onSelect }: TerminalSelectorProps) {
  return (
    <div>
      {terminals.map((terminal) => (
        <TerminalCard key={terminal.id} terminal={terminal} selected={selectedTerminal?.id === terminal.id} onClick={() => onSelect(terminal)}>
          <TerminalIcon type={terminal.terminalType} />
          <TerminalName>{terminal.name}</TerminalName>
          <TerminalStatus status={terminal.status} />
          <CapabilityBadges capabilities={terminal.paymentCapabilities} />
        </TerminalCard>
      ))}
    </div>
  );
}
```

### Implementation Phases

#### **Initial Implementation (Core Integration)**

Focus on making device-as-terminal work transparently:

- ✅ Terminal discovery works for all terminal types
- ✅ Same transaction API for all terminals
- ✅ Basic capability detection
- ✅ Terminal type stored in metadata

**Timeline:** Included in Phase 2 (Core Transaction Processing)

#### **Enhanced Implementation (Future Enhancement)**

Optimize specifically for device-based terminals:

- ⏭️ Enhanced device capability detection
- ⏭️ Device-specific UI optimizations
- ⏭️ Battery level monitoring
- ⏭️ Mobile-specific features (location, multi-device)

**Timeline:** Can be added in Phase 7 (Post-Deployment Enhancements)

### Architecture Benefits

1. **Future-Proof:** Easy to add new terminal types without refactoring
2. **Flexible:** Supports any device configuration
3. **Cost-Effective:** Businesses can start with device-based terminals
4. **Scalable:** Can mix device-based and dedicated terminals
5. **User-Friendly:** Clear indication of terminal capabilities

### Testing Considerations

**Device-as-Terminal Testing:**

- Test with Android smartphone/tablet
- Test with iOS device (if Tap to Pay available)
- Test NFC-only functionality
- Test with external card reader attachment
- Test network connectivity scenarios
- Test app lifecycle (background/foreground)
- Test battery level handling

### Security Considerations

**Device Terminal Security:**

- API keys stored securely on device
- Network communication over local network only
- Terminal app PIN protection (if enabled)
- No card data stored on device
- Secure terminal authentication

---

## Implementation Strategy

### Phase 1: Foundation & Infrastructure (Week 1-2)

#### 1.1 Create VivaWalletService Structure

**Files to Create:**

- `packages/main/src/services/vivaWalletService.ts` - Main service class
- `packages/main/src/services/vivaWallet/types.ts` - TypeScript interfaces
- `packages/main/src/services/vivaWallet/config.ts` - Configuration management
- `packages/main/src/services/vivaWallet/terminal-discovery.ts` - Terminal discovery logic
- `packages/main/src/services/vivaWallet/transaction-manager.ts` - Transaction processing
- `packages/main/src/services/vivaWallet/http-client.ts` - HTTP client with retry logic
- `packages/main/src/services/vivaWallet/error-handler.ts` - Error handling utilities
- `packages/main/src/services/vivaWallet/index.ts` - Public API exports

**Directory Structure:**

```
packages/main/src/services/vivaWallet/
├── index.ts                    # Public API exports
├── types.ts                    # Type definitions
├── config.ts                   # Configuration management
├── http-client.ts              # HTTP client wrapper
├── error-handler.ts            # Error handling utilities
├── terminal-discovery.ts       # Terminal discovery & capabilities
├── transaction-manager.ts      # Transaction lifecycle management
└── vivaWalletService.ts        # Main service orchestrator
```

**Detailed Implementation Tasks:**

**1.1.1 Type Definitions (`types.ts`)**

- [ ] Define `Terminal` interface with device-as-terminal properties
- [ ] Define `TerminalCapabilities` interface
- [ ] Define `VivaWalletSaleRequest` interface
- [ ] Define `VivaWalletTransactionResponse` interface
- [ ] Define `TransactionStatus` interface
- [ ] Define `TerminalConfig` interface
- [ ] Define `VivaWalletConfig` interface
- [ ] Define error type interfaces (NetworkError, TerminalError, TransactionError)
- [ ] Define event type interfaces for status updates
- [ ] Export all types for use across the codebase

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/types.ts

export interface Terminal {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: "online" | "offline" | "busy";
  firmwareVersion?: string;
  capabilities: string[];
  lastSeen: Date;
  connectionType: "wifi" | "ethernet";

  // Device-as-Terminal Properties
  terminalType: "dedicated" | "device-based";
  deviceInfo?: {
    platform: "android" | "ios" | "paydroid";
    deviceModel?: string;
    osVersion?: string;
  };
  paymentCapabilities: {
    supportsNFC: boolean;
    supportsCardReader: boolean;
    supportsChip: boolean;
    supportsSwipe: boolean;
    supportsTap: boolean;
  };
  apiKey?: string; // Optional, stored separately in config
}

export interface TerminalCapabilities {
  isDeviceBased: boolean;
  deviceType?: "android" | "ios" | "paydroid";
  hasCardReader: boolean;
  supportedPaymentMethods: ("tap" | "chip" | "swipe")[];
  nfcEnabled: boolean;
}

// ... additional type definitions
```

**1.1.2 HTTP Client (`http-client.ts`)**

- [ ] Create `VivaWalletHTTPClient` class
- [ ] Implement axios instance with base configuration
- [ ] Add request/response interceptors
- [ ] Implement exponential backoff retry logic
- [ ] Add timeout handling (connection, request, response)
- [ ] Implement error classification (network, timeout, API errors)
- [ ] Add request logging (excluding sensitive data)
- [ ] Implement circuit breaker pattern for failed terminals
- [ ] Add connection pooling support
- [ ] Support both HTTP and HTTPS (with certificate validation)

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/http-client.ts

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { getLogger } from "../../utils/logger.js";
import { RetryManager } from "./error-handler.js";

const logger = getLogger("VivaWalletHTTPClient");

export class VivaWalletHTTPClient {
  private client: AxiosInstance;
  private terminal: Terminal;
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.retryManager = new RetryManager();
    this.client = this.createAxiosInstance();
    this.setupInterceptors();
  }

  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: `http://${this.terminal.ipAddress}:${this.terminal.port}`,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${this.terminal.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  // ... implementation details
}
```

**1.1.3 Error Handler (`error-handler.ts`)**

- [ ] Create error classification system
- [ ] Implement `RetryManager` class with exponential backoff
- [ ] Create `NetworkErrorHandler` class
- [ ] Create `TerminalErrorHandler` class
- [ ] Create `TransactionErrorHandler` class
- [ ] Implement user-friendly error message mapping
- [ ] Add error logging with context
- [ ] Create error recovery strategies
- [ ] Implement circuit breaker logic

**1.1.4 Configuration Management (`config.ts`)**

- [ ] Create `VivaWalletConfigManager` class
- [ ] Implement configuration loading from file/database
- [ ] Add configuration validation
- [ ] Implement secure API key storage (using Electron safeStorage)
- [ ] Add configuration encryption/decryption
- [ ] Implement configuration defaults
- [ ] Add configuration migration support (for future changes)
- [ ] Create configuration schema validation

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/config.ts

import { safeStorage } from "electron";
import { getLogger } from "../../utils/logger.js";
import { getDatabase } from "../../database/index.js";

const logger = getLogger("VivaWalletConfig");

export class VivaWalletConfigManager {
  private configCache: VivaWalletConfig | null = null;

  async loadConfig(): Promise<VivaWalletConfig> {
    // Load from database or config file
    // Decrypt API keys
    // Validate schema
    // Return validated config
  }

  async saveConfig(config: VivaWalletConfig): Promise<void> {
    // Encrypt sensitive data
    // Validate before saving
    // Save to database/file
    // Update cache
  }

  private encryptApiKey(key: string): Buffer {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Safe storage encryption not available");
    }
    return safeStorage.encryptString(key);
  }
}
```

**1.1.5 Terminal Discovery (`terminal-discovery.ts`)**

- [ ] Create `TerminalDiscovery` class
- [ ] Implement network scanning algorithm (IP range scanning)
- [ ] Add mDNS/Bonjour discovery support (optional, for device-based terminals)
- [ ] Implement terminal capability detection
- [ ] Add terminal type detection (dedicated vs. device-based)
- [ ] Implement terminal fingerprinting (unique identification)
- [ ] Add terminal caching mechanism
- [ ] Implement connection health checks
- [ ] Add terminal deduplication logic
- [ ] Support manual terminal addition

**1.1.6 Transaction Manager (`transaction-manager.ts`)**

- [ ] Create `TransactionManager` class
- [ ] Implement transaction initiation logic
- [ ] Add transaction state machine
- [ ] Implement status polling mechanism
- [ ] Add transaction timeout handling
- [ ] Implement transaction cancellation
- [ ] Add transaction recovery logic
- [ ] Create transaction event emitter
- [ ] Implement transaction queue (for concurrent transactions)

**1.1.7 Main Service Class (`vivaWalletService.ts`)**

- [ ] Create `VivaWalletService` class following existing service patterns
- [ ] Set up IPC handlers in constructor
- [ ] Integrate all sub-components (discovery, transaction manager, etc.)
- [ ] Implement singleton pattern or service registration
- [ ] Add service lifecycle management (init, shutdown)
- [ ] Implement event broadcasting to renderer process
- [ ] Add health monitoring
- [ ] Implement graceful error handling

**Implementation Pattern (Following ScaleService/OfficePrinterService):**

```typescript
// packages/main/src/services/vivaWalletService.ts

import { ipcMain } from "electron";
import { getLogger } from "../utils/logger.js";
import { TerminalDiscovery } from "./vivaWallet/terminal-discovery.js";
import { TransactionManager } from "./vivaWallet/transaction-manager.js";
import { VivaWalletConfigManager } from "./vivaWallet/config.js";

const logger = getLogger("VivaWalletService");

export class VivaWalletService {
  private terminalDiscovery: TerminalDiscovery;
  private transactionManager: TransactionManager;
  private configManager: VivaWalletConfigManager;
  private connectedTerminal: Terminal | null = null;
  private isInitialized = false;

  constructor() {
    this.terminalDiscovery = new TerminalDiscovery();
    this.transactionManager = new TransactionManager();
    this.configManager = new VivaWalletConfigManager();
    this.setupIpcHandlers();
    logger.info("VivaWalletService initialized");
  }

  private setupIpcHandlers(): void {
    // Terminal Discovery
    ipcMain.handle("viva:discover-terminals", async () => {
      return await this.terminalDiscovery.discoverTerminals();
    });

    // Terminal Connection
    ipcMain.handle("viva:connect-terminal", async (event, terminalId: string) => {
      return await this.connectTerminal(terminalId);
    });

    // Transaction Operations
    ipcMain.handle("viva:initiate-sale", async (event, amount: number, currency: string) => {
      return await this.transactionManager.initiateSale(amount, currency);
    });

    // ... additional IPC handlers
  }

  // ... service methods
}
```

**1.1.8 Logging Infrastructure**

- [ ] Set up Winston logger for Viva Wallet service
- [ ] Create log categories (discovery, transaction, errors)
- [ ] Implement structured logging
- [ ] Add log rotation configuration
- [ ] Exclude sensitive data from logs (API keys, card data)
- [ ] Add log levels (debug, info, warn, error)
- [ ] Implement audit logging for transactions
- [ ] Add performance logging for monitoring

**1.1.9 Public API Exports (`index.ts`)**

- [ ] Export main service class
- [ ] Export all public types
- [ ] Export error classes
- [ ] Export configuration interfaces
- [ ] Create singleton instance export (if using singleton pattern)
- [ ] Add JSDoc documentation for all exports

**Testing Tasks:**

- [ ] Create unit test structure
- [ ] Write tests for type definitions
- [ ] Mock HTTP client for testing
- [ ] Test error handling paths
- [ ] Test configuration loading/saving

#### 1.2 Extend Payment Provider Abstraction

**Files to Create:**

- `packages/main/src/services/payment/providers/payment-provider.interface.ts` - Provider interface
- `packages/main/src/services/payment/providers/bbpos-provider.ts` - Refactored BBPOS provider
- `packages/main/src/services/payment/providers/viva-wallet-provider.ts` - New Viva Wallet provider
- `packages/main/src/services/payment/providers/provider-factory.ts` - Provider factory
- `packages/main/src/services/payment/providers/simulated-provider.ts` - Refactored simulated provider

**Files to Modify:**

- `packages/main/src/services/paymentService.ts` - Refactor to use provider abstraction
- `types/payment.d.ts` - Add provider types and viva_wallet payment method

**Detailed Implementation Tasks:**

**1.2.1 Create Payment Provider Interface**

- [ ] Define `IPaymentProvider` interface with standard methods:
  - `initialize(config: ProviderConfig): Promise<void>`
  - `createPaymentIntent(data: PaymentIntentData): Promise<PaymentIntentResult>`
  - `processPayment(intentId: string): Promise<PaymentResult>`
  - `cancelPayment(intentId: string): Promise<void>`
  - `processRefund(transactionId: string, amount: number): Promise<RefundResult>`
  - `getStatus(): Promise<ProviderStatus>`
  - `discoverDevices(): Promise<Device[]>`
- [ ] Define common types for provider interface
- [ ] Add provider capability flags (supportsRefunds, supportsCancellation, etc.)
- [ ] Define provider error types

**Implementation Example:**

```typescript
// packages/main/src/services/payment/providers/payment-provider.interface.ts

export interface IPaymentProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  initialize(config: ProviderConfig): Promise<void>;
  createPaymentIntent(data: PaymentIntentData): Promise<PaymentIntentResult>;
  processPayment(intentId: string): Promise<PaymentResult>;
  cancelPayment(intentId: string): Promise<void>;
  processRefund(transactionId: string, amount: number): Promise<RefundResult>;
  getStatus(): Promise<ProviderStatus>;
  discoverDevices(): Promise<Device[]>;
  disconnect(): Promise<void>;
}

export interface ProviderCapabilities {
  supportsRefunds: boolean;
  supportsCancellation: boolean;
  supportsPartialRefunds: boolean;
  requiresPhysicalDevice: boolean;
  supportsMultipleDevices: boolean;
}
```

**1.2.2 Refactor BBPOS Provider**

- [ ] Extract BBPOS logic from `paymentService.ts`
- [ ] Create `BBPOSProvider` class implementing `IPaymentProvider`
- [ ] Maintain existing functionality
- [ ] Update to use new interface
- [ ] Add provider metadata (name, capabilities)
- [ ] Ensure backward compatibility

**1.2.3 Create Viva Wallet Provider**

- [ ] Create `VivaWalletProvider` class implementing `IPaymentProvider`
- [ ] Integrate with `VivaWalletService`
- [ ] Map Viva Wallet types to provider interface types
- [ ] Implement all interface methods
- [ ] Add Viva Wallet specific capabilities
- [ ] Handle device-as-terminal scenarios
- [ ] Implement terminal selection logic

**Implementation Example:**

```typescript
// packages/main/src/services/payment/providers/viva-wallet-provider.ts

import { IPaymentProvider, ProviderConfig, PaymentIntentData, PaymentResult } from "./payment-provider.interface.js";
import { vivaWalletService } from "../../vivaWallet/index.js";

export class VivaWalletProvider implements IPaymentProvider {
  readonly name = "viva_wallet";
  readonly capabilities = {
    supportsRefunds: true,
    supportsCancellation: true,
    supportsPartialRefunds: true,
    requiresPhysicalDevice: false, // Supports device-as-terminal
    supportsMultipleDevices: true,
  };

  private connectedTerminal: Terminal | null = null;

  async initialize(config: ProviderConfig): Promise<void> {
    // Initialize Viva Wallet service
    // Connect to configured terminal
  }

  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentIntentResult> {
    // Create payment intent via Viva Wallet service
  }

  async processPayment(intentId: string): Promise<PaymentResult> {
    // Process payment through connected terminal
  }

  // ... implement all interface methods
}
```

**1.2.4 Create Provider Factory**

- [ ] Create `PaymentProviderFactory` class
- [ ] Implement provider registration system
- [ ] Add provider lookup by name
- [ ] Implement provider initialization
- [ ] Add provider switching logic
- [ ] Support multiple providers (for split payments)

**Implementation Example:**

```typescript
// packages/main/src/services/payment/providers/provider-factory.ts

export class PaymentProviderFactory {
  private providers: Map<string, IPaymentProvider> = new Map();

  registerProvider(provider: IPaymentProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): IPaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Payment provider '${name}' not found`);
    }
    return provider;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
```

**1.2.5 Refactor PaymentService**

- [ ] Update `PaymentService` to use provider factory
- [ ] Maintain existing IPC handlers (for backward compatibility)
- [ ] Add new IPC handlers for provider management
- [ ] Implement provider selection logic
- [ ] Add provider status monitoring
- [ ] Ensure seamless integration with existing code

**1.2.6 Update Payment Types**

- [ ] Add `"viva_wallet"` to payment method enum in `types/payment.d.ts`
- [ ] Add provider-related types
- [ ] Update `PaymentMethod` interface to include provider info
- [ ] Add Viva Wallet specific types
- [ ] Update type definitions for device-as-terminal support

**Implementation Example:**

```typescript
// types/payment.d.ts

export type PaymentMethodType = "cash" | "card" | "mobile" | "voucher" | "split" | "viva_wallet";

export interface PaymentMethod {
  type: PaymentMethodType;
  amount: number;
  reference?: string;
  last4?: string;
  cardType?: string;
  provider?: "bbpos" | "viva_wallet" | "simulated";
  terminalId?: string; // For Viva Wallet
}
```

**Testing Tasks:**

- [ ] Test provider interface implementation
- [ ] Test provider factory
- [ ] Test provider switching
- [ ] Test backward compatibility
- [ ] Integration tests with existing payment flow

#### 1.3 Configuration & Settings

**Files to Create:**

- `packages/main/src/config/vivaWallet.config.ts` - Configuration schema and validation
- `packages/main/src/config/vivaWallet.storage.ts` - Configuration storage implementation
- `packages/renderer/src/features/settings/components/viva-wallet-settings.tsx` - Settings UI component
- `packages/renderer/src/features/settings/hooks/use-viva-wallet-config.ts` - Settings hook
- `packages/renderer/src/features/settings/components/terminal-discovery-ui.tsx` - Discovery UI component
- `packages/renderer/src/features/settings/components/terminal-config-form.tsx` - Terminal config form
- `packages/renderer/src/shared/utils/terminal-config-validator.ts` - Client-side validation

**Files to Modify:**

- `packages/renderer/src/features/settings/config/feature-config.ts` - Add Viva Wallet settings route
- `packages/main/src/database/schema.ts` - Add terminal configuration table (if storing in DB)

**Detailed Implementation Tasks:**

**1.3.1 Configuration Schema (`vivaWallet.config.ts`)**

- [ ] Define `VivaWalletConfig` interface
- [ ] Define `TerminalConfig` interface
- [ ] Create configuration validation schema (using Zod or similar)
- [ ] Define configuration defaults
- [ ] Create configuration migration utilities
- [ ] Add environment-specific configurations

**Implementation Example:**

```typescript
// packages/main/src/config/vivaWallet.config.ts

import { z } from "zod";

export const TerminalConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  ipAddress: z.string().ip(),
  port: z.number().int().min(1).max(65535),
  apiKey: z.string().min(1),
  enabled: z.boolean(),
  autoConnect: z.boolean(),
  terminalType: z.enum(["dedicated", "device-based"]),
  deviceInfo: z
    .object({
      platform: z.enum(["android", "ios", "paydroid"]).optional(),
      deviceModel: z.string().optional(),
      osVersion: z.string().optional(),
    })
    .optional(),
  lastSeen: z.date().optional(),
});

export const VivaWalletConfigSchema = z.object({
  enabled: z.boolean(),
  terminals: z.array(TerminalConfigSchema),
  defaultTerminalId: z.string().uuid().optional(),
  timeout: z.object({
    connection: z.number().int().positive(),
    transaction: z.number().int().positive(),
    polling: z.number().int().positive(),
  }),
  retry: z.object({
    maxAttempts: z.number().int().positive(),
    backoffMultiplier: z.number().positive(),
    initialDelay: z.number().int().positive(),
  }),
  network: z
    .object({
      scanRange: z.string().optional(),
      scanPort: z.number().int().optional(),
      useMDNS: z.boolean().optional(),
    })
    .optional(),
});

export type VivaWalletConfig = z.infer<typeof VivaWalletConfigSchema>;
export type TerminalConfig = z.infer<typeof TerminalConfigSchema>;
```

**1.3.2 Configuration Storage (`vivaWallet.storage.ts`)**

- [ ] Implement configuration loading from secure storage
- [ ] Implement configuration saving with encryption
- [ ] Add configuration versioning
- [ ] Implement configuration backup/restore
- [ ] Add configuration import/export
- [ ] Handle configuration migration on updates
- [ ] Add configuration locking (prevent concurrent writes)

**1.3.3 Settings UI Component (`viva-wallet-settings.tsx`)**

- [ ] Create main settings container component
- [ ] Add enable/disable toggle for Viva Wallet
- [ ] Display list of configured terminals
- [ ] Add "Add Terminal" button
- [ ] Add "Discover Terminals" button
- [ ] Display terminal status indicators
- [ ] Add terminal edit/delete functionality
- [ ] Show terminal capabilities (NFC, card reader, etc.)
- [ ] Add terminal connection test button
- [ ] Display error messages and validation feedback

**UI Structure:**

```typescript
// packages/renderer/src/features/settings/components/viva-wallet-settings.tsx

export function VivaWalletSettings() {
  return (
    <div className="viva-wallet-settings">
      <SettingsHeader title="Viva Wallet Payment Terminal" />

      <EnableToggle />

      <TerminalList>
        <TerminalCard />
        <TerminalCard />
      </TerminalList>

      <ActionButtons>
        <DiscoverTerminalsButton />
        <AddTerminalButton />
      </ActionButtons>

      <TerminalDiscoveryModal />
      <TerminalConfigModal />
    </div>
  );
}
```

**1.3.4 Terminal Discovery UI (`terminal-discovery-ui.tsx`)**

- [ ] Create discovery modal/panel component
- [ ] Display scanning progress indicator
- [ ] Show discovered terminals list
- [ ] Display terminal type badges (device-based, dedicated)
- [ ] Show terminal capabilities
- [ ] Add "Add Terminal" action for discovered terminals
- [ ] Display discovery errors
- [ ] Add refresh/rescan functionality
- [ ] Show terminal connection status

**1.3.5 Terminal Configuration Form (`terminal-config-form.tsx`)**

- [ ] Create form for manual terminal entry
- [ ] Add fields: Name, IP Address, Port, API Key
- [ ] Implement IP address validation
- [ ] Add port range validation
- [ ] Implement API key format validation (if applicable)
- [ ] Add terminal type selection (if not auto-detected)
- [ ] Add device info fields (optional, for device-based terminals)
- [ ] Add form validation with error messages
- [ ] Add test connection button
- [ ] Implement form submission with error handling

**1.3.6 Configuration Validation**

- [ ] Create client-side validation utilities
- [ ] Validate IP address format
- [ ] Validate port range
- [ ] Validate terminal name (uniqueness, length)
- [ ] Validate API key format
- [ ] Add real-time validation feedback
- [ ] Implement server-side validation (via IPC)
- [ ] Add validation error messages

**1.3.7 Network Scanning Functionality**

- [ ] Create network scanner utility
- [ ] Implement IP range scanning
- [ ] Add port scanning for common Viva Wallet ports
- [ ] Implement mDNS/Bonjour discovery (optional)
- [ ] Add scanning progress reporting
- [ ] Handle scanning errors gracefully
- [ ] Add scanning timeout
- [ ] Cache scan results

**1.3.8 Terminal Capability Detection UI**

- [ ] Display terminal capabilities after discovery
- [ ] Show payment method support (NFC, Chip, Swipe)
- [ ] Display device information (for device-based terminals)
- [ ] Show terminal firmware version
- [ ] Display connection type (WiFi, Ethernet)
- [ ] Add capability refresh functionality

**1.3.9 Settings Integration**

- [ ] Add Viva Wallet settings route to settings navigation
- [ ] Add settings permissions check
- [ ] Integrate with existing settings layout
- [ ] Add settings page icon/icon
- [ ] Implement settings persistence
- [ ] Add settings import/export

**1.3.10 Database Schema (Optional)**

- [ ] Create `terminal_configurations` table if storing in DB
- [ ] Add migration script
- [ ] Define indexes for performance
- [ ] Add foreign key relationships (if needed)
- [ ] Implement soft delete support

**Testing Tasks:**

- [ ] Test configuration validation
- [ ] Test configuration storage (encryption/decryption)
- [ ] Test settings UI components
- [ ] Test terminal discovery UI
- [ ] Test configuration form validation
- [ ] Test network scanning
- [ ] Integration tests for full settings flow

#### 1.4 Dependencies & Package Management

**New Dependencies to Add:**

```json
{
  "axios": "^1.6.0",
  "zod": "^3.22.0"
}
```

**Optional Dependencies:**

```json
{
  "bonjour": "^4.0.0",
  "node-ipc": "^3.0.0"
}
```

**Tasks:**

- [ ] Update `package.json` with new dependencies
- [ ] Review and update dependency versions
- [ ] Add peer dependency checks
- [ ] Document dependency purposes
- [ ] Test dependency compatibility

#### 1.5 Documentation & Code Quality

**Documentation Tasks:**

- [ ] Add JSDoc comments to all public methods
- [ ] Document all interfaces and types
- [ ] Create architecture diagram
- [ ] Document configuration options
- [ ] Add code examples for common use cases
- [ ] Document error handling patterns
- [ ] Create developer guide for extending providers

**Code Quality Tasks:**

- [ ] Set up ESLint rules for new files
- [ ] Configure TypeScript strict mode
- [ ] Add Prettier formatting
- [ ] Run type checking
- [ ] Review code for security best practices
- [ ] Add code comments for complex logic
- [ ] Ensure consistent naming conventions

#### 1.6 Phase 1 Completion Checklist

**Week 1 Deliverables:**

- [x] Project structure created
- [ ] All TypeScript types defined and exported
- [ ] HTTP client implemented with retry logic
- [ ] Error handling framework in place
- [ ] Configuration management implemented
- [ ] Payment provider interface created
- [ ] BBPOS provider refactored
- [ ] Viva Wallet provider skeleton created

**Week 2 Deliverables:**

- [ ] Terminal discovery mechanism implemented
- [ ] Transaction manager skeleton created
- [ ] Provider factory implemented
- [ ] PaymentService refactored to use providers
- [ ] Configuration storage implemented
- [ ] Settings UI components created
- [ ] Terminal discovery UI implemented
- [ ] Configuration validation working
- [ ] All IPC handlers registered
- [ ] Logging infrastructure in place
- [ ] Documentation completed
- [ ] Code review completed
- [ ] Unit tests for core components

**Success Criteria:**

- ✅ All files created with proper structure
- ✅ Type definitions complete and exported
- ✅ Service can be instantiated without errors
- ✅ IPC handlers registered successfully
- ✅ Configuration can be loaded and saved
- ✅ Provider abstraction working
- ✅ Settings UI renders correctly
- ✅ No TypeScript errors
- ✅ All linter checks passing

### Phase 2: Core Transaction Processing (Week 3-4)

#### 2.1 Terminal Discovery & Connection

**Files to Create/Modify:**

- `packages/main/src/services/vivaWallet/terminal-discovery.ts` - Complete implementation
- `packages/main/src/services/vivaWallet/network-scanner.ts` - Network scanning utilities
- `packages/main/src/services/vivaWallet/capability-detector.ts` - Capability detection logic
- `packages/main/src/services/vivaWallet/terminal-cache.ts` - Terminal caching mechanism

**Implementation Overview:**

```typescript
class TerminalDiscovery {
  /**
   * Discover Viva Wallet terminals on local network
   * Uses network scanning or mDNS/Bonjour
   * Supports both dedicated terminals and device-based terminals
   */
  async discoverTerminals(): Promise<Terminal[]>;

  /**
   * Verify terminal connectivity
   */
  async verifyConnection(terminal: Terminal): Promise<boolean>;

  /**
   * Detect terminal type and capabilities
   * Identifies if terminal is device-based or dedicated hardware
   */
  async detectTerminalCapabilities(terminal: Terminal): Promise<TerminalCapabilities>;
}
```

**Device-as-Terminal Discovery:**

```typescript
interface TerminalCapabilities {
  isDeviceBased: boolean; // true for smartphone/tablet terminals
  deviceType?: "android" | "ios" | "paydroid";
  hasCardReader: boolean; // false for NFC-only devices
  supportedPaymentMethods: ("tap" | "chip" | "swipe")[];
  nfcEnabled: boolean;
}
```

**Detailed Implementation Tasks:**

**2.1.1 Network Scanning Algorithm (`network-scanner.ts`)**

- [ ] Implement IP range scanning utility
- [ ] Add CIDR notation parsing (e.g., "192.168.1.0/24")
- [ ] Create parallel IP scanning (with concurrency limit)
- [ ] Implement port scanning for Viva Wallet ports (default: 8080, configurable)
- [ ] Add timeout handling for network requests (5 seconds per IP)
- [ ] Implement scan progress reporting
- [ ] Add scan cancellation support
- [ ] Cache scan results to avoid redundant scans
- [ ] Support manual IP range configuration
- [ ] Add network interface detection (to determine local network)

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/network-scanner.ts

import { getLogger } from "../../utils/logger.js";
import axios from "axios";

const logger = getLogger("NetworkScanner");

export class NetworkScanner {
  private readonly SCAN_TIMEOUT = 5000; // 5 seconds per IP
  private readonly MAX_CONCURRENT = 10; // Scan 10 IPs at a time
  private readonly DEFAULT_PORTS = [8080, 8081, 3000]; // Common Viva Wallet ports

  /**
   * Scan IP range for Viva Wallet terminals
   */
  async scanIPRange(ipRange: string, ports: number[] = this.DEFAULT_PORTS, onProgress?: (progress: ScanProgress) => void): Promise<Terminal[]> {
    const terminals: Terminal[] = [];
    const ipAddresses = this.parseIPRange(ipRange);
    const totalIPs = ipAddresses.length;
    let scannedCount = 0;

    // Process IPs in batches
    for (let i = 0; i < ipAddresses.length; i += this.MAX_CONCURRENT) {
      const batch = ipAddresses.slice(i, i + this.MAX_CONCURRENT);

      const batchResults = await Promise.allSettled(batch.map((ip) => this.scanIP(ip, ports)));

      for (const result of batchResults) {
        scannedCount++;

        if (result.status === "fulfilled" && result.value) {
          terminals.push(result.value);
        }

        // Report progress
        if (onProgress) {
          onProgress({
            scanned: scannedCount,
            total: totalIPs,
            percentage: (scannedCount / totalIPs) * 100,
            terminalsFound: terminals.length,
          });
        }
      }
    }

    return terminals;
  }

  private async scanIP(ip: string, ports: number[]): Promise<Terminal | null> {
    for (const port of ports) {
      try {
        const terminal = await this.checkTerminal(ip, port);
        if (terminal) {
          return terminal;
        }
      } catch (error) {
        // Continue to next port
      }
    }
    return null;
  }

  private async checkTerminal(ip: string, port: number): Promise<Terminal | null> {
    try {
      const response = await axios.get(`http://${ip}:${port}/api/status`, {
        timeout: this.SCAN_TIMEOUT,
        validateStatus: (status) => status < 500, // Accept 4xx as terminal found
      });

      if (response.status === 200 || response.status === 401) {
        // Terminal found (401 means auth required, which is expected)
        return this.createTerminalFromResponse(ip, port, response.data);
      }
    } catch (error) {
      // Terminal not found at this IP/port
    }
    return null;
  }

  private parseIPRange(ipRange: string): string[] {
    // Parse CIDR notation or IP range
    // Implementation for IP range parsing
  }
}
```

**2.1.2 Terminal Capability Detection (`capability-detector.ts`)**

- [ ] Create `CapabilityDetector` class
- [ ] Implement terminal API status endpoint query
- [ ] Parse terminal response to detect capabilities
- [ ] Identify terminal type (dedicated vs. device-based)
- [ ] Detect platform (Android, iOS, Paydroid)
- [ ] Determine payment method support (NFC, Chip, Swipe)
- [ ] Check for card reader attachment
- [ ] Detect firmware version and capabilities
- [ ] Cache capability information
- [ ] Handle capability detection errors gracefully

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/capability-detector.ts

export class CapabilityDetector {
  async detectCapabilities(terminal: Terminal): Promise<TerminalCapabilities> {
    try {
      const statusResponse = await this.getTerminalStatus(terminal);

      return {
        isDeviceBased: this.isDeviceBased(statusResponse),
        deviceType: this.detectDeviceType(statusResponse),
        hasCardReader: statusResponse.hasCardReader || false,
        supportedPaymentMethods: this.parsePaymentMethods(statusResponse),
        nfcEnabled: statusResponse.nfcEnabled || false,
      };
    } catch (error) {
      logger.warn(`Failed to detect capabilities for ${terminal.id}:`, error);
      return this.getDefaultCapabilities();
    }
  }

  private isDeviceBased(status: TerminalStatusResponse): boolean {
    // Check user agent, device info, or specific headers
    return status.deviceType === "mobile" || status.platform !== undefined;
  }

  private detectDeviceType(status: TerminalStatusResponse): "android" | "ios" | "paydroid" | undefined {
    // Parse platform information
    if (status.platform) {
      if (status.platform.toLowerCase().includes("android")) {
        return status.isPaydroid ? "paydroid" : "android";
      }
      if (status.platform.toLowerCase().includes("ios")) {
        return "ios";
      }
    }
    return undefined;
  }

  private parsePaymentMethods(status: TerminalStatusResponse): ("tap" | "chip" | "swipe")[] {
    const methods: ("tap" | "chip" | "swipe")[] = [];

    if (status.capabilities?.includes("tap") || status.nfcEnabled) {
      methods.push("tap");
    }
    if (status.capabilities?.includes("chip")) {
      methods.push("chip");
    }
    if (status.capabilities?.includes("swipe")) {
      methods.push("swipe");
    }

    return methods;
  }
}
```

**2.1.3 Terminal Connection & Health Checks**

- [ ] Implement connection verification method
- [ ] Add connection timeout handling (10 seconds)
- [ ] Create health check endpoint query
- [ ] Implement connection retry logic
- [ ] Add connection state management (connecting, connected, disconnected)
- [ ] Monitor connection health periodically
- [ ] Implement automatic reconnection on failure
- [ ] Add connection metrics (latency, uptime)
- [ ] Handle connection errors gracefully
- [ ] Support connection pooling for multiple terminals

**Implementation Example:**

```typescript
export class TerminalConnection {
  private connectionState: "disconnected" | "connecting" | "connected" | "error" = "disconnected";
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date | null = null;
  private connectionMetrics = {
    latency: 0,
    uptime: 0,
    lastConnectedAt: null as Date | null,
    reconnectAttempts: 0,
  };

  async connect(terminal: Terminal): Promise<boolean> {
    this.connectionState = "connecting";

    try {
      const httpClient = new VivaWalletHTTPClient(terminal);
      const health = await httpClient.healthCheck({ timeout: 10000 });

      if (health.success) {
        this.connectionState = "connected";
        this.connectionMetrics.lastConnectedAt = new Date();
        this.connectionMetrics.reconnectAttempts = 0;
        this.startHealthMonitoring(terminal);
        return true;
      }

      this.connectionState = "error";
      return false;
    } catch (error) {
      this.connectionState = "error";
      logger.error(`Failed to connect to terminal ${terminal.id}:`, error);
      return false;
    }
  }

  private startHealthMonitoring(terminal: Terminal): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const startTime = Date.now();
        const httpClient = new VivaWalletHTTPClient(terminal);
        const health = await httpClient.healthCheck({ timeout: 5000 });
        const latency = Date.now() - startTime;

        this.connectionMetrics.latency = latency;
        this.lastHealthCheck = new Date();

        if (!health.success) {
          this.connectionState = "error";
          await this.handleConnectionLoss(terminal);
        } else {
          this.connectionState = "connected";
        }
      } catch (error) {
        logger.warn(`Health check failed for ${terminal.id}:`, error);
        this.connectionState = "error";
      }
    }, 30000); // Check every 30 seconds
  }
}
```

**2.1.4 Terminal Caching (`terminal-cache.ts`)**

- [ ] Create terminal cache implementation
- [ ] Store terminal metadata (IP, port, capabilities)
- [ ] Implement cache expiration (1 hour default)
- [ ] Add cache invalidation on network changes
- [ ] Support cache persistence (optional)
- [ ] Implement cache warming (pre-load known terminals)
- [ ] Add cache hit/miss metrics
- [ ] Handle cache corruption gracefully

**2.1.5 mDNS/Bonjour Discovery (Optional)**

- [ ] Add Bonjour/mDNS support for device-based terminals
- [ ] Implement service discovery (\_vivawallet.\_tcp)
- [ ] Parse mDNS service records
- [ ] Add mDNS discovery to discovery methods
- [ ] Handle mDNS discovery errors
- [ ] Make mDNS optional (graceful degradation)

**2.1.6 Network Configuration Change Handling**

- [ ] Listen for network interface changes
- [ ] Detect IP address changes
- [ ] Invalidate terminal cache on network change
- [ ] Re-scan network on configuration change
- [ ] Handle network disconnection gracefully
- [ ] Support multiple network interfaces

**Testing Tasks:**

- [ ] Test network scanning with various IP ranges
- [ ] Test capability detection for different terminal types
- [ ] Test connection health monitoring
- [ ] Test terminal caching
- [ ] Test network configuration change handling
- [ ] Mock network failures for error scenarios

#### 2.2 Transaction Initiation

**Files to Create/Modify:**

- `packages/main/src/services/vivaWallet/transaction-manager.ts` - Complete implementation
- `packages/main/src/services/vivaWallet/transaction-state-machine.ts` - State machine logic
- `packages/main/src/services/vivaWallet/transaction-builder.ts` - Request builder utilities
- `packages/main/src/services/vivaWallet/transaction-queue.ts` - Transaction queue management

**Implementation Overview:**

```typescript
class TransactionManager {
  /**
   * Initiate sale transaction
   */
  async initiateSale(request: SaleRequest): Promise<TransactionResponse>;

  /**
   * Poll for transaction status updates
   */
  async pollStatus(transactionId: string): Promise<TransactionStatus>;

  /**
   * Cancel active transaction
   */
  async cancelTransaction(transactionId: string): Promise<void>;
}
```

**Detailed Implementation Tasks:**

**2.2.1 Transaction Request Builder (`transaction-builder.ts`)**

- [ ] Create `TransactionRequestBuilder` class
- [ ] Implement sale request builder with validation
- [ ] Add refund request builder
- [ ] Implement currency conversion (to minor units)
- [ ] Add metadata builder for transaction context
- [ ] Generate unique transaction references
- [ ] Validate transaction amounts (min/max limits)
- [ ] Add transaction description builder
- [ ] Support transaction metadata (receipt number, shift ID, etc.)

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/transaction-builder.ts

export class TransactionRequestBuilder {
  /**
   * Build sale transaction request
   */
  buildSaleRequest(params: { amount: number; currency: string; description?: string; metadata?: Record<string, string>; receiptNumber?: string }): VivaWalletSaleRequest {
    // Validate amount (convert to minor units if needed)
    const amountInMinorUnits = this.convertToMinorUnits(params.amount, params.currency);

    if (amountInMinorUnits <= 0) {
      throw new Error("Transaction amount must be greater than 0");
    }

    if (amountInMinorUnits > this.MAX_TRANSACTION_AMOUNT) {
      throw new Error(`Transaction amount exceeds maximum: ${this.MAX_TRANSACTION_AMOUNT}`);
    }

    return {
      amount: amountInMinorUnits,
      currency: params.currency.toUpperCase(),
      reference: this.generateReference(),
      description: params.description || `Transaction ${params.receiptNumber || ""}`.trim(),
      metadata: {
        ...params.metadata,
        receiptNumber: params.receiptNumber,
        timestamp: new Date().toISOString(),
        posVersion: process.env.APP_VERSION || "unknown",
      },
    };
  }

  private convertToMinorUnits(amount: number, currency: string): number {
    // Most currencies use 2 decimal places (cents)
    // Some use 0 (JPY) or 3 (BHD, JOD, etc.)
    const decimalPlaces = this.getCurrencyDecimalPlaces(currency);
    return Math.round(amount * Math.pow(10, decimalPlaces));
  }

  private generateReference(): string {
    return `POS-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  }
}
```

**2.2.2 Transaction State Machine (`transaction-state-machine.ts`)**

- [ ] Define transaction states enum
- [ ] Create state machine class
- [ ] Implement state transitions
- [ ] Add state validation
- [ ] Implement state persistence (for recovery)
- [ ] Add state history tracking
- [ ] Handle illegal state transitions
- [ ] Support state timeout transitions

**Transaction States:**

```typescript
type TransactionState = "idle" | "initiating" | "pending" | "processing" | "awaiting_card" | "card_present" | "authorizing" | "completed" | "failed" | "cancelled" | "refunded";

interface TransactionStateMachine {
  currentState: TransactionState;
  previousState: TransactionState;
  stateHistory: Array<{ state: TransactionState; timestamp: Date; reason?: string }>;

  transition(newState: TransactionState, reason?: string): void;
  canTransition(to: TransactionState): boolean;
  getNextStates(): TransactionState[];
}
```

**2.2.3 Transaction Initiation Logic (`transaction-manager.ts`)**

- [ ] Implement sale transaction initiation
- [ ] Add terminal selection logic
- [ ] Implement transaction request sending
- [ ] Handle transaction initiation errors
- [ ] Create transaction record in database
- [ ] Generate transaction ID
- [ ] Link transaction to shift/business
- [ ] Add transaction metadata storage
- [ ] Implement transaction timeout handling
- [ ] Support transaction cancellation

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/transaction-manager.ts

export class TransactionManager {
  private activeTransactions: Map<string, ActiveTransaction> = new Map();
  private stateMachine: TransactionStateMachine;

  async initiateSale(terminal: Terminal, request: VivaWalletSaleRequest): Promise<TransactionResponse> {
    const transactionId = this.generateTransactionId();
    const stateMachine = new TransactionStateMachine(transactionId);

    try {
      stateMachine.transition("initiating");

      // Store active transaction
      const activeTransaction: ActiveTransaction = {
        id: transactionId,
        terminal,
        request,
        stateMachine,
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      };
      this.activeTransactions.set(transactionId, activeTransaction);

      // Send request to terminal
      const httpClient = new VivaWalletHTTPClient(terminal);
      const response = await httpClient.post("/api/transactions/sale", request);

      if (response.data.transactionId) {
        activeTransaction.terminalTransactionId = response.data.transactionId;
        stateMachine.transition("pending", "Transaction initiated on terminal");

        // Start polling for status
        this.startPolling(transactionId);

        return {
          transactionId,
          terminalTransactionId: response.data.transactionId,
          status: "pending",
          amount: request.amount,
          currency: request.currency,
        };
      }

      throw new Error("Failed to initiate transaction on terminal");
    } catch (error) {
      stateMachine.transition("failed", error.message);
      this.activeTransactions.delete(transactionId);
      throw error;
    }
  }
}
```

**2.2.4 Transaction Queue Management (`transaction-queue.ts`)**

- [ ] Create transaction queue for concurrent transactions
- [ ] Implement queue priority (FIFO by default)
- [ ] Add transaction queuing when terminal is busy
- [ ] Implement queue processing
- [ ] Handle queue overflow
- [ ] Add queue status monitoring
- [ ] Support queue cancellation
- [ ] Implement queue persistence (optional)

**Testing Tasks:**

- [ ] Test transaction initiation with various amounts
- [ ] Test transaction state machine transitions
- [ ] Test transaction queue handling
- [ ] Test error scenarios during initiation
- [ ] Test transaction cancellation

#### 2.3 Status Polling & Event Handling

**Files to Create/Modify:**

- `packages/main/src/services/vivaWallet/transaction-poller.ts` - Polling implementation
- `packages/main/src/services/vivaWallet/event-emitter.ts` - Event system
- `packages/main/src/services/vivaWallet/polling-strategy.ts` - Polling algorithms

**Implementation Overview:**

```typescript
class TransactionPoller {
  /**
   * Start polling for transaction status
   */
  async startPolling(transactionId: string): Promise<void>;

  /**
   * Handle status updates
   */
  private onStatusUpdate(status: TransactionStatus): void;

  /**
   * Stop polling for transaction
   */
  stopPolling(transactionId: string): void;
}
```

**Detailed Implementation Tasks:**

**2.3.1 Polling Strategy Implementation (`polling-strategy.ts`)**

- [ ] Create adaptive polling strategy (adjusts interval based on state)
- [ ] Implement exponential backoff for pending transactions
- [ ] Add fast polling for active states (processing, awaiting_card)
- [ ] Implement slow polling for terminal states (pending)
- [ ] Add maximum polling duration (transaction timeout)
- [ ] Implement polling cancellation
- [ ] Add polling metrics (request count, average latency)
- [ ] Support configurable polling intervals

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/polling-strategy.ts

export class PollingStrategy {
  private readonly BASE_INTERVAL = 500; // 500ms base interval
  private readonly MAX_INTERVAL = 5000; // 5 seconds max
  private readonly FAST_POLLING_INTERVAL = 500; // Fast polling for active states
  private readonly SLOW_POLLING_INTERVAL = 2000; // Slow polling for pending

  getPollingInterval(state: TransactionState, attempt: number): number {
    switch (state) {
      case "processing":
      case "awaiting_card":
      case "authorizing":
        return this.FAST_POLLING_INTERVAL;

      case "pending":
        // Exponential backoff up to max interval
        return Math.min(this.BASE_INTERVAL * Math.pow(1.5, attempt), this.MAX_INTERVAL);

      default:
        return this.SLOW_POLLING_INTERVAL;
    }
  }

  shouldContinuePolling(state: TransactionState, elapsedTime: number, maxDuration: number): boolean {
    // Stop if transaction is in final state
    if (["completed", "failed", "cancelled", "refunded"].includes(state)) {
      return false;
    }

    // Stop if timeout exceeded
    if (elapsedTime > maxDuration) {
      return false;
    }

    return true;
  }
}
```

**2.3.2 Transaction Poller Implementation (`transaction-poller.ts`)**

- [ ] Create poller class with lifecycle management
- [ ] Implement polling loop with configurable intervals
- [ ] Add status update parsing
- [ ] Handle polling errors with retry logic
- [ ] Implement polling cancellation
- [ ] Add polling progress tracking
- [ ] Support multiple concurrent polling operations
- [ ] Implement polling timeout handling
- [ ] Add polling pause/resume functionality

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/transaction-poller.ts

export class TransactionPoller {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pollingStrategy: PollingStrategy;
  private eventEmitter: EventEmitter;

  constructor(private httpClient: VivaWalletHTTPClient, private transactionManager: TransactionManager) {
    this.pollingStrategy = new PollingStrategy();
    this.eventEmitter = new EventEmitter();
  }

  async startPolling(transactionId: string, terminal: Terminal): Promise<void> {
    // Stop existing polling if any
    this.stopPolling(transactionId);

    let attempt = 0;
    const startTime = Date.now();
    const maxDuration = 5 * 60 * 1000; // 5 minutes timeout

    const poll = async () => {
      try {
        const activeTransaction = this.transactionManager.getActiveTransaction(transactionId);
        if (!activeTransaction) {
          this.stopPolling(transactionId);
          return;
        }

        const elapsedTime = Date.now() - startTime;

        // Check if should continue polling
        if (!this.pollingStrategy.shouldContinuePolling(activeTransaction.stateMachine.currentState, elapsedTime, maxDuration)) {
          this.stopPolling(transactionId);
          return;
        }

        // Poll for status
        const status = await this.httpClient.get(`/api/transactions/${activeTransaction.terminalTransactionId}/status`);

        // Update transaction state
        await this.handleStatusUpdate(transactionId, status.data);

        // Calculate next polling interval
        const interval = this.pollingStrategy.getPollingInterval(activeTransaction.stateMachine.currentState, attempt);

        // Schedule next poll
        const timeout = setTimeout(poll, interval);
        this.pollingIntervals.set(transactionId, timeout);

        attempt++;
      } catch (error) {
        logger.error(`Polling error for transaction ${transactionId}:`, error);

        // Retry with backoff on error
        const retryInterval = Math.min(this.BASE_INTERVAL * Math.pow(2, attempt), this.MAX_INTERVAL);

        const timeout = setTimeout(poll, retryInterval);
        this.pollingIntervals.set(transactionId, timeout);
        attempt++;
      }
    };

    // Start initial poll immediately
    await poll();
  }

  stopPolling(transactionId: string): void {
    const interval = this.pollingIntervals.get(transactionId);
    if (interval) {
      clearTimeout(interval);
      this.pollingIntervals.delete(transactionId);
    }
  }

  private async handleStatusUpdate(transactionId: string, status: TerminalTransactionStatus): Promise<void> {
    const activeTransaction = this.transactionManager.getActiveTransaction(transactionId);
    if (!activeTransaction) return;

    // Update state machine based on terminal status
    const newState = this.mapTerminalStatusToState(status.status);
    activeTransaction.stateMachine.transition(newState, status.message);

    // Emit event for listeners
    this.eventEmitter.emit("transaction-status-update", {
      transactionId,
      status,
      state: newState,
    });

    // Handle final states
    if (["completed", "failed", "cancelled"].includes(newState)) {
      this.stopPolling(transactionId);
      await this.finalizeTransaction(transactionId, status);
    }
  }
}
```

**2.3.3 Event Emitter System (`event-emitter.ts`)**

- [ ] Create typed event emitter for transaction events
- [ ] Define event types (status-update, completion, error, cancellation)
- [ ] Implement event listeners registration
- [ ] Add event broadcasting to renderer process
- [ ] Implement event filtering (by transaction ID, type)
- [ ] Add event history (for debugging)
- [ ] Support one-time event listeners
- [ ] Handle event listener errors gracefully

**2.3.4 Connection Interruption Handling**

- [ ] Detect network interruptions during polling
- [ ] Implement connection loss detection
- [ ] Add automatic reconnection logic
- [ ] Resume polling after reconnection
- [ ] Handle partial transaction states
- [ ] Implement transaction recovery queries
- [ ] Add connection state monitoring

**2.3.5 Transaction Timeout Handling**

- [ ] Implement transaction timeout (5 minutes default)
- [ ] Add timeout notification
- [ ] Handle timeout state transition
- [ ] Support configurable timeout per transaction type
- [ ] Implement timeout cleanup
- [ ] Add timeout event emission

**2.3.6 Automatic Recovery**

- [ ] Implement transaction recovery on app restart
- [ ] Query terminal for pending transactions
- [ ] Resume polling for incomplete transactions
- [ ] Handle orphaned transactions
- [ ] Clean up stale transactions
- [ ] Reconcile transaction states

**Testing Tasks:**

- [ ] Test polling with various transaction states
- [ ] Test polling interval adjustments
- [ ] Test connection interruption recovery
- [ ] Test transaction timeout handling
- [ ] Test event emission and handling
- [ ] Test concurrent transaction polling
- [ ] Test polling cancellation

#### 2.4 Phase 2 Completion Checklist

**Week 3 Deliverables:**

- [ ] Terminal discovery fully implemented
- [ ] Network scanning working
- [ ] Capability detection working
- [ ] Terminal connection and health checks working
- [ ] Transaction initiation implemented
- [ ] Transaction state machine working
- [ ] Basic polling mechanism implemented

**Week 4 Deliverables:**

- [ ] Advanced polling strategy implemented
- [ ] Event emitter system working
- [ ] Connection interruption handling
- [ ] Transaction timeout handling
- [ ] Automatic recovery mechanism
- [ ] Transaction queue management
- [ ] All IPC handlers for transactions working
- [ ] Integration tests passing
- [ ] Documentation updated

**Success Criteria:**

- ✅ Can discover terminals on local network
- ✅ Can detect terminal capabilities and type
- ✅ Can initiate sale transactions
- ✅ Can poll for transaction status
- ✅ Handles connection interruptions gracefully
- ✅ Recovers from transaction timeouts
- ✅ Events are properly emitted and received
- ✅ All error scenarios handled
- ✅ Performance meets requirements (polling < 500ms, initiation < 1s)

### Phase 3: Error Handling & Recovery (Week 5)

#### 3.1 Error Classification

**Files to Create/Modify:**

- `packages/main/src/services/vivaWallet/errors/error-types.ts` - Error type definitions
- `packages/main/src/services/vivaWallet/errors/error-classifier.ts` - Error classification logic
- `packages/main/src/services/vivaWallet/errors/error-messages.ts` - User-friendly error messages
- `packages/main/src/services/vivaWallet/errors/error-logger.ts` - Error logging utilities

**Error Type Categories:**

1. **Network Errors** - Connection issues, timeouts, DNS failures
2. **Terminal Errors** - Device unavailable, busy, offline, firmware issues
3. **Transaction Errors** - Declined, cancelled, expired, insufficient funds
4. **Configuration Errors** - Invalid settings, authentication failures, missing credentials
5. **System Errors** - Internal errors, state inconsistencies, data corruption

**Detailed Implementation Tasks:**

**3.1.1 Error Type Definitions (`error-types.ts`)**

- [ ] Create base error classes for each error category
- [ ] Define error code enums for all error types
- [ ] Create error interfaces with metadata
- [ ] Add error severity levels (critical, high, medium, low)
- [ ] Define retryable vs. non-retryable error flags
- [ ] Add error context interfaces (terminal info, transaction info, etc.)
- [ ] Create error factory functions
- [ ] Add error validation utilities

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/errors/error-types.ts

export enum ErrorCode {
  // Network Errors
  NETWORK_CONNECTION_REFUSED = "NETWORK_CONNECTION_REFUSED",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_UNREACHABLE = "NETWORK_UNREACHABLE",
  DNS_RESOLUTION_FAILED = "DNS_RESOLUTION_FAILED",
  SSL_HANDSHAKE_FAILED = "SSL_HANDSHAKE_FAILED",

  // Terminal Errors
  TERMINAL_OFFLINE = "TERMINAL_OFFLINE",
  TERMINAL_BUSY = "TERMINAL_BUSY",
  TERMINAL_ERROR = "TERMINAL_ERROR",
  TERMINAL_FIRMWARE_MISMATCH = "TERMINAL_FIRMWARE_MISMATCH",
  TERMINAL_NOT_FOUND = "TERMINAL_NOT_FOUND",
  TERMINAL_AUTH_FAILED = "TERMINAL_AUTH_FAILED",

  // Transaction Errors
  TRANSACTION_DECLINED = "TRANSACTION_DECLINED",
  TRANSACTION_INSUFFICIENT_FUNDS = "TRANSACTION_INSUFFICIENT_FUNDS",
  TRANSACTION_EXPIRED_CARD = "TRANSACTION_EXPIRED_CARD",
  TRANSACTION_CANCELLED = "TRANSACTION_CANCELLED",
  TRANSACTION_TIMEOUT = "TRANSACTION_TIMEOUT",
  TRANSACTION_INVALID_AMOUNT = "TRANSACTION_INVALID_AMOUNT",

  // Configuration Errors
  CONFIG_INVALID_IP = "CONFIG_INVALID_IP",
  CONFIG_INVALID_PORT = "CONFIG_INVALID_PORT",
  CONFIG_MISSING_API_KEY = "CONFIG_MISSING_API_KEY",
  CONFIG_INVALID_CREDENTIALS = "CONFIG_INVALID_CREDENTIALS",
  CONFIG_TERMINAL_NOT_CONFIGURED = "CONFIG_TERMINAL_NOT_CONFIGURED",

  // System Errors
  SYSTEM_STATE_INCONSISTENT = "SYSTEM_STATE_INCONSISTENT",
  SYSTEM_DATA_CORRUPTION = "SYSTEM_DATA_CORRUPTION",
  SYSTEM_UNKNOWN_ERROR = "SYSTEM_UNKNOWN_ERROR",
}

export enum ErrorSeverity {
  CRITICAL = "critical", // System cannot continue
  HIGH = "high", // User action required
  MEDIUM = "medium", // May affect functionality
  LOW = "low", // Minor issue, can continue
}

export interface VivaWalletError extends Error {
  code: ErrorCode;
  severity: ErrorSeverity;
  retryable: boolean;
  terminalId?: string;
  transactionId?: string;
  context?: Record<string, any>;
  timestamp: Date;
  originalError?: Error;
}

export class NetworkError extends Error implements VivaWalletError {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly terminalId?: string;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;
  readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      terminalId?: string;
      retryable?: boolean;
      context?: Record<string, any>;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = "NetworkError";
    this.code = code;
    this.severity = this.determineSeverity(code);
    this.retryable = options?.retryable ?? this.isRetryable(code);
    this.terminalId = options?.terminalId;
    this.context = options?.context;
    this.originalError = options?.originalError;
    this.timestamp = new Date();
  }

  private determineSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Record<ErrorCode, ErrorSeverity> = {
      [ErrorCode.NETWORK_CONNECTION_REFUSED]: ErrorSeverity.HIGH,
      [ErrorCode.NETWORK_TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorCode.NETWORK_UNREACHABLE]: ErrorSeverity.HIGH,
      [ErrorCode.DNS_RESOLUTION_FAILED]: ErrorSeverity.HIGH,
      [ErrorCode.SSL_HANDSHAKE_FAILED]: ErrorSeverity.CRITICAL,
    };
    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  private isRetryable(code: ErrorCode): boolean {
    // Network errors are generally retryable
    return true;
  }
}

export class TerminalError extends Error implements VivaWalletError {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly terminalId?: string;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;

  constructor(code: ErrorCode, message: string, terminalId?: string, context?: Record<string, any>) {
    super(message);
    this.name = "TerminalError";
    this.code = code;
    this.severity = this.determineSeverity(code);
    this.retryable = this.isRetryable(code);
    this.terminalId = terminalId;
    this.context = context;
    this.timestamp = new Date();
  }

  private determineSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Record<ErrorCode, ErrorSeverity> = {
      [ErrorCode.TERMINAL_OFFLINE]: ErrorSeverity.HIGH,
      [ErrorCode.TERMINAL_BUSY]: ErrorSeverity.MEDIUM,
      [ErrorCode.TERMINAL_ERROR]: ErrorSeverity.HIGH,
      [ErrorCode.TERMINAL_FIRMWARE_MISMATCH]: ErrorSeverity.CRITICAL,
      [ErrorCode.TERMINAL_NOT_FOUND]: ErrorSeverity.HIGH,
      [ErrorCode.TERMINAL_AUTH_FAILED]: ErrorSeverity.CRITICAL,
    };
    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  private isRetryable(code: ErrorCode): boolean {
    const retryableCodes = [ErrorCode.TERMINAL_BUSY, ErrorCode.TERMINAL_OFFLINE, ErrorCode.TERMINAL_ERROR];
    return retryableCodes.includes(code);
  }
}

export class TransactionError extends Error implements VivaWalletError {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly transactionId?: string;
  readonly terminalId?: string;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;

  constructor(code: ErrorCode, message: string, transactionId?: string, terminalId?: string, context?: Record<string, any>) {
    super(message);
    this.name = "TransactionError";
    this.code = code;
    this.severity = this.determineSeverity(code);
    this.retryable = this.isRetryable(code);
    this.transactionId = transactionId;
    this.terminalId = terminalId;
    this.context = context;
    this.timestamp = new Date();
  }

  private determineSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Record<ErrorCode, ErrorSeverity> = {
      [ErrorCode.TRANSACTION_DECLINED]: ErrorSeverity.MEDIUM,
      [ErrorCode.TRANSACTION_INSUFFICIENT_FUNDS]: ErrorSeverity.MEDIUM,
      [ErrorCode.TRANSACTION_EXPIRED_CARD]: ErrorSeverity.MEDIUM,
      [ErrorCode.TRANSACTION_CANCELLED]: ErrorSeverity.LOW,
      [ErrorCode.TRANSACTION_TIMEOUT]: ErrorSeverity.HIGH,
      [ErrorCode.TRANSACTION_INVALID_AMOUNT]: ErrorSeverity.MEDIUM,
    };
    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  private isRetryable(code: ErrorCode): boolean {
    // Most transaction errors are not retryable (user must take action)
    const retryableCodes = [ErrorCode.TRANSACTION_TIMEOUT];
    return retryableCodes.includes(code);
  }
}
```

**3.1.2 Error Classification Logic (`error-classifier.ts`)**

- [ ] Create `ErrorClassifier` class
- [ ] Implement error detection from HTTP responses
- [ ] Parse error codes from terminal API responses
- [ ] Classify errors by type (network, terminal, transaction, etc.)
- [ ] Determine error severity automatically
- [ ] Identify retryable errors
- [ ] Extract error context (terminal ID, transaction ID, etc.)
- [ ] Map generic errors to specific error codes
- [ ] Handle unknown errors gracefully

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/errors/error-classifier.ts

import { AxiosError } from "axios";
import { ErrorCode, NetworkError, TerminalError, TransactionError, VivaWalletError } from "./error-types.js";

export class ErrorClassifier {
  classify(error: unknown, context?: { terminalId?: string; transactionId?: string }): VivaWalletError {
    // Handle Axios errors (HTTP/Network)
    if (this.isAxiosError(error)) {
      return this.classifyAxiosError(error, context);
    }

    // Handle native errors
    if (error instanceof Error) {
      return this.classifyNativeError(error, context);
    }

    // Handle unknown errors
    return this.createUnknownError(error, context);
  }

  private classifyAxiosError(error: AxiosError, context?: { terminalId?: string; transactionId?: string }): VivaWalletError {
    if (!error.response) {
      // Network-level error (no response from server)
      return this.classifyNetworkError(error, context);
    }

    const status = error.response.status;
    const data = error.response.data as any;

    // Check for terminal-specific error codes
    if (data?.error?.code) {
      return this.classifyTerminalError(data.error, context);
    }

    // Check for transaction-specific error codes
    if (data?.transactionError) {
      return this.classifyTransactionError(data.transactionError, context);
    }

    // Classify by HTTP status code
    switch (status) {
      case 401:
        return new TerminalError(ErrorCode.TERMINAL_AUTH_FAILED, "Authentication failed. Please check API key.", context?.terminalId);
      case 404:
        return new TerminalError(ErrorCode.TERMINAL_NOT_FOUND, "Terminal not found. Please verify terminal configuration.", context?.terminalId);
      case 503:
        return new TerminalError(ErrorCode.TERMINAL_BUSY, "Terminal is busy. Please try again in a moment.", context?.terminalId, { statusCode: status });
      default:
        return this.classifyNetworkError(error, context);
    }
  }

  private classifyNetworkError(error: AxiosError, context?: { terminalId?: string }): NetworkError {
    if (error.code === "ECONNREFUSED") {
      return new NetworkError(ErrorCode.NETWORK_CONNECTION_REFUSED, "Connection refused. Terminal may be offline or unreachable.", {
        terminalId: context?.terminalId,
        retryable: true,
        originalError: error,
      });
    }

    if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      return new NetworkError(ErrorCode.NETWORK_TIMEOUT, "Connection timeout. Please check network connectivity.", {
        terminalId: context?.terminalId,
        retryable: true,
        originalError: error,
      });
    }

    if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
      return new NetworkError(ErrorCode.DNS_RESOLUTION_FAILED, "DNS resolution failed. Please check network configuration.", {
        terminalId: context?.terminalId,
        retryable: true,
        originalError: error,
      });
    }

    return new NetworkError(ErrorCode.NETWORK_UNREACHABLE, "Network error occurred. Please check connectivity.", {
      terminalId: context?.terminalId,
      retryable: true,
      originalError: error,
    });
  }

  private classifyTerminalError(errorData: any, context?: { terminalId?: string; transactionId?: string }): TerminalError {
    const errorCode = errorData.code || ErrorCode.TERMINAL_ERROR;
    const message = errorData.message || "Terminal error occurred";

    return new TerminalError(errorCode, message, context?.terminalId, {
      transactionId: context?.transactionId,
      terminalError: errorData,
    });
  }

  private classifyTransactionError(errorData: any, context?: { terminalId?: string; transactionId?: string }): TransactionError {
    // Map terminal transaction error codes to our error codes
    const codeMap: Record<string, ErrorCode> = {
      DECLINED: ErrorCode.TRANSACTION_DECLINED,
      INSUFFICIENT_FUNDS: ErrorCode.TRANSACTION_INSUFFICIENT_FUNDS,
      EXPIRED_CARD: ErrorCode.TRANSACTION_EXPIRED_CARD,
      CANCELLED: ErrorCode.TRANSACTION_CANCELLED,
      TIMEOUT: ErrorCode.TRANSACTION_TIMEOUT,
    };

    const errorCode = codeMap[errorData.code] || ErrorCode.TRANSACTION_DECLINED;
    const message = errorData.message || "Transaction failed";

    return new TransactionError(errorCode, message, context?.transactionId, context?.terminalId, {
      transactionError: errorData,
    });
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return typeof error === "object" && error !== null && "isAxiosError" in error;
  }
}
```

**3.1.3 User-Friendly Error Messages (`error-messages.ts`)**

- [ ] Create error message mapping for all error codes
- [ ] Implement localized error messages (i18n support)
- [ ] Add contextual error messages (include terminal name, transaction amount, etc.)
- [ ] Create actionable error messages (with suggestions)
- [ ] Add error message templates
- [ ] Implement error message formatting
- [ ] Support error message customization
- [ ] Add error help links/documentation references

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/errors/error-messages.ts

import { ErrorCode, VivaWalletError } from "./error-types.js";

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestions: string[];
  helpLink?: string;
  canRetry: boolean;
  requiresAction: boolean;
}

export class ErrorMessageMapper {
  getUserFriendlyError(error: VivaWalletError, context?: { terminalName?: string; amount?: number }): UserFriendlyError {
    const mapper = this.getMessageMapper(error.code);
    return mapper(error, context);
  }

  private getMessageMapper(code: ErrorCode): (error: VivaWalletError, context?: any) => UserFriendlyError {
    const mappers: Record<ErrorCode, (error: VivaWalletError, context?: any) => UserFriendlyError> = {
      [ErrorCode.NETWORK_CONNECTION_REFUSED]: (error, context) => ({
        title: "Cannot Connect to Terminal",
        message: context?.terminalName
          ? `Cannot connect to ${context.terminalName}. Please ensure the terminal is powered on and connected to the network.`
          : "Cannot connect to payment terminal. Please check the connection.",
        suggestions: ["Verify terminal is powered on", "Check network connection", "Verify terminal IP address in settings", "Ensure terminal is on the same network"],
        canRetry: true,
        requiresAction: true,
      }),

      [ErrorCode.NETWORK_TIMEOUT]: (error, context) => ({
        title: "Connection Timeout",
        message: "The connection to the terminal timed out. This may be due to network issues.",
        suggestions: ["Check network connectivity", "Verify terminal is responding", "Try again in a moment", "Check firewall settings"],
        canRetry: true,
        requiresAction: false,
      }),

      [ErrorCode.TERMINAL_OFFLINE]: (error, context) => ({
        title: "Terminal Offline",
        message: context?.terminalName ? `${context.terminalName} appears to be offline.` : "Payment terminal is offline.",
        suggestions: ["Check if terminal is powered on", "Verify network connection", "Restart the terminal app", "Check terminal settings"],
        canRetry: true,
        requiresAction: true,
      }),

      [ErrorCode.TERMINAL_BUSY]: (error, context) => ({
        title: "Terminal Busy",
        message: "The terminal is currently processing another transaction. Please wait.",
        suggestions: ["Wait a moment and try again", "Check if another transaction is in progress"],
        canRetry: true,
        requiresAction: false,
      }),

      [ErrorCode.TRANSACTION_DECLINED]: (error, context) => ({
        title: "Card Declined",
        message: "The card was declined by the bank. Please try a different payment method.",
        suggestions: ["Try a different card", "Check card balance", "Contact your bank", "Use cash or another payment method"],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.TRANSACTION_INSUFFICIENT_FUNDS]: (error, context) => ({
        title: "Insufficient Funds",
        message: `Insufficient funds to complete this transaction.`,
        suggestions: ["Use a different card", "Pay with cash", "Split payment across multiple methods"],
        canRetry: false,
        requiresAction: true,
      }),

      [ErrorCode.TRANSACTION_TIMEOUT]: (error, context) => ({
        title: "Transaction Timeout",
        message: "The transaction took too long to complete. Please try again.",
        suggestions: ["Try the transaction again", "Check network connection", "Ensure card is properly presented"],
        canRetry: true,
        requiresAction: false,
      }),

      // ... additional error message mappers
    };

    return (
      mappers[code] ||
      ((error) => ({
        title: "Error Occurred",
        message: error.message || "An unexpected error occurred. Please try again.",
        suggestions: ["Try again", "Check settings", "Contact support if problem persists"],
        canRetry: error.retryable,
        requiresAction: true,
      }))
    );
  }
}
```

**3.1.4 Error Logging (`error-logger.ts`)**

- [ ] Create structured error logging
- [ ] Log errors with full context (terminal, transaction, user)
- [ ] Exclude sensitive data from logs (API keys, card data)
- [ ] Add error categorization for log filtering
- [ ] Implement error aggregation (duplicate error detection)
- [ ] Add error metrics tracking
- [ ] Create error reports
- [ ] Support log rotation for error logs

**3.1.5 Error Recovery Strategies**

- [ ] Define recovery strategies for each error type
- [ ] Implement automatic recovery actions
- [ ] Add manual recovery options
- [ ] Create recovery action queue
- [ ] Track recovery attempt history
- [ ] Limit recovery attempts

#### 3.2 Retry Logic & Recovery

**Files to Create/Modify:**

- `packages/main/src/services/vivaWallet/retry/retry-manager.ts` - Retry logic implementation
- `packages/main/src/services/vivaWallet/retry/circuit-breaker.ts` - Circuit breaker pattern
- `packages/main/src/services/vivaWallet/recovery/transaction-recovery.ts` - Transaction recovery
- `packages/main/src/services/vivaWallet/recovery/state-persistence.ts` - State persistence for recovery

**Detailed Implementation Tasks:**

**3.2.1 Exponential Backoff Retry (`retry-manager.ts`)**

- [ ] Create `RetryManager` class
- [ ] Implement exponential backoff algorithm
- [ ] Add jitter to prevent thundering herd
- [ ] Configure max retry attempts per error type
- [ ] Support configurable base delay and multipliers
- [ ] Add retry attempt tracking
- [ ] Implement retry cancellation
- [ ] Log retry attempts
- [ ] Emit retry events

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/retry/retry-manager.ts

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: ErrorCode[];
}

export class RetryManager {
  private readonly defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [ErrorCode.NETWORK_CONNECTION_REFUSED, ErrorCode.NETWORK_TIMEOUT, ErrorCode.TERMINAL_BUSY, ErrorCode.TERMINAL_OFFLINE],
  };

  async retryWithBackoff<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const vivaError = error as VivaWalletError;

        // Check if error is retryable
        if (!this.isRetryable(vivaError, finalConfig.retryableErrors)) {
          throw error;
        }

        // Check if we've reached max attempts
        if (attempt === finalConfig.maxAttempts - 1) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, finalConfig);

        // Call retry callback
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        // Wait before retry
        await this.sleep(delay);
      }
    }

    throw lastError || new Error("Retry failed");
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

    // Add jitter (random variation to prevent thundering herd)
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
    }

    // Cap at max delay
    return Math.min(Math.round(delay), config.maxDelay);
  }

  private isRetryable(error: VivaWalletError, retryableErrors: ErrorCode[]): boolean {
    if (error instanceof VivaWalletError) {
      return error.retryable && retryableErrors.includes(error.code);
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**3.2.2 Circuit Breaker Pattern (`circuit-breaker.ts`)**

- [ ] Create `CircuitBreaker` class
- [ ] Implement three states: CLOSED, OPEN, HALF_OPEN
- [ ] Configure failure threshold
- [ ] Add timeout for OPEN state
- [ ] Implement success threshold for HALF_OPEN
- [ ] Track failure rates
- [ ] Emit circuit breaker state changes
- [ ] Support per-terminal circuit breakers

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/retry/circuit-breaker.ts

export enum CircuitState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, reject requests
  HALF_OPEN = "half-open", // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Successes needed in half-open to close
  timeout: number; // Time in OPEN state before trying half-open
  resetTimeout: number; // Time to wait before resetting failure count
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private nextAttemptTime: Date | null = null;

  constructor(private readonly terminalId: string, private readonly config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if we should attempt the operation
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && new Date() < this.nextAttemptTime) {
        throw new TerminalError(ErrorCode.TERMINAL_ERROR, `Circuit breaker is OPEN for terminal ${this.terminalId}. Please try again later.`, this.terminalId);
      }
      // Transition to half-open
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed again in half-open, go back to open
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
    } else if (this.failureCount >= this.config.failureThreshold) {
      // Too many failures, open the circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }
}
```

**3.2.3 Transaction Recovery Mechanism (`transaction-recovery.ts`)**

- [ ] Create `TransactionRecovery` class
- [ ] Implement recovery on app restart
- [ ] Query terminal for pending transactions
- [ ] Reconcile local and terminal transaction states
- [ ] Resume polling for incomplete transactions
- [ ] Handle orphaned transactions
- [ ] Clean up stale transactions
- [ ] Implement transaction state verification
- [ ] Add recovery metrics tracking

**Implementation Example:**

```typescript
// packages/main/src/services/vivaWallet/recovery/transaction-recovery.ts

export class TransactionRecovery {
  async recoverPendingTransactions(): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      recovered: [],
      failed: [],
      orphaned: [],
    };

    // Get all pending transactions from local storage
    const pendingTransactions = await this.getPendingTransactions();

    for (const tx of pendingTransactions) {
      try {
        const recoveryStatus = await this.recoverTransaction(tx);

        switch (recoveryStatus.status) {
          case "recovered":
            result.recovered.push(tx);
            break;
          case "failed":
            result.failed.push({ transaction: tx, reason: recoveryStatus.reason });
            break;
          case "orphaned":
            result.orphaned.push(tx);
            break;
        }
      } catch (error) {
        logger.error(`Failed to recover transaction ${tx.id}:`, error);
        result.failed.push({ transaction: tx, reason: error.message });
      }
    }

    return result;
  }

  private async recoverTransaction(transaction: PendingTransaction): Promise<RecoveryStatus> {
    const terminal = await this.getTerminal(transaction.terminalId);
    if (!terminal) {
      return { status: "failed", reason: "Terminal not found" };
    }

    // Query terminal for transaction status
    try {
      const httpClient = new VivaWalletHTTPClient(terminal);
      const status = await httpClient.get(`/api/transactions/${transaction.terminalTransactionId}/status`);

      // Check if transaction is still pending on terminal
      if (status.data.status === "pending" || status.data.status === "processing") {
        // Resume polling
        await this.resumePolling(transaction);
        return { status: "recovered" };
      }

      // Transaction completed on terminal but not in our system
      if (status.data.status === "completed") {
        await this.finalizeTransaction(transaction, status.data);
        return { status: "recovered" };
      }

      // Transaction failed or cancelled
      if (status.data.status === "failed" || status.data.status === "cancelled") {
        await this.markTransactionAsFailed(transaction, status.data);
        return { status: "failed", reason: status.data.status };
      }
    } catch (error) {
      // Terminal doesn't know about this transaction (orphaned)
      if (error.code === "TRANSACTION_NOT_FOUND") {
        return { status: "orphaned" };
      }
      throw error;
    }

    return { status: "failed", reason: "Unknown status" };
  }

  private isStale(transaction: PendingTransaction): boolean {
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const elapsed = Date.now() - transaction.startedAt.getTime();
    return elapsed > staleThreshold;
  }
}
```

**3.2.4 State Persistence (`state-persistence.ts`)**

- [ ] Create transaction state storage
- [ ] Implement state serialization/deserialization
- [ ] Add state versioning for migration
- [ ] Store state to database/file
- [ ] Load state on app startup
- [ ] Handle state corruption gracefully
- [ ] Implement state cleanup (remove old states)
- [ ] Add state backup/restore

**3.2.5 Manual Intervention Triggers**

- [ ] Detect when manual intervention is required
- [ ] Create user notification system
- [ ] Add intervention request queue
- [ ] Track intervention history
- [ ] Support intervention cancellation
- [ ] Add intervention timeouts

#### 3.3 Error Handling Integration

**Files to Modify:**

- `packages/main/src/services/vivaWallet/http-client.ts` - Add error handling integration
- `packages/main/src/services/vivaWallet/transaction-manager.ts` - Add error recovery
- `packages/main/src/services/vivaWallet/vivaWalletService.ts` - Integrate error handlers

**Detailed Implementation Tasks:**

**3.3.1 HTTP Client Error Handling**

- [ ] Integrate error classifier into HTTP client
- [ ] Add retry logic to HTTP requests
- [ ] Implement circuit breaker per terminal
- [ ] Add error logging for all HTTP errors
- [ ] Transform errors to user-friendly messages

**3.3.2 Transaction Manager Error Recovery**

- [ ] Add error recovery to transaction initiation
- [ ] Implement automatic retry for transient errors
- [ ] Add transaction recovery on failure
- [ ] Handle partial transaction states
- [ ] Implement transaction rollback on critical errors

**3.3.3 Service-Level Error Handling**

- [ ] Add global error handler
- [ ] Implement error aggregation
- [ ] Create error reporting system
- [ ] Add error metrics collection
- [ ] Implement error notification system

#### 3.4 Phase 3 Completion Checklist

**Week 5 Deliverables:**

- [ ] All error types defined and classified
- [ ] Error classification logic working
- [ ] User-friendly error messages implemented
- [ ] Error logging system in place
- [ ] Retry logic with exponential backoff working
- [ ] Circuit breaker pattern implemented
- [ ] Transaction recovery mechanism working
- [ ] State persistence implemented
- [ ] Error handling integrated across all components
- [ ] Error metrics and reporting working

**Success Criteria:**

- ✅ All errors are properly classified
- ✅ User-friendly error messages displayed
- ✅ Retry logic handles transient errors
- ✅ Circuit breaker prevents cascading failures
- ✅ Transactions recover from failures
- ✅ Error logging captures all necessary context
- ✅ No sensitive data in error logs
- ✅ Error recovery works on app restart
- ✅ Error metrics are tracked
- ✅ Manual intervention properly triggered

### Phase 4: UI Integration (Week 6-7)

#### 4.1 Payment Method Selector

**Files to Create:**

- `packages/renderer/src/features/sales/components/payment/viva-wallet-selector.tsx` - Viva Wallet payment option component
- `packages/renderer/src/features/sales/components/payment/terminal-selector-modal.tsx` - Terminal selection modal

**Files to Modify:**

- `packages/renderer/src/features/sales/components/payment/payment-method-selector.tsx` - Add Viva Wallet option
- `packages/renderer/src/types/domain/payment.ts` - Add viva_wallet payment method type
- `packages/renderer/src/features/sales/hooks/use-viva-wallet.ts` - Create Viva Wallet hook

**Detailed Implementation Tasks:**

**4.1.1 Update Payment Method Types**

- [ ] Add `"viva_wallet"` to `PaymentMethodType` enum in `packages/renderer/src/types/domain/payment.ts`
- [ ] Update `PaymentMethod` interface to support terminal selection
- [ ] Add terminal metadata to payment method for Viva Wallet
- [ ] Update payment validation logic to support Viva Wallet

**Implementation Example:**

```typescript
// packages/renderer/src/types/domain/payment.ts

export type PaymentMethodType = "cash" | "card" | "mobile" | "voucher" | "split" | "viva_wallet";

export interface PaymentMethod {
  type: PaymentMethodType;
  amount: number;
  reference?: string;
  last4?: string;
  cardType?: string;

  // Viva Wallet specific
  terminalId?: string;
  terminalName?: string;
  provider?: "bbpos" | "viva_wallet" | "simulated";
}
```

**4.1.2 Create Viva Wallet Hook (`use-viva-wallet.ts`)**

- [ ] Create React hook for Viva Wallet operations
- [ ] Implement terminal discovery functionality
- [ ] Add terminal status monitoring
- [ ] Implement connection management
- [ ] Add terminal selection state
- [ ] Handle terminal connection errors
- [ ] Provide terminal list and status

**Implementation Example:**

```typescript
// packages/renderer/src/features/sales/hooks/use-viva-wallet.ts

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("use-viva-wallet");

export interface Terminal {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: "online" | "offline" | "busy";
  terminalType: "dedicated" | "device-based";
  paymentCapabilities: {
    supportsNFC: boolean;
    supportsCardReader: boolean;
    supportsChip: boolean;
    supportsSwipe: boolean;
    supportsTap: boolean;
  };
}

export function useVivaWallet() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  // Discover terminals
  const discoverTerminals = useCallback(async () => {
    setIsDiscovering(true);
    try {
      if (!window.vivaWalletAPI) {
        throw new Error("Viva Wallet API not available");
      }

      const result = await window.vivaWalletAPI.discoverTerminals();

      if (result.success && result.terminals) {
        setTerminals(result.terminals);
        return result.terminals;
      } else {
        throw new Error(result.error || "Failed to discover terminals");
      }
    } catch (error) {
      logger.error("Failed to discover terminals:", error);
      toast.error("Failed to discover terminals. Please check network connection.");
      return [];
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  // Connect to terminal
  const connectTerminal = useCallback(
    async (terminalId: string) => {
      setIsConnecting(true);
      setConnectionStatus("connecting");

      try {
        if (!window.vivaWalletAPI) {
          throw new Error("Viva Wallet API not available");
        }

        const result = await window.vivaWalletAPI.connectTerminal(terminalId);

        if (result.success) {
          const terminal = terminals.find((t) => t.id === terminalId);
          if (terminal) {
            setSelectedTerminal(terminal);
            setConnectionStatus("connected");
            toast.success(`Connected to ${terminal.name}`);
          }
          return true;
        } else {
          throw new Error(result.error || "Failed to connect to terminal");
        }
      } catch (error) {
        logger.error("Failed to connect to terminal:", error);
        setConnectionStatus("disconnected");
        toast.error(error instanceof Error ? error.message : "Failed to connect to terminal");
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [terminals]
  );

  // Get terminal status
  const refreshTerminalStatus = useCallback(async () => {
    if (!selectedTerminal) return;

    try {
      const result = await window.vivaWalletAPI?.getTerminalStatus();
      if (result?.status) {
        // Update terminal status
        setTerminals((prev) => prev.map((t) => (t.id === selectedTerminal.id ? { ...t, status: result.status } : t)));
      }
    } catch (error) {
      logger.error("Failed to get terminal status:", error);
    }
  }, [selectedTerminal]);

  // Auto-refresh terminal status periodically
  useEffect(() => {
    if (!selectedTerminal) return;

    const interval = setInterval(() => {
      refreshTerminalStatus();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [selectedTerminal, refreshTerminalStatus]);

  return {
    terminals,
    selectedTerminal,
    isDiscovering,
    isConnecting,
    connectionStatus,
    discoverTerminals,
    connectTerminal,
    setSelectedTerminal,
    refreshTerminalStatus,
  };
}
```

**4.1.3 Update Payment Method Selector Component**

- [ ] Add Viva Wallet button to payment method selector
- [ ] Show terminal connection status indicator
- [ ] Display available terminals count
- [ ] Add terminal selection modal trigger
- [ ] Show terminal type badge (device-based/dedicated)
- [ ] Display payment capability indicators
- [ ] Handle terminal selection flow
- [ ] Add loading states for terminal operations

**Implementation Example:**

```typescript
// Updated payment-method-selector.tsx

import { TerminalSelectorModal } from "./terminal-selector-modal";
import { useVivaWallet } from "../../hooks/use-viva-wallet";

export function PaymentMethodSelector({ cardReaderReady, onSelect, onCancel }: PaymentMethodSelectorProps) {
  const [showTerminalSelector, setShowTerminalSelector] = useState(false);
  const { terminals, selectedTerminal, connectionStatus, isDiscovering } = useVivaWallet();

  const handleVivaWalletSelect = () => {
    if (!selectedTerminal) {
      // Show terminal selector if no terminal selected
      setShowTerminalSelector(true);
    } else {
      onSelect("viva_wallet");
    }
  };

  const isVivaWalletReady = selectedTerminal && connectionStatus === "connected";

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Existing payment methods */}
        {/* ... */}

        {/* Viva Wallet Payment Option */}
        <Button
          variant="outline"
          className={`h-14 sm:h-16 border-slate-300 text-slate-700 text-sm sm:text-base touch-manipulation ${
            isVivaWalletReady ? "bg-white hover:bg-slate-50" : "bg-gray-100 cursor-not-allowed opacity-60"
          }`}
          onClick={handleVivaWalletSelect}
          disabled={!isVivaWalletReady}
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <span>Viva Wallet</span>
              {selectedTerminal && <TerminalTypeBadge type={selectedTerminal.terminalType} />}
            </div>
            <span className="text-[10px] sm:text-xs text-slate-500">{isVivaWalletReady ? selectedTerminal.name : isDiscovering ? "Discovering..." : "Select Terminal"}</span>
            {selectedTerminal && (
              <div className="flex gap-1 mt-1">
                <PaymentCapabilityBadges capabilities={selectedTerminal.paymentCapabilities} />
              </div>
            )}
          </div>
        </Button>

        {/* Cancel button */}
        {/* ... */}
      </div>

      {/* Terminal Selector Modal */}
      <TerminalSelectorModal
        open={showTerminalSelector}
        onClose={() => setShowTerminalSelector(false)}
        onSelect={(terminal) => {
          setShowTerminalSelector(false);
          onSelect("viva_wallet");
        }}
      />
    </>
  );
}
```

**4.1.4 Create Terminal Selector Modal**

- [ ] Create modal component for terminal selection
- [ ] Display list of discovered terminals
- [ ] Show terminal status indicators
- [ ] Display terminal type and capabilities
- [ ] Add terminal discovery button
- [ ] Show connection status for each terminal
- [ ] Implement terminal selection logic
- [ ] Add manual terminal entry option
- [ ] Show terminal connection errors

**4.1.5 Create Terminal Status Components**

- [ ] Create `TerminalStatusBadge` component
- [ ] Create `TerminalTypeBadge` component (device-based/dedicated)
- [ ] Create `PaymentCapabilityBadges` component (NFC, Chip, Swipe indicators)
- [ ] Add visual indicators for terminal health
- [ ] Display terminal connection quality

#### 4.2 Transaction Status Display

**Files to Create:**

- `packages/renderer/src/features/sales/components/payment/viva-wallet-status.tsx` - Main status component
- `packages/renderer/src/features/sales/components/payment/viva-wallet-progress.tsx` - Progress indicator
- `packages/renderer/src/features/sales/components/payment/viva-wallet-error-display.tsx` - Error display component
- `packages/renderer/src/features/sales/hooks/use-viva-wallet-transaction.ts` - Transaction hook

**Detailed Implementation Tasks:**

**4.2.1 Create Transaction Hook (`use-viva-wallet-transaction.ts`)**

- [ ] Create hook for managing Viva Wallet transactions
- [ ] Implement transaction initiation
- [ ] Add status polling
- [ ] Handle transaction events
- [ ] Manage transaction state
- [ ] Implement transaction cancellation
- [ ] Handle error states
- [ ] Provide transaction status updates

**Implementation Example:**

```typescript
// packages/renderer/src/features/sales/hooks/use-viva-wallet-transaction.ts

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { getLogger } from "@/shared/utils/logger";

const logger = getLogger("use-viva-wallet-transaction");

export interface TransactionStatus {
  transactionId: string;
  status: "pending" | "processing" | "awaiting_card" | "completed" | "failed" | "cancelled";
  progress?: number;
  message?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function useVivaWalletTransaction() {
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initiate transaction
  const initiateTransaction = useCallback(async (terminalId: string, amount: number, currency: string): Promise<string | null> => {
    setIsProcessing(true);

    try {
      if (!window.vivaWalletAPI) {
        throw new Error("Viva Wallet API not available");
      }

      const result = await window.vivaWalletAPI.initiateSale(amount, currency);

      if (result.success && result.transactionId) {
        setTransactionStatus({
          transactionId: result.transactionId,
          status: "pending",
          progress: 0,
          message: "Transaction initiated",
        });

        // Start polling for status
        startPolling(result.transactionId);

        return result.transactionId;
      } else {
        throw new Error(result.error || "Failed to initiate transaction");
      }
    } catch (error) {
      logger.error("Failed to initiate transaction:", error);
      toast.error(error instanceof Error ? error.message : "Failed to initiate transaction");
      setIsProcessing(false);
      return null;
    }
  }, []);

  // Start polling for transaction status
  const startPolling = useCallback((transactionId: string) => {
    // Clear existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const poll = async () => {
      try {
        const result = await window.vivaWalletAPI?.getTransactionStatus(transactionId);

        if (result?.status) {
          setTransactionStatus(result.status);

          // Stop polling if transaction is in final state
          if (["completed", "failed", "cancelled"].includes(result.status.status)) {
            stopPolling();
            setIsProcessing(false);
          }
        }
      } catch (error) {
        logger.error("Failed to poll transaction status:", error);
      }
    };

    // Poll every 500ms for active transactions
    pollingIntervalRef.current = setInterval(poll, 500);

    // Initial poll
    poll();
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Cancel transaction
  const cancelTransaction = useCallback(async () => {
    if (!transactionStatus) return;

    try {
      const result = await window.vivaWalletAPI?.cancelTransaction(transactionStatus.transactionId);

      if (result?.success) {
        stopPolling();
        setTransactionStatus({
          ...transactionStatus,
          status: "cancelled",
        });
        setIsProcessing(false);
        toast.info("Transaction cancelled");
      }
    } catch (error) {
      logger.error("Failed to cancel transaction:", error);
      toast.error("Failed to cancel transaction");
    }
  }, [transactionStatus, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    transactionStatus,
    isProcessing,
    initiateTransaction,
    cancelTransaction,
    stopPolling,
  };
}
```

**4.2.2 Create Transaction Status Component (`viva-wallet-status.tsx`)**

- [ ] Create main status display component
- [ ] Show transaction progress indicator
- [ ] Display current transaction state
- [ ] Show transaction amount and currency
- [ ] Display terminal information
- [ ] Add cancel transaction button
- [ ] Show status messages
- [ ] Handle different transaction states visually
- [ ] Add animations for state transitions

**Implementation Example:**

```typescript
// packages/renderer/src/features/sales/components/payment/viva-wallet-status.tsx

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, CreditCard, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { VivaWalletProgress } from "./viva-wallet-progress";
import { VivaWalletErrorDisplay } from "./viva-wallet-error-display";
import type { TransactionStatus } from "../../hooks/use-viva-wallet-transaction";

interface VivaWalletStatusProps {
  transactionStatus: TransactionStatus;
  amount: number;
  currency: string;
  terminalName: string;
  onCancel: () => void;
}

export function VivaWalletStatus({ transactionStatus, amount, currency, terminalName, onCancel }: VivaWalletStatusProps) {
  const getStatusIcon = () => {
    switch (transactionStatus.status) {
      case "completed":
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case "failed":
        return <XCircle className="h-8 w-8 text-red-500" />;
      case "cancelled":
        return <X className="h-8 w-8 text-gray-500" />;
      default:
        return <CreditCard className="h-8 w-8 text-blue-500 animate-pulse" />;
    }
  };

  const getStatusMessage = () => {
    switch (transactionStatus.status) {
      case "pending":
        return "Preparing transaction...";
      case "processing":
        return "Processing payment...";
      case "awaiting_card":
        return "Please present your card to the terminal";
      case "completed":
        return "Payment successful!";
      case "failed":
        return transactionStatus.error?.message || "Transaction failed";
      case "cancelled":
        return "Transaction cancelled";
      default:
        return "Processing...";
    }
  };

  const canCancel = ["pending", "processing", "awaiting_card"].includes(transactionStatus.status);

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="pt-6 px-6">
        <div className="flex flex-col items-center gap-4">
          {/* Status Icon */}
          <div>{getStatusIcon()}</div>

          {/* Status Message */}
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-700">{getStatusMessage()}</p>
            <p className="text-sm text-slate-500 mt-1">Terminal: {terminalName}</p>
          </div>

          {/* Amount Display */}
          <div className="text-2xl font-bold text-slate-900">
            {new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: currency,
            }).format(amount / 100)}
          </div>

          {/* Progress Indicator */}
          {transactionStatus.status !== "completed" && transactionStatus.status !== "failed" && transactionStatus.status !== "cancelled" && (
            <VivaWalletProgress status={transactionStatus.status} progress={transactionStatus.progress} />
          )}

          {/* Error Display */}
          {transactionStatus.error && <VivaWalletErrorDisplay error={transactionStatus.error} />}

          {/* Cancel Button */}
          {canCancel && (
            <Button variant="outline" onClick={onCancel} className="mt-2">
              <X className="h-4 w-4 mr-2" />
              Cancel Transaction
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**4.2.3 Create Progress Indicator Component**

- [ ] Create animated progress bar
- [ ] Show progress percentage
- [ ] Display step-by-step progress
- [ ] Add loading animations
- [ ] Show time elapsed
- [ ] Display estimated time remaining

**4.2.4 Create Error Display Component**

- [ ] Display user-friendly error messages
- [ ] Show error suggestions/actions
- [ ] Add retry button for retryable errors
- [ ] Display error code for debugging (optional)
- [ ] Show help links/documentation

**4.2.5 Integrate with Payment Flow**

- [ ] Integrate status component into payment panel
- [ ] Update payment flow state machine
- [ ] Handle transaction completion
- [ ] Update transaction state on status changes
- [ ] Add transaction success/failure handling

#### 4.3 Settings UI

**Files to Create:**

- `packages/renderer/src/features/settings/views/viva-wallet-settings-view.tsx` - Main settings view
- `packages/renderer/src/features/settings/components/terminal-list.tsx` - Terminal list component
- `packages/renderer/src/features/settings/components/terminal-discovery-panel.tsx` - Discovery UI
- `packages/renderer/src/features/settings/components/terminal-config-form.tsx` - Configuration form
- `packages/renderer/src/features/settings/components/terminal-status-card.tsx` - Terminal status card
- `packages/renderer/src/features/settings/hooks/use-viva-wallet-settings.ts` - Settings hook

**Files to Modify:**

- `packages/renderer/src/features/settings/config/feature-config.ts` - Add Viva Wallet settings route
- `packages/renderer/src/features/settings/config/navigation.ts` - Add navigation route

**Detailed Implementation Tasks:**

**4.3.1 Create Settings View (`viva-wallet-settings-view.tsx`)**

- [ ] Create main settings container
- [ ] Add enable/disable toggle for Viva Wallet
- [ ] Display terminal list section
- [ ] Add terminal discovery section
- [ ] Include terminal configuration section
- [ ] Add settings validation feedback
- [ ] Implement settings persistence
- [ ] Add navigation/back button

**Implementation Example:**

```typescript
// packages/renderer/src/features/settings/views/viva-wallet-settings-view.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { TerminalList } from "../components/terminal-list";
import { TerminalDiscoveryPanel } from "../components/terminal-discovery-panel";
import { useVivaWalletSettings } from "../hooks/use-viva-wallet-settings";

export default function VivaWalletSettingsView({ onBack }: { onBack: () => void }) {
  const { enabled, terminals, isDiscovering, setEnabled, discoverTerminals, addTerminal, updateTerminal, deleteTerminal, testConnection, saveSettings } = useVivaWalletSettings();

  const [showDiscovery, setShowDiscovery] = useState(false);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Viva Wallet Settings</h1>
          <p className="text-sm text-slate-500">Configure payment terminals for Viva Wallet</p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Viva Wallet Integration</CardTitle>
          <CardDescription>Enable or disable Viva Wallet payment processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-viva-wallet" className="text-base">
              Enable Viva Wallet
            </Label>
            <Switch id="enable-viva-wallet" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* Terminal List */}
      {enabled && (
        <>
          <TerminalList terminals={terminals} onEdit={updateTerminal} onDelete={deleteTerminal} onTest={testConnection} />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={() => setShowDiscovery(true)}>Discover Terminals</Button>
            <Button variant="outline" onClick={saveSettings}>
              Save Settings
            </Button>
          </div>

          {/* Discovery Panel */}
          {showDiscovery && <TerminalDiscoveryPanel onClose={() => setShowDiscovery(false)} onSelect={addTerminal} />}
        </>
      )}
    </div>
  );
}
```

**4.3.2 Create Terminal List Component**

- [ ] Display configured terminals in a list
- [ ] Show terminal status for each terminal
- [ ] Display terminal type and capabilities
- [ ] Add edit/delete actions
- [ ] Include test connection button
- [ ] Show terminal connection health
- [ ] Add terminal enable/disable toggle

**4.3.3 Create Terminal Discovery Panel**

- [ ] Create discovery panel/modal
- [ ] Show scanning progress
- [ ] Display discovered terminals
- [ ] Add terminal type indicators
- [ ] Show capability badges
- [ ] Allow adding discovered terminals
- [ ] Display discovery errors
- [ ] Add manual terminal entry option

**4.3.4 Create Terminal Configuration Form**

- [ ] Create form for terminal configuration
- [ ] Add fields: Name, IP Address, Port, API Key
- [ ] Implement validation (IP format, port range)
- [ ] Add terminal type selection
- [ ] Include device info fields (optional)
- [ ] Add test connection functionality
- [ ] Show validation errors
- [ ] Support both new and edit modes

**4.3.5 Create Settings Hook (`use-viva-wallet-settings.ts`)**

- [ ] Create hook for settings management
- [ ] Load settings on mount
- [ ] Handle settings save
- [ ] Manage terminal CRUD operations
- [ ] Implement terminal discovery
- [ ] Handle connection testing
- [ ] Add settings validation
- [ ] Manage loading states

**4.3.6 Update Settings Navigation**

- [ ] Add Viva Wallet settings route
- [ ] Update settings navigation config
- [ ] Add settings permissions check
- [ ] Include in settings menu
- [ ] Add navigation icon

**4.3.7 Create Terminal Status Card**

- [ ] Display terminal status visually
- [ ] Show connection health indicator
- [ ] Display last seen timestamp
- [ ] Show terminal capabilities
- [ ] Add quick actions (connect, test, edit)
- [ ] Display terminal metadata

#### 4.4 Extend Preload API

**Files to Modify:**

- `packages/preload/src/api/system.ts` - Add Viva Wallet API methods
- `packages/preload/src/exposed.ts` - Update type definitions

**Detailed Implementation Tasks:**

**4.4.1 Add Viva Wallet IPC Handlers**

- [ ] Register all Viva Wallet IPC handlers in main process
- [ ] Ensure proper error handling in handlers
- [ ] Add request validation
- [ ] Implement response formatting
- [ ] Add logging for all IPC calls

**4.4.2 Update Preload API**

- [ ] Add `vivaWalletAPI` to window object
- [ ] Expose all terminal management methods
- [ ] Expose transaction methods
- [ ] Expose status polling methods
- [ ] Add proper TypeScript types
- [ ] Ensure security (context isolation)

**Implementation Example:**

```typescript
// packages/preload/src/api/system.ts

export const vivaWalletAPI = {
  // Terminal Discovery
  discoverTerminals: () => ipcRenderer.invoke("viva:discover-terminals"),
  connectTerminal: (terminalId: string) => ipcRenderer.invoke("viva:connect-terminal", terminalId),
  disconnectTerminal: () => ipcRenderer.invoke("viva:disconnect-terminal"),
  getTerminalStatus: () => ipcRenderer.invoke("viva:terminal-status"),

  // Transactions
  initiateSale: (amount: number, currency: string) => ipcRenderer.invoke("viva:initiate-sale", amount, currency),
  initiateRefund: (transactionId: string, amount: number) => ipcRenderer.invoke("viva:initiate-refund", transactionId, amount),
  cancelTransaction: (transactionId: string) => ipcRenderer.invoke("viva:cancel-transaction", transactionId),

  // Status
  getTransactionStatus: (transactionId: string) => ipcRenderer.invoke("viva:transaction-status", transactionId),

  // Configuration
  getConfig: () => ipcRenderer.invoke("viva:get-config"),
  saveConfig: (config: VivaWalletConfig) => ipcRenderer.invoke("viva:save-config", config),
  testConnection: (terminalId: string) => ipcRenderer.invoke("viva:test-connection", terminalId),
};
```

#### 4.5 Payment Flow Integration

**Files to Modify:**

- `packages/renderer/src/features/sales/services/payment-flow.ts` - Add Viva Wallet flow
- `packages/renderer/src/features/sales/components/payment/payment-panel.tsx` - Integrate status display

**Detailed Implementation Tasks:**

**4.5.1 Update Payment Flow**

- [ ] Add Viva Wallet payment method to flow
- [ ] Integrate terminal selection step
- [ ] Add transaction initiation step
- [ ] Integrate status polling
- [ ] Handle transaction completion
- [ ] Add error handling
- [ ] Support transaction cancellation

**4.5.2 Update Payment Panel**

- [ ] Add Viva Wallet status display
- [ ] Show terminal information
- [ ] Display transaction progress
- [ ] Integrate cancel button
- [ ] Handle error display
- [ ] Update payment method display

#### 4.6 Phase 4 Completion Checklist

**Week 6 Deliverables:**

- [ ] Payment method selector updated with Viva Wallet
- [ ] Terminal selector modal created
- [ ] Viva Wallet hook implemented
- [ ] Transaction status component created
- [ ] Transaction hook implemented
- [ ] Settings view structure created
- [ ] Settings navigation updated

**Week 7 Deliverables:**

- [ ] All UI components completed
- [ ] Settings fully functional
- [ ] Terminal discovery UI working
- [ ] Terminal configuration forms working
- [ ] Payment flow integrated
- [ ] Status display working
- [ ] Error display working
- [ ] Preload API extended
- [ ] All IPC handlers registered
- [ ] UI testing completed
- [ ] Accessibility checks passed

**Success Criteria:**

- ✅ Viva Wallet appears as payment option
- ✅ Terminal selection works
- ✅ Transaction status displays correctly
- ✅ Settings UI is complete and functional
- ✅ Terminal discovery works from UI
- ✅ Error messages are user-friendly
- ✅ All UI components follow design system
- ✅ Accessibility standards met
- ✅ Mobile/touch-friendly UI
- ✅ Loading states properly displayed
- ✅ Error states handled gracefully

### Phase 5: Refund Support (Week 8)

#### 5.1 Refund Transaction Flow

**Integration Points:**

- `packages/renderer/src/features/sales/components/modals/refund-transaction-modal.tsx`
- `packages/main/src/database/managers/transactionManager.ts`

**Key Tasks:**

- [ ] Add Viva Wallet refund option
- [ ] Implement refund transaction initiation
- [ ] Handle refund status polling
- [ ] Update transaction records
- [ ] Generate refund receipts

### Phase 6: Testing & Quality Assurance (Week 9-10)

#### 6.1 Unit Tests

**Test Coverage:**

- Terminal discovery logic
- Transaction processing
- Error handling
- Status polling
- Retry mechanisms

#### 6.2 Integration Tests

**Test Scenarios:**

- End-to-end payment flow
- Terminal disconnection handling
- Network interruption recovery
- Refund transactions
- Concurrent transaction handling

#### 6.3 Hardware Testing

**Test Devices:**

- Android devices with Viva.com Terminal
- iOS devices with Tap to Pay
- Paydroid devices (if available)

---

## Technical Specifications

### API Endpoints (Viva Wallet Local Terminal API)

Based on standard peer-to-peer payment terminal APIs, expected endpoints:

#### 1. Terminal Discovery

```
GET http://{terminal-ip}:{port}/api/status
Response: {
  "terminalId": "string",
  "status": "ready" | "busy" | "offline",
  "firmwareVersion": "string",
  "capabilities": ["sale", "refund", "cancel"]
}
```

#### 2. Initiate Sale

```
POST http://{terminal-ip}:{port}/api/transactions/sale
Headers: {
  "Authorization": "Bearer {api-key}",
  "Content-Type": "application/json"
}
Body: {
  "amount": 10000,  // in minor units (cents)
  "currency": "EUR",
  "reference": "POS-12345",
  "description": "Purchase at Store"
}
Response: {
  "transactionId": "string",
  "status": "pending" | "processing" | "completed" | "failed",
  "pollingUrl": "/api/transactions/{transactionId}/status"
}
```

#### 3. Poll Transaction Status

```
GET http://{terminal-ip}:{port}/api/transactions/{transactionId}/status
Headers: {
  "Authorization": "Bearer {api-key}"
}
Response: {
  "transactionId": "string",
  "status": "pending" | "processing" | "completed" | "failed" | "cancelled",
  "amount": 10000,
  "currency": "EUR",
  "cardDetails": {
    "last4": "1234",
    "brand": "VISA",
    "type": "DEBIT" | "CREDIT"
  },
  "authCode": "string",
  "timestamp": "ISO8601",
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

#### 4. Cancel Transaction

```
POST http://{terminal-ip}:{port}/api/transactions/{transactionId}/cancel
Headers: {
  "Authorization": "Bearer {api-key}"
}
Response: {
  "success": boolean,
  "message": "string"
}
```

#### 5. Initiate Refund

```
POST http://{terminal-ip}:{port}/api/transactions/refund
Headers: {
  "Authorization": "Bearer {api-key}",
  "Content-Type": "application/json"
}
Body: {
  "originalTransactionId": "string",
  "amount": 10000,
  "currency": "EUR",
  "reference": "REFUND-12345"
}
```

### Data Models

#### Terminal Interface

```typescript
interface Terminal {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: "online" | "offline" | "busy";
  firmwareVersion?: string;
  capabilities: string[];
  lastSeen: Date;
  connectionType: "wifi" | "ethernet";

  // Device-as-Terminal Properties
  terminalType: "dedicated" | "device-based";
  deviceInfo?: {
    platform: "android" | "ios" | "paydroid";
    deviceModel?: string;
    osVersion?: string;
  };
  paymentCapabilities: {
    supportsNFC: boolean;
    supportsCardReader: boolean;
    supportsChip: boolean;
    supportsSwipe: boolean;
    supportsTap: boolean;
  };
}
```

#### Transaction Request

```typescript
interface VivaWalletSaleRequest {
  amount: number; // in minor units (cents)
  currency: string; // ISO 4217 currency code
  reference: string; // Unique reference from POS
  description?: string;
  metadata?: Record<string, string>;
}
```

#### Transaction Response

```typescript
interface VivaWalletTransactionResponse {
  transactionId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  amount: number;
  currency: string;
  cardDetails?: {
    last4: string;
    brand: string;
    type: "DEBIT" | "CREDIT";
    expiryMonth?: number;
    expiryYear?: number;
  };
  authCode?: string;
  timestamp: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

#### Transaction Status

```typescript
interface TransactionStatus {
  transactionId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress?: number; // 0-100 for UI progress indicator
  message?: string;
  requiresAction?: boolean;
  error?: TransactionError;
}
```

### Configuration Schema

```typescript
interface VivaWalletConfig {
  enabled: boolean;
  terminals: TerminalConfig[];
  defaultTerminalId?: string;
  timeout: {
    connection: number; // milliseconds
    transaction: number; // milliseconds
    polling: number; // milliseconds
  };
  retry: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  network: {
    scanRange?: string; // e.g., "192.168.1.0/24"
    scanPort?: number;
    useMDNS?: boolean;
  };
}

interface TerminalConfig {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  apiKey: string;
  enabled: boolean;
  autoConnect: boolean;
}
```

### HTTP Client Implementation

**Library:** Use `axios` with custom configuration

**Features:**

- Automatic retry with exponential backoff
- Request/response interceptors
- Timeout handling
- Connection pooling
- Error classification

```typescript
import axios, { AxiosInstance, AxiosError } from "axios";

class VivaWalletHTTPClient {
  private client: AxiosInstance;

  constructor(terminal: Terminal) {
    this.client = axios.create({
      baseURL: `http://${terminal.ipAddress}:${terminal.port}`,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${terminal.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Log request (without sensitive data)
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Error handling with retry logic
        return this.handleError(error);
      }
    );
  }
}
```

---

## Security & Compliance

### PCI DSS Compliance

**Key Requirements:**

1. **Card Data Handling**

   - ✅ Never store card data in POS application
   - ✅ Terminal handles all card data
   - ✅ Only receive tokenized/truncated card information
   - ✅ Mask card details in logs

2. **Network Security**

   - Use HTTPS for terminal communication (if supported)
   - Implement certificate pinning
   - Use local network isolation
   - Disable external network access for terminal communication

3. **Access Control**

   - Secure API key storage
   - Use environment-specific keys
   - Implement key rotation mechanism
   - Restrict terminal access by IP/MAC address

4. **Audit Logging**
   - Log all transaction attempts
   - Log authentication events
   - Log configuration changes
   - Exclude sensitive data from logs

### Security Best Practices

#### 1. API Key Management

**Storage:**

```typescript
// Use secure storage (encrypted)
import { safeStorage } from "electron";

class SecureConfigStorage {
  private encryptApiKey(key: string): Buffer {
    return safeStorage.encryptString(key);
  }

  private decryptApiKey(encrypted: Buffer): string {
    return safeStorage.decryptString(encrypted);
  }
}
```

**Key Rotation:**

- Implement key expiration
- Support key rotation without downtime
- Validate keys on connection

#### 2. Network Security

**Firewall Rules:**

- Only allow communication from POS to terminal IP
- Block external network access
- Use VPN for remote terminal access (if needed)

**Certificate Validation:**

```typescript
// Validate terminal certificates
if (terminal.usesHTTPS) {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: true,
    ca: terminal.certificateAuthority,
  });
}
```

#### 3. Input Validation

**Transaction Amount:**

```typescript
function validateAmount(amount: number): boolean {
  return (
    amount > 0 && amount <= MAX_TRANSACTION_AMOUNT && Number.isInteger(amount) && amount % 1 === 0 // Must be in minor units (cents)
  );
}
```

**Terminal Configuration:**

```typescript
function validateTerminalConfig(config: TerminalConfig): ValidationResult {
  // Validate IP address format
  // Validate port range
  // Validate API key format
  // Check for duplicate terminals
}
```

#### 4. Error Message Security

**Avoid:**

- Exposing internal system details
- Revealing API keys or credentials
- Showing sensitive transaction data

**Do:**

- Use generic error messages for users
- Log detailed errors server-side only
- Sanitize error responses

### Data Privacy

**Transaction Data:**

- Store only necessary transaction metadata
- Hash sensitive references
- Implement data retention policies
- Support GDPR compliance (if applicable)

**Terminal Information:**

- Encrypt terminal configurations
- Secure terminal credentials
- Limit access to terminal settings

---

## Error Handling & Recovery

### Error Classification

#### 1. Network Errors

**Types:**

- Connection timeout
- Connection refused
- Network unreachable
- DNS resolution failure

**Handling:**

```typescript
class NetworkErrorHandler {
  async handle(error: NetworkError): Promise<RecoveryAction> {
    if (error.isRetryable()) {
      return {
        action: "retry",
        delay: this.calculateBackoff(error.attemptCount),
        maxRetries: 3,
      };
    }

    return {
      action: "user_intervention",
      message: "Cannot connect to terminal. Please check network connection.",
      suggestions: ["Verify terminal is powered on", "Check network connectivity", "Verify terminal IP address"],
    };
  }
}
```

#### 2. Terminal Errors

**Types:**

- Terminal busy
- Terminal offline
- Terminal error
- Firmware mismatch

**Handling:**

- Check terminal status before transaction
- Queue transactions if terminal busy
- Provide terminal reset option
- Display terminal health status

#### 3. Transaction Errors

**Types:**

- Card declined
- Insufficient funds
- Card expired
- Transaction timeout
- Transaction cancelled

**Handling:**

```typescript
class TransactionErrorHandler {
  handle(error: TransactionError): UserMessage {
    const errorMap = {
      DECLINED: "Card was declined. Please try a different card.",
      INSUFFICIENT_FUNDS: "Insufficient funds. Please use a different payment method.",
      EXPIRED_CARD: "Card has expired. Please use a different card.",
      TIMEOUT: "Transaction timed out. Please try again.",
      CANCELLED: "Transaction was cancelled.",
      UNKNOWN: "An error occurred. Please try again or contact support.",
    };

    return {
      message: errorMap[error.code] || errorMap["UNKNOWN"],
      retryable: error.retryable,
      requiresAction: true,
    };
  }
}
```

### Retry Strategy

**Exponential Backoff:**

```typescript
class RetryManager {
  calculateDelay(attempt: number, baseDelay: number = 1000): number {
    const maxDelay = 30000;
    const delay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(delay + jitter, maxDelay);
  }

  async retryWithBackoff<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    throw new Error("Max retries exceeded");
  }
}
```

### Transaction Recovery

**State Persistence:**

```typescript
interface PendingTransaction {
  transactionId: string;
  terminalId: string;
  amount: number;
  currency: string;
  status: "pending" | "processing";
  startedAt: Date;
  lastPolledAt: Date;
}

class TransactionRecovery {
  async recoverPendingTransactions(): Promise<void> {
    const pending = await this.getPendingTransactions();

    for (const tx of pending) {
      if (this.isStale(tx)) {
        await this.handleStaleTransaction(tx);
      } else {
        await this.resumePolling(tx);
      }
    }
  }

  private isStale(tx: PendingTransaction): boolean {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    return Date.now() - tx.lastPolledAt.getTime() > staleThreshold;
  }
}
```

**Recovery Scenarios:**

1. **App Restart During Transaction**

   - Resume polling on startup
   - Check transaction status with terminal
   - Update local transaction state

2. **Network Interruption**

   - Automatically reconnect
   - Resume polling from last known state
   - Handle duplicate transaction prevention

3. **Terminal Restart**
   - Detect terminal reconnection
   - Verify transaction state
   - Continue or restart transaction

---

## Testing Strategy

### Unit Testing

**Test Coverage Goals:** 80%+

**Key Test Areas:**

1. **Terminal Discovery**

```typescript
describe("TerminalDiscovery", () => {
  it("should discover terminals on local network", async () => {
    const discovery = new TerminalDiscovery();
    const terminals = await discovery.discoverTerminals();
    expect(terminals.length).toBeGreaterThan(0);
  });

  it("should handle network errors gracefully", async () => {
    // Mock network failure
    const discovery = new TerminalDiscovery();
    await expect(discovery.discoverTerminals()).rejects.toThrow();
  });
});
```

2. **Transaction Processing**

```typescript
describe("TransactionManager", () => {
  it("should initiate sale transaction", async () => {
    const manager = new TransactionManager(mockTerminal);
    const result = await manager.initiateSale({
      amount: 10000,
      currency: "EUR",
    });
    expect(result.transactionId).toBeDefined();
  });

  it("should handle transaction timeout", async () => {
    // Mock slow terminal response
    const manager = new TransactionManager(mockSlowTerminal);
    await expect(manager.initiateSale({ amount: 10000, currency: "EUR" })).rejects.toThrow("Transaction timeout");
  });
});
```

3. **Error Handling**

```typescript
describe("ErrorHandler", () => {
  it("should classify network errors correctly", () => {
    const error = new NetworkError("ECONNREFUSED");
    expect(error.isRetryable()).toBe(true);
  });

  it("should provide user-friendly error messages", () => {
    const handler = new TransactionErrorHandler();
    const message = handler.handle({
      code: "DECLINED",
      retryable: false,
    });
    expect(message.userFriendly).toBeTruthy();
  });
});
```

### Integration Testing

**Test Scenarios:**

1. **End-to-End Payment Flow**

   - Select Viva Wallet payment method
   - Connect to terminal
   - Initiate transaction
   - Complete payment on terminal
   - Verify transaction completion

2. **Error Recovery**

   - Simulate network interruption
   - Verify automatic reconnection
   - Test transaction recovery

3. **Concurrent Transactions**
   - Multiple terminals
   - Queue management
   - Resource locking

### Hardware Testing

**Test Devices:**

- Android phone with Viva.com Terminal app (device-as-terminal, NFC-only)
- Android tablet with Viva.com Terminal app (device-as-terminal, NFC-only)
- Android device with Viva.com Terminal app + external card reader
- iOS device with Tap to Pay (device-as-terminal, if available)
- Paydroid device (dedicated terminal, if available)

**Device-as-Terminal Testing:**

- [ ] Verify smartphone/tablet can function as terminal
- [ ] Test NFC/Tap-to-Pay functionality
- [ ] Test with external card reader attachment
- [ ] Verify terminal discovery works for device terminals
- [ ] Test capability detection for device terminals
- [ ] Verify same API works for all terminal types

**Test Cases:**

1. **Connection Testing**

   - [ ] Successful terminal discovery
   - [ ] Terminal connection
   - [ ] Connection health monitoring
   - [ ] Reconnection after disconnection

2. **Transaction Testing**

   - [ ] Successful sale transaction
   - [ ] Card decline handling
   - [ ] Transaction timeout
   - [ ] Transaction cancellation
   - [ ] Refund transaction

3. **Network Scenarios**

   - [ ] Network interruption during transaction
   - [ ] Terminal IP address change
   - [ ] Firewall blocking
   - [ ] Slow network conditions

4. **Error Scenarios**
   - [ ] Terminal offline
   - [ ] Terminal busy
   - [ ] Invalid API key
   - [ ] Terminal firmware mismatch

### Performance Testing

**Metrics:**

- Transaction initiation time: < 1 second
- Status polling interval: 500ms - 2s
- Terminal discovery time: < 5 seconds
- Connection timeout: 30 seconds
- Transaction timeout: 5 minutes

**Load Testing:**

- Concurrent transaction handling
- Terminal connection pool management
- Memory usage under load
- CPU usage during polling

---

## Deployment Plan

### Pre-Deployment Checklist

#### 1. Configuration

- [ ] Terminal configuration verified
- [ ] API keys generated and secured
- [ ] Network connectivity tested
- [ ] Firewall rules configured
- [ ] SSL certificates installed (if using HTTPS)

#### 2. Testing

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Hardware testing completed
- [ ] Error scenarios tested
- [ ] Performance benchmarks met

#### 3. Documentation

- [ ] User guide created
- [ ] Technical documentation updated
- [ ] Troubleshooting guide created
- [ ] API documentation complete

#### 4. Security

- [ ] Security review completed
- [ ] PCI DSS compliance verified
- [ ] API keys rotated
- [ ] Access controls configured
- [ ] Audit logging enabled

### Deployment Phases

#### Phase 1: Internal Testing (Week 11)

**Scope:**

- Deploy to development environment
- Internal staff testing
- Basic transaction testing
- Bug fixes and refinements

**Success Criteria:**

- All test transactions successful
- No critical bugs
- Performance meets requirements

#### Phase 2: Pilot Testing (Week 12)

**Scope:**

- Deploy to 1-2 pilot locations
- Limited transaction volume
- Real-world testing
- User feedback collection

**Success Criteria:**

- 95% transaction success rate
- Positive user feedback
- No major issues

#### Phase 3: Staged Rollout (Week 13-14)

**Scope:**

- Deploy to 25% of locations
- Monitor performance closely
- Collect metrics and feedback
- Incremental expansion

**Success Criteria:**

- 98% transaction success rate
- No critical issues
- Performance within targets

#### Phase 4: Full Deployment (Week 15+)

**Scope:**

- Deploy to all locations
- Complete migration from old system
- Ongoing monitoring
- Continuous improvement

### Rollback Plan

**Triggers for Rollback:**

- Transaction success rate < 95%
- Critical security vulnerability
- Major performance degradation
- Data integrity issues

**Rollback Procedure:**

1. **Immediate Actions:**

   - Disable Viva Wallet provider
   - Revert to previous payment method
   - Notify all locations

2. **Investigation:**

   - Analyze failure logs
   - Identify root cause
   - Develop fix

3. **Fix & Re-test:**
   - Implement fix
   - Complete testing
   - Plan re-deployment

### Monitoring & Metrics

**Key Metrics to Monitor:**

1. **Transaction Metrics**

   - Success rate
   - Average processing time
   - Failure rate by error type
   - Refund rate

2. **System Metrics**

   - Terminal connectivity
   - Network latency
   - Error rates
   - Resource usage

3. **Business Metrics**
   - Transaction volume
   - Revenue impact
   - User adoption
   - Customer satisfaction

**Monitoring Tools:**

- Application logs
- Error tracking (Sentry or similar)
- Performance monitoring
- Custom dashboard

---

## Risk Management

### Risk Identification

#### 1. Technical Risks

**Risk: Terminal Communication Failure**

- **Probability:** Medium
- **Impact:** High
- **Mitigation:**
  - Robust error handling
  - Automatic retry logic
  - Fallback to manual entry
  - Health monitoring

**Risk: Network Configuration Issues**

- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Comprehensive setup guide
  - Network diagnostic tools
  - Support documentation
  - Automated configuration validation

**Risk: API Changes by Viva Wallet**

- **Probability:** Low
- **Impact:** High
- **Mitigation:**
  - Version pinning
  - API abstraction layer
  - Regular communication with vendor
  - Monitoring for API updates

#### 2. Security Risks

**Risk: API Key Exposure**

- **Probability:** Low
- **Impact:** High
- **Mitigation:**
  - Secure key storage
  - Key rotation mechanism
  - Access controls
  - Audit logging

**Risk: Man-in-the-Middle Attacks**

- **Probability:** Low
- **Impact:** Critical
- **Mitigation:**
  - HTTPS/TLS encryption
  - Certificate pinning
  - Local network isolation
  - Network security best practices

#### 3. Business Risks

**Risk: Low Adoption Rate**

- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - User training
  - Clear benefits communication
  - Easy migration path
  - Support resources

**Risk: Performance Issues**

- **Probability:** Low
- **Impact:** Medium
- **Mitigation:**
  - Performance testing
  - Load testing
  - Monitoring
  - Optimization

### Risk Mitigation Strategies

**Prevention:**

- Comprehensive testing
- Code reviews
- Security audits
- Documentation

**Detection:**

- Monitoring and alerting
- Error tracking
- Performance monitoring
- User feedback

**Response:**

- Incident response plan
- Rollback procedures
- Support escalation
- Communication plan

---

## Timeline & Phases

### Detailed Timeline

#### **Phase 1: Foundation & Infrastructure (Week 1-2)**

**Week 1:**

- Day 1-2: Project kickoff, requirements review
- Day 3-4: Create VivaWalletService structure
- Day 5: Extend payment provider abstraction

**Week 2:**

- Day 1-2: Configuration & settings implementation
- Day 3-4: Create type definitions and interfaces
- Day 5: Code review and documentation

**Deliverables:**

- ✅ VivaWalletService skeleton
- ✅ Payment provider abstraction
- ✅ Configuration system
- ✅ Type definitions

---

#### **Phase 2: Core Transaction Processing (Week 3-4)**

**Week 3:**

- Day 1-2: Terminal discovery implementation
- Day 3-4: Transaction initiation
- Day 5: Status polling mechanism

**Week 4:**

- Day 1-2: Transaction state management
- Day 3-4: HTTP client implementation
- Day 5: Integration testing

**Deliverables:**

- ✅ Terminal discovery working
- ✅ Transaction processing
- ✅ Status polling
- ✅ Basic error handling

---

#### **Phase 3: Error Handling & Recovery (Week 5)**

**Week 5:**

- Day 1-2: Error classification and handling
- Day 3: Retry logic implementation
- Day 4: Transaction recovery mechanism
- Day 5: Testing and refinement

**Deliverables:**

- ✅ Comprehensive error handling
- ✅ Retry strategies
- ✅ Recovery mechanisms
- ✅ Error documentation

---

#### **Phase 4: UI Integration (Week 6-7)**

**Week 6:**

- Day 1-2: Payment method selector updates
- Day 3-4: Transaction status display
- Day 5: Terminal selection UI

**Week 7:**

- Day 1-2: Settings UI implementation
- Day 3-4: Error message display
- Day 5: UI testing and refinement

**Deliverables:**

- ✅ Updated payment UI
- ✅ Status display components
- ✅ Settings interface
- ✅ User experience polished

---

#### **Phase 5: Refund Support (Week 8)**

**Week 8:**

- Day 1-2: Refund transaction flow
- Day 3: Refund status polling
- Day 4: Integration with transaction manager
- Day 5: Testing

**Deliverables:**

- ✅ Refund functionality
- ✅ Refund status tracking
- ✅ Refund receipts

---

#### **Phase 6: Testing & Quality Assurance (Week 9-10)**

**Week 9:**

- Day 1-3: Unit test implementation
- Day 4-5: Integration test implementation

**Week 10:**

- Day 1-3: Hardware testing
- Day 4: Performance testing
- Day 5: Bug fixes and refinement

**Deliverables:**

- ✅ Test suite complete
- ✅ Hardware testing done
- ✅ Performance benchmarks met
- ✅ All bugs fixed

---

#### **Phase 7: Deployment (Week 11-15)**

**Week 11:** Internal Testing
**Week 12:** Pilot Testing
**Week 13-14:** Staged Rollout
**Week 15+:** Full Deployment

---

## Dependencies & Prerequisites

### Technical Dependencies

**New Packages Required:**

```json
{
  "axios": "^1.6.0", // HTTP client
  "node-local-network": "^1.0.0", // Network scanning (if needed)
  "bonjour": "^4.0.0" // mDNS discovery (optional)
}
```

**Existing Packages (Already in Project):**

- `electron` - Main framework
- `winston` - Logging
- `typescript` - Type safety

### Prerequisites

**Development Environment:**

- Node.js >= 22.12.0
- Electron >= 38.1.2
- Access to Viva Wallet terminal device
- Local network for testing

**Production Environment:**

- Terminals configured with peer-to-peer enabled
- Network connectivity between POS and terminals
- API keys generated and secured
- Firewall rules configured

### Vendor Requirements

**Viva Wallet:**

- Terminal devices configured
- API documentation access
- Support contact for questions
- Test credentials (if available)

---

## Success Criteria

### Technical Success Criteria

- [ ] 99%+ transaction success rate
- [ ] Average transaction time < 5 seconds
- [ ] Zero data loss in transactions
- [ ] Automatic recovery from 95% of error scenarios
- [ ] Support for all terminal types mentioned
- [ ] Full refund support implemented

### Business Success Criteria

- [ ] Positive user feedback (> 4/5 rating)
- [ ] Reduced payment processing time
- [ ] Increased customer satisfaction
- [ ] Lower payment processing errors
- [ ] Successful adoption across all locations

### Quality Success Criteria

- [ ] 80%+ test coverage
- [ ] Zero critical bugs in production
- [ ] Comprehensive documentation
- [ ] Security audit passed
- [ ] PCI DSS compliance maintained

---

## Maintenance & Support

### Ongoing Maintenance

**Regular Tasks:**

- Monitor transaction success rates
- Review error logs weekly
- Update dependencies monthly
- Security patches as needed
- Performance optimization

**Version Updates:**

- Monitor Viva Wallet API changes
- Update integration as needed
- Test thoroughly before deployment
- Communicate changes to users

### Support Plan

**Level 1: User Support**

- Payment processing issues
- Terminal connection problems
- Configuration questions
- Error message clarification

**Level 2: Technical Support**

- Debug transaction failures
- Network troubleshooting
- Configuration issues
- Integration problems

**Level 3: Development Support**

- Bug fixes
- Feature enhancements
- API updates
- Security patches

### Documentation Updates

**Keep Updated:**

- User guides
- Technical documentation
- Troubleshooting guides
- API documentation
- Configuration guides

---

## Conclusion

This integration plan provides a comprehensive roadmap for integrating Viva Wallet's Local Terminal API into the AuraSwift POS system. The phased approach ensures systematic development, thorough testing, and successful deployment.

**Key Success Factors:**

1. Strong foundation with proper architecture
2. Device-as-terminal support with unified interface (dedicated terminals and device-based terminals work seamlessly)
3. Robust error handling and recovery
4. Comprehensive testing strategy
5. Security and compliance focus
6. User-friendly interface
7. Thorough documentation
8. Future-ready design (easily extensible for card reader attachments and new device types)

**Next Steps:**

1. Review and approve this plan
2. Assign development resources
3. Set up development environment
4. Acquire test devices (Android/iOS devices for device-as-terminal testing)
5. Begin Phase 1 implementation

---

## Appendices

### Appendix A: Viva Wallet API Reference

**Official Documentation:**

- https://developer.viva.com/
- Local Terminal API: https://developer.viva.com/apis-for-point-of-sale/card-terminals-devices/peer-to-peer-communication/
- Device-as-Terminal: https://developer.viva.com/tutorials/pos-terminals/tap-on-phone/integrations/

### Appendix E: Device-as-Terminal Setup Guide

**Setting Up Device as Terminal:**

1. **Install Viva.com Terminal App**

   - Download from Google Play Store (Android) or App Store (iOS)
   - Complete merchant registration
   - Configure account settings

2. **Enable Peer-to-Peer Mode**

   - Open Viva.com Terminal app
   - Navigate to: **More > Integrations > Viva Peer to Peer**
   - Toggle **Enable Peer to Peer** to ON
   - Note the IP address and port displayed

3. **Configure in POS System**

   - Open AuraSwift Settings
   - Navigate to Payment Settings > Viva Wallet
   - Click "Discover Terminals" or manually enter:
     - Terminal name (e.g., "Counter Tablet", "Mobile Terminal")
     - IP address (from terminal app)
     - Port (from terminal app)
     - API key (if required)

4. **Test Connection**

   - Use "Test Connection" button in settings
   - Verify terminal appears as available
   - Check terminal capabilities are detected correctly

5. **Optional: Add External Card Reader**
   - Connect card reader to device (USB/Bluetooth)
   - Terminal app will automatically detect
   - Enhanced capabilities will be available

**Best Practices:**

- Use descriptive names for device terminals (e.g., "Counter 1 Tablet")
- Keep device charged and on stable network
- Ensure Viva.com Terminal app stays running
- Set up auto-connect for frequently used terminals

### Appendix B: Code Examples

**Terminal Discovery Example:**

```typescript
// See implementation in packages/main/src/services/vivaWallet/terminal-discovery.ts
```

**Transaction Initiation Example:**

```typescript
// See implementation in packages/main/src/services/vivaWallet/transaction-manager.ts
```

### Appendix C: Troubleshooting Guide

**Common Issues:**

1. **Terminal Not Discovered**

   - Check network connectivity
   - Verify terminal peer-to-peer enabled
   - Check firewall settings
   - Verify IP address range

2. **Connection Failed**

   - Verify terminal IP and port
   - Check API key
   - Test network connectivity
   - Review terminal logs

3. **Transaction Timeout**
   - Check terminal status
   - Verify network latency
   - Increase timeout if needed
   - Check terminal firmware version

### Appendix D: Glossary

- **ECR:** Electronic Cash Register
- **EFT:** Electronic Funds Transfer
- **POS:** Point of Sale
- **PCI DSS:** Payment Card Industry Data Security Standard
- **mDNS:** Multicast DNS
- **TLS:** Transport Layer Security
- **Device-as-Terminal:** Capability to use a smartphone/tablet with Viva.com Terminal app as a payment terminal
- **NFC:** Near Field Communication (for contactless payments)

### Appendix F: Device-as-Terminal Quick Reference

**Implementation Checklist:**

✅ **Core Requirements (Phase 2)**

- [ ] Unified terminal interface (no differentiation in code)
- [ ] Terminal type detection (informational only)
- [ ] Capability detection (NFC, card reader, etc.)
- [ ] Same API endpoints for all terminal types
- [ ] Terminal discovery supports device-based terminals

✅ **UI Requirements (Phase 4)**

- [ ] Show terminal type in discovery results
- [ ] Display payment capability badges
- [ ] Terminal selection UI supports all types
- [ ] Status indicators work for device terminals

✅ **Configuration (Phase 1)**

- [ ] Support manual terminal entry
- [ ] Network scanning finds device terminals
- [ ] Terminal configuration storage
- [ ] Secure API key storage

✅ **Testing (Phase 6)**

- [ ] Test with Android device as terminal
- [ ] Test with iOS device as terminal (if available)
- [ ] Test NFC-only functionality
- [ ] Test with external card reader (future)

**Best Practices Summary:**

1. **Unified Interface:** Same code paths for all terminal types
2. **Capability-Based:** Check capabilities, don't assume features
3. **Future-Ready:** Easy to extend for card reader attachments
4. **User-Friendly:** Clear terminal type and capability indicators
5. **Flexible:** Support manual and automatic terminal discovery

**Key Architecture Principles:**

```typescript
// ✅ Principle 1: Terminal type agnostic
function processPayment(terminal: Terminal) {
  // Works for ALL terminal types
}

// ✅ Principle 2: Capability-based features
if (terminal.paymentCapabilities.supportsNFC) {
  // Enable NFC features
}

// ✅ Principle 3: Extensible design
interface Terminal {
  terminalType: "dedicated" | "device-based";
  // Easy to add: 'device-with-reader' | 'future-type'
}
```

---

**Document Version:** 1.1  
**Last Updated:** [Current Date]  
**Author:** Senior Viva Developer + Electron.js Developer  
**Status:** Draft for Review  
**Key Addition:** Comprehensive Device-as-Terminal Implementation Guide
