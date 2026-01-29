Here's a comprehensive React UI/UX design guide for implementing batch-based expiry tracking in a POS system:

## 1. Core Dashboard Components

### Expiry Overview Dashboard

```jsx
// Components/Dashboard/ExpiryOverview.jsx
const ExpiryOverview = () => {
  return (
    <div className="expiry-dashboard">
      <div className="stats-grid">
        <StatCard title="Expiring This Week" value="24" trend="+5" color="warning" icon="⚠️" />
        <StatCard title="Near Expiry Batches" value="15" trend="-2" color="info" icon="📦" />
        <StatCard title="Recently Expired" value="3" trend="+1" color="error" icon="❌" />
        <StatCard title="Total Tracked Batches" value="142" trend="+12" color="success" icon="✅" />
      </div>

      <QuickActions>
        <Button variant="primary" icon="➕">
          Receive New Batch
        </Button>
        <Button variant="secondary" icon="📋">
          Generate Expiry Report
        </Button>
        <Button variant="warning" icon="🎯">
          Create Promotion
        </Button>
      </QuickActions>
    </div>
  );
};
```

## 2. Batch Management Interfaces

### Batch Receiving Form

```jsx
// Components/Batch/BatchReceivingForm.jsx
const BatchReceivingForm = () => {
  return (
    <div className="batch-receiving-form">
      <FormLayout>
        <Section title="Product Information">
          <ProductSearch onSelectProduct={(product) => setSelectedProduct(product)} placeholder="Search products..." />

          <div className="form-row">
            <FormInput label="Batch/Lot Number" name="batchNumber" type="text" placeholder="Auto-generate or enter manually" />
            <FormInput label="Expiry Date" name="expiryDate" type="date" required />
          </div>
        </Section>

        <Section title="Stock Details">
          <FormInput label="Quantity Received" name="quantity" type="number" min="1" required />

          <FormInput label="Supplier" name="supplier" type="text" />

          <FormInput label="Purchase Price" name="costPrice" type="number" step="0.01" />
        </Section>

        <Section title="Batch Organization">
          <LocationSelector label="Storage Location" options={["Cool Room A", "Dry Store B", "Front Shelf"]} />

          <div className="batch-preview">
            <h4>Batch Preview</h4>
            <BatchPreviewCard product="Heinz Ketchup 500ml" batchNumber="HK-2024-OCT-001" expiryDate="2024-10-25" quantity={50} />
          </div>
        </Section>
      </FormLayout>
    </div>
  );
};
```

## 3. Batch Listing & Visualization

### Batch Inventory Table

```jsx
// Components/Batch/BatchInventoryTable.jsx
const BatchInventoryTable = ({ batches }) => {
  const getExpiryStatus = (expiryDate) => {
    const daysUntilExpiry = calculateDaysUntil(expiryDate);
    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry <= 7) return "critical";
    if (daysUntilExpiry <= 30) return "warning";
    return "good";
  };

  return (
    <Table className="batch-inventory-table">
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Batch ID</TableHead>
          <TableHead>Current Stock</TableHead>
          <TableHead>Expiry Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((batch) => (
          <TableRow key={batch.id} className={`expiry-status-${getExpiryStatus(batch.expiryDate)}`}>
            <TableCell>
              <ProductCell name={batch.product.name} sku={batch.product.sku} image={batch.product.image} />
            </TableCell>
            <TableCell>
              <Badge variant="outline">{batch.batchNumber}</Badge>
            </TableCell>
            <TableCell>
              <StockIndicator current={batch.currentStock} initial={batch.initialStock} />
            </TableCell>
            <TableCell>
              <ExpiryDateCell date={batch.expiryDate} showRelative={true} />
            </TableCell>
            <TableCell>
              <ExpiryStatusBadge status={getExpiryStatus(batch.expiryDate)} daysUntil={calculateDaysUntil(batch.expiryDate)} />
            </TableCell>
            <TableCell>
              <ActionDropdown
                actions={[
                  { label: "View Details", icon: "👁", onClick: () => {} },
                  { label: "Adjust Stock", icon: "📊", onClick: () => {} },
                  { label: "Create Promotion", icon: "🎯", onClick: () => {} },
                  { label: "Mark as Waste", icon: "🗑️", onClick: () => {} },
                ]}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
```

## 4. Expiry Alert System

### Notification Center

```jsx
// Components/Notifications/ExpiryAlertCenter.jsx
const ExpiryAlertCenter = () => {
  return (
    <div className="alert-center">
      <AlertSection title="Critical Alerts (This Week)" type="error">
        {criticalBatches.map((batch) => (
          <ExpiryAlertCard key={batch.id} batch={batch} severity="critical" suggestedActions={["Create promotion", "Move to front"]} />
        ))}
      </AlertSection>

      <AlertSection title="Upcoming Expiry (Next 30 Days)" type="warning">
        {warningBatches.map((batch) => (
          <ExpiryAlertCard key={batch.id} batch={batch} severity="warning" suggestedActions={["Monitor closely", "Plan promotion"]} />
        ))}
      </AlertSection>

      <AlertSection title="Recently Expired" type="info">
        {expiredBatches.map((batch) => (
          <ExpiryAlertCard key={batch.id} batch={batch} severity="expired" suggestedActions={["Mark as waste", "Write off"]} />
        ))}
      </AlertSection>
    </div>
  );
};
```

## 5. Point of Sale Integration

### Batch-Aware Checkout

```jsx
// Components/POS/BatchAwareCheckout.jsx
const BatchAwareCheckout = ({ cartItems }) => {
  return (
    <div className="batch-checkout">
      <CartItems>
        {cartItems.map((item) => (
          <CartItem key={item.id} item={item}>
            {item.requiresBatchSelection && <BatchSelectionModal product={item.product} availableBatches={item.availableBatches} onSelectBatch={(batch) => handleBatchSelection(item, batch)} />}
          </CartItem>
        ))}
      </CartItems>

      {/* Show batch warnings in checkout */}
      <BatchWarnings items={cartItems} onExpiryWarning={(warning) => showWarningToast(warning)} />
    </div>
  );
};
```

## 6. Reporting & Analytics

### Expiry Analytics Dashboard

```jsx
// Components/Analytics/ExpiryAnalytics.jsx
const ExpiryAnalytics = () => {
  return (
    <div className="expiry-analytics">
      <div className="charts-grid">
        <ExpiryTimelineChart data={expiryTimelineData} title="Expiry Timeline (Next 90 Days)" />

        <ProductCategoryChart data={categoryExpiryData} title="Expiry by Product Category" />

        <WasteAnalysisChart data={wasteData} title="Waste Reduction Progress" />
      </div>

      <ReportGenerator templates={["Weekly Expiry Report", "Monthly Waste Analysis", "Batch Performance Report"]} onGenerate={(template) => generateReport(template)} />
    </div>
  );
};
```

## 7. Mobile & Touch Interfaces

### Mobile Batch Scanner

```jsx
// Components/Mobile/BatchScanner.jsx
const BatchScanner = () => {
  return (
    <div className="mobile-scanner">
      <ScannerView onBarcodeScan={(barcode) => handleBarcodeScan(barcode)} modes={["batch", "product", "location"]} />

      <QuickActionsGrid>
        <QuickAction icon="📷" label="Scan Batch" />
        <QuickAction icon="📝" label="Manual Entry" />
        <QuickAction icon="📋" label="Stock Check" />
        <QuickAction icon="⚠️" label="Report Issue" />
      </QuickActionsGrid>

      <RecentScansList scans={recentScans} />
    </div>
  );
};
```

## 8. Key UX Patterns to Implement

### Visual Status Indicators

- **Color-coded expiry status** (Red: expired, Orange: critical, Yellow: warning, Green: good)
- **Progress bars** for stock levels and time until expiry
- **Icons and badges** for quick status recognition

### Smart Defaults & Automation

- Auto-generate batch numbers
- Auto-select earliest expiring batches in POS
- Smart suggestions for promotions

### Bulk Operations

- Batch editing of multiple batches
- Bulk waste recording
- Mass promotion creation

### Responsive Design

- Desktop: Full-featured tables and charts
- Tablet: Card-based layouts with swipe actions
- Mobile: Simplified interfaces for quick operations

## 9. Recommended React Libraries

```bash
# UI Components
shadcn ui
npm install lucide-react # Icons

# Charts & Visualization
npm install recharts @visx/visx

# Date Handling
npm install date-fns

# Forms
npm install react-hook-form @hookform/resolvers



# Notifications
npm install react-hot-toast
```

This UI/UX design provides a comprehensive system for managing batch-based expiry tracking while maintaining excellent user experience across all devices and user roles.
