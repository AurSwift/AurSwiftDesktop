# Save Basket Feature - Implementation Flow

## Overview

The "Save Basket" feature allows cashiers to save the current cart state for later retrieval, similar to standard EPOS systems. This is useful when:

- Customer needs to step away temporarily
- Multiple customers need to be served
- Cart needs to be preserved during shift changes
- Items need to be held while checking stock/availability

## User Flow

### 1. Save Basket Flow

```
User clicks "Save basket" button
    ↓
Check if cart has items
    ↓ (No items)
Show error: "Cart is empty. Add items before saving."
    ↓ (Has items)
Show "Save Basket" modal
    ↓
User enters basket name (optional, auto-generated if empty)
    ↓
User clicks "Save" or presses Enter
    ↓
Validate basket name (if provided)
    ↓
Save cart session with status "SAVED"
    ↓
Create saved basket record with:
    - Basket name
    - Cart session ID reference
    - Saved by (user ID)
    - Saved at (timestamp)
    - Business ID
    - Shift ID (if applicable)
    ↓
Show success message: "Basket 'Basket Name' saved successfully"
    ↓
Optionally clear current cart (user preference)
    ↓
Close modal
```

### 2. Retrieve Saved Basket Flow (Future Implementation)

```
User clicks "Retrieve Basket" or "Saved Baskets" (separate feature)
    ↓
Show list of saved baskets
    ↓
User selects a basket
    ↓
Load cart session and items
    ↓
Restore cart state
    ↓
User can continue adding items or proceed to checkout
```

## Database Schema Requirements

### Saved Baskets Table

```sql
CREATE TABLE saved_baskets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cart_session_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  saved_by TEXT NOT NULL, -- user ID
  shift_id TEXT, -- nullable
  saved_at TIMESTAMP NOT NULL,
  retrieved_at TIMESTAMP, -- when basket was last retrieved
  retrieved_count INTEGER DEFAULT 0, -- how many times retrieved
  notes TEXT, -- optional notes
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (cart_session_id) REFERENCES cart_sessions(id),
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  FOREIGN KEY (saved_by) REFERENCES users(id)
);

CREATE INDEX idx_saved_baskets_business ON saved_baskets(business_id);
CREATE INDEX idx_saved_baskets_saved_by ON saved_baskets(saved_by);
CREATE INDEX idx_saved_baskets_saved_at ON saved_baskets(saved_at DESC);
```

### Cart Session Status Update

- Add "SAVED" status to CartSessionStatus enum
- When saving, update cart session status to "SAVED"
- When retrieving, update status back to "ACTIVE"

## Implementation Steps

### Step 1: Database Schema

1. Add "SAVED" to CartSessionStatus enum
2. Create saved_baskets table in schema
3. Add database migration

### Step 2: Backend API

1. Create `saveBasket` IPC handler
2. Create `getSavedBaskets` IPC handler (for future)
3. Create `retrieveBasket` IPC handler (for future)
4. Update cart manager to support SAVED status

### Step 3: Frontend Components

1. Create `SaveBasketModal` component
2. Add state management for saved baskets
3. Update cart hook to support saving baskets
4. Wire up "Save basket" button handler

### Step 4: User Experience

1. Show modal with basket name input
2. Auto-generate name if empty (e.g., "Basket 1", "Basket 2")
3. Show success toast notification
4. Option to clear current cart after saving (optional feature)

## EPOS Standard Behavior

Based on industry-standard EPOS systems:

1. **Naming Convention**

   - Auto-generate names: "Basket 1", "Basket 2", etc.
   - Allow custom names
   - Show timestamp in list view

2. **Cart State Preservation**

   - Save all items with quantities/weights
   - Save all prices (including custom prices)
   - Save batch information (if applicable)
   - Save age verification status

3. **Session Management**

   - Mark cart session as "SAVED" (not "ACTIVE")
   - Keep cart session in database
   - Allow multiple saved baskets per user/business

4. **Retrieval**

   - Load saved basket into new active cart session
   - Preserve all item details
   - Allow continuation of shopping

5. **Cleanup**
   - Option to delete saved baskets
   - Auto-cleanup old saved baskets (configurable retention period)

## Error Handling

1. **Empty Cart**: Show error if trying to save empty cart
2. **Database Error**: Show error message, keep cart intact
3. **Name Validation**: Ensure name is not empty (or use auto-generated)
4. **Duplicate Names**: Allow duplicates (or append number)

## Success Criteria

- ✅ User can save current cart with a name
- ✅ Cart state is preserved exactly (items, quantities, prices)
- ✅ Saved baskets are stored in database
- ✅ User receives clear feedback on success/failure
- ✅ Cart can be cleared after saving (optional)
- ✅ Saved baskets can be retrieved later (future feature)
