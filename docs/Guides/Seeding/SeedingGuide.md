# Category & Product Seeding Module

This module provides tools for seeding **categories and products** with realistic sample data for development and testing.

## What This Module Does

- ✅ Seeds categories (with parent/child relationships)
- ✅ Seeds products (with various configurations: standard, scale, generic buttons)
- ❌ Does NOT seed basic system data (businesses, users, VAT categories, etc.)

**Note:** Basic system data is automatically seeded when you run `npm run start` for the first time.

## ⚠️ IMPORTANT: How to Seed Data

Due to Electron's native module compilation, **seeding MUST be done from within the running Electron app**, not via standalone CLI.

### Method 1: DevTools Console (Recommended)

1. Start your app:

```bash
npm run start
```

2. Open DevTools Console: **View → Toggle Developer Tools → Console tab**

3. Run seeding commands:

```javascript
// Seed with presets
await seedAPI.runPreset("minimal"); // 50 categories + 500 products
await seedAPI.runPreset("small"); // 200 categories + 2,000 products
await seedAPI.runPreset("medium"); // 1,000 categories + 10,000 products
await seedAPI.runPreset("large"); // 5,000 categories + 30,000 products
await seedAPI.runPreset("xlarge"); // 10,000 categories + 60,000 products

// Or custom configuration
await seedAPI.runCustom({
  categories: 100,
  products: 500,
  batchSize: 200,
  clearExisting: true,
});
```

4. Navigate to **Product & Menu Management** to see your seeded data

### CLI Scripts Removed

Previously, this module included npm scripts like `npm run seed:small`, but these have been **removed** due to Electron's native module compilation conflicts.

**Use the DevTools console method exclusively.**

## Available Presets

| Preset    | Categories | Products | Best For               |
| --------- | ---------- | -------- | ---------------------- |
| `minimal` | 50         | 500      | Minimal testing        |
| `small`   | 200        | 2,000    | Quick testing          |
| `medium`  | 1,000      | 10,000   | Realistic scenarios    |
| `large`   | 5,000      | 30,000   | Performance testing    |
| `xlarge`  | 10,000     | 60,000   | Extreme stress testing |

## Common Workflows

### Initial Development Setup

```bash
# 1. Clean database (if needed)
npm run db:dev:clean

# 2. Start app (basic data seeded automatically)
npm run start

# 3. Open DevTools Console and seed
await seedAPI.runPreset('small');

# 4. Refresh Product Management view
```

### Adding More Data

```javascript
// In DevTools Console:
// Data will be added to existing categories/products
await seedAPI.runPreset("medium");
```

### Reseeding (Clear and Regenerate)

```javascript
// In DevTools Console:
await seedAPI.runCustom({
  categories: 200,
  products: 2000,
  clearExisting: true, // This clears existing data first
});
```

## Generated Data Details

### Categories

- **Types:** Food, Beverages, Household, Electronics, etc.
- **Structure:** 30% parent categories, 70% subcategories
- **Features:**
  - Unique names with UUID suffixes (prevents collisions)
  - Realistic descriptions
  - VAT category assignments
  - Age restrictions (for alcohol, tobacco, etc.)
  - Color coding for UI organization

### Products

- **Types:**
  - Standard products (by piece)
  - Scale products (by weight)
  - Generic button products (variable pricing)
- **Features:**
  - Unique SKUs and barcodes
  - Realistic pricing ($0.50 - $99.99)
  - Category assignments
  - VAT category assignments
  - Age restrictions (inherited from category or custom)
  - Inventory tracking settings

## Configuration

### Seed Config Interface

```typescript
interface SeedConfig {
  categories: number; // Number of categories to generate
  products: number; // Number of products to generate
  batchSize: number; // Batch size for inserts (default: 200)
  clearExisting: boolean; // Clear existing data first (default: false)
}
```

### Custom Seeding Examples

```javascript
// In DevTools Console:

// Small test dataset
await seedAPI.runCustom({
  categories: 50,
  products: 200,
});

// Specific use case
await seedAPI.runCustom({
  categories: 300,
  products: 3000,
  batchSize: 500, // Larger batches for speed
  clearExisting: true, // Clear existing data first
});
```

## Architecture

```
seed-data/
├── index.ts              # CategoryProductSeeder class
├── cli.ts                # CLI interface (deprecated - use in-app seeding)
├── config.ts             # Preset configurations
├── README.md             # This file
├── MIGRATION.md          # Migration guide from old structure
└── generators/
    ├── category-generator.ts  # Category data generation
    └── product-generator.ts   # Product data generation
```

## Features

### Performance Optimizations

- Batch inserts (default: 200 records per batch)
- Transaction-based for data integrity
- Progress tracking with percentage updates
- Performance mode during bulk operations

### Data Quality

- **Unique constraints:** UUID-based naming prevents conflicts
- **Validation:** Input validation for all parameters
- **Relationships:** Proper foreign key relationships
- **Realistic data:** Using Faker.js for natural-looking data

### Auto-clearing

If existing categories or products are detected during seeding, they will be automatically cleared to prevent UNIQUE constraint failures (development mode only).

## Troubleshooting

### "No VAT categories found"

**Cause:** Basic system data hasn't been seeded yet.

**Solution:** Start the app first, which automatically seeds basic data:

```bash
npm run start
```

Then use the DevTools console to seed categories/products.

### "UNIQUE constraint failed"

**Cause:** Duplicate category names or product SKUs/barcodes.

**Solution:** The module automatically clears existing data when conflicts are detected. If issues persist, manually clear:

```bash
npm run db:dev:clean
npm run start
# Then seed via DevTools console
```

### "The module was compiled against a different Node.js version"

**Cause:** Trying to use the CLI scripts which are incompatible with Electron.

**Solution:** Use the DevTools console method instead of npm scripts.

### "0 categories/products showing in UI"

**Cause:** UI hasn't refreshed after seeding.

**Solution:** Navigate away and back to Product Management, or restart the app.

## TypeScript Types

```typescript
// Available preset names
type SeedPreset = "small" | "medium" | "large";

// Seed configuration
interface SeedConfig {
  categories: number;
  products: number;
  batchSize: number;
  clearExisting: boolean;
}

// API response
interface SeedResponse {
  success: boolean;
  message: string;
  error?: string;
}
```

## Best Practices

1. **Start with small datasets** during development
2. **Use large datasets** only for performance testing
3. **Clear database** before seeding if you want clean data
4. **Use in-app seeding** via DevTools console, not CLI scripts
5. **Check the console** for detailed seeding logs and progress

## Examples

### Quick Development Setup

```bash
# Terminal
npm run start

# DevTools Console (after app starts)
await seedAPI.runPreset('small');
```

### Performance Testing

```javascript
// DevTools Console
await seedAPI.runPreset("large");
// Test UI with 1,000 categories and 10,000 products
```

### Custom Test Scenario

```javascript
// DevTools Console
await seedAPI.runCustom({
  categories: 150,
  products: 1200,
  clearExisting: true,
});
```

## Module Files

- **`index.ts`**: `CategoryProductSeeder` class - main seeding logic
- **`cli.ts`**: CLI interface (deprecated)
- **`config.ts`**: Preset configurations
- **`generators/category-generator.ts`**: Category data generation
- **`generators/product-generator.ts`**: Product data generation

## Migration Note

If you're migrating from an older version of this module, see [MIGRATION.md](./MIGRATION.md) for breaking changes and upgrade instructions.
