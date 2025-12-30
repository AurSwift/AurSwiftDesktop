# Save Basket with QR Code - Complete Implementation Plan

## Overview

The "Save Basket" feature allows cashiers to save cart sessions with QR code generation. When the QR code is scanned by a barcode scanner, it retrieves and populates the cart with all saved items. This enables:

- Quick basket retrieval without manual selection
- Cross-terminal basket sharing
- Customer hold functionality
- Basket resume after interruptions

## Database Schema Design

### 1. Saved Baskets Table

```sql
CREATE TABLE saved_baskets (
  id TEXT PRIMARY KEY,                    -- UUID
  basket_code TEXT NOT NULL UNIQUE,       -- Short code for QR (e.g., "BSK-ABC123")
  cart_session_id TEXT NOT NULL,          -- Reference to cart_sessions
  business_id TEXT NOT NULL,
  saved_by TEXT NOT NULL,                  -- User ID
  shift_id TEXT,                           -- Nullable - can save outside shift
  customer_email TEXT,                     -- Optional - customer email for QR code delivery
  saved_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,                    -- Optional expiration
  retrieved_at TIMESTAMP,                  -- When last retrieved
  retrieved_count INTEGER DEFAULT 0,       -- How many times retrieved
  status TEXT NOT NULL DEFAULT 'active',   -- 'active', 'retrieved', 'expired', 'deleted'
  notes TEXT,                              -- Optional notes
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (cart_session_id) REFERENCES cart_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (saved_by) REFERENCES users(id),
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
);

CREATE INDEX idx_saved_baskets_business ON saved_baskets(business_id);
CREATE INDEX idx_saved_baskets_code ON saved_baskets(basket_code);
CREATE INDEX idx_saved_baskets_status ON saved_baskets(status);
CREATE INDEX idx_saved_baskets_saved_by ON saved_baskets(saved_by);
CREATE INDEX idx_saved_baskets_expires ON saved_baskets(expires_at);
```

### 2. Cart Sessions Table Update

- Status already includes "SAVED" (already done)
- No additional changes needed

### 3. Cart Items Table

- No changes needed - items are already linked to cart_session_id

## QR Code Format Design

### Option 1: Short Code (Recommended)

**Format**: `BSK-{SHORT_CODE}`
**Example**: `BSK-ABC123`

**QR Code Content**: `BSK-ABC123`

**Pros**:

- Short, scannable quickly
- Human-readable
- Easy to print/display
- Database lookup is fast

**Cons**:

- Requires database lookup
- Code must be unique

**Implementation**:

- Generate 6-character alphanumeric code (36^6 = 2.1 billion combinations)
- Store mapping: `basket_code` → `saved_basket.id`
- QR code contains: `BSK-{code}`

### Option 2: Encoded Data (Alternative)

**Format**: JSON encoded in QR
**Example**: `{"type":"basket","id":"uuid","code":"ABC123"}`

**Pros**:

- Self-contained
- Can include metadata

**Cons**:

- Longer QR code
- Harder to scan
- More complex parsing

**Decision**: Use Option 1 (Short Code)

## Business Logic Flow

### Flow 1: Save Basket

```
User clicks "Save basket" button
    ↓
Check if cart has items
    ↓ (No items)
Show error: "Cart is empty. Add items before saving."
    ↓ (Has items)
Show "Save Basket" modal
    ↓
User enters basket name (optional)
    ↓
User clicks "Save" or presses Enter
    ↓
Generate unique basket code (e.g., "ABC123")
    ↓
Update cart session status to "SAVED"
    ↓
Create saved_baskets record:
    - id: UUID
    - basket_code: "BSK-ABC123"
    - cart_session_id: current session ID
    - business_id: current business
    - saved_by: current user ID
    - shift_id: current shift ID (if exists)
    - saved_at: now
    - expires_at: now + 7 days (configurable)
    - status: "active"
    ↓
Generate QR code image with "BSK-ABC123"
    ↓
Display QR code in modal with:
    - Basket name
    - Basket code (text)
    - QR code image
    - Expiration date
    - Two action options:
      1. "Send QR Code via Email"
      2. "Print Receipt" (shows all items + QR code)
    ↓
User selects action:
    ↓
[Option 1: Email QR Code]
    Show email input dialog
    User enters customer email (optional - can skip)
    ↓
    Generate email with:
      - Subject: "Your Saved Basket - [Basket Name]"
      - QR code image (embedded)
      - Basket code text
      - List of items
      - Expiration date
      - Instructions on how to use
    ↓
    Send email via email service
    ↓
    Show success: "QR code sent to [email]"
    ↓
[Option 2: Print Receipt]
    Generate receipt document with:
      - Business header/logo
      - "Saved Basket" title
      - Basket name
      - Basket code (text)
      - QR code image (large, scannable)
      - List of all items:
        * Item name
        * Quantity/Weight
        * Unit price
        * Total price
      - Subtotal
      - Tax
      - Total
      - Expiration date
      - Instructions: "Scan QR code to retrieve this basket"
      - Footer with business info
    ↓
    Open print dialog
    User prints receipt
    ↓
    Show success: "Receipt printed successfully"
    ↓
Show success message: "Basket saved successfully"
    ↓
Optionally clear current cart (user preference)
    ↓
Close modal
```

### Flow 2: Retrieve Basket via QR Code Scan

```
Barcode scanner scans QR code
    ↓
Parse scanned code: "BSK-ABC123"
    ↓
Validate format (starts with "BSK-")
    ↓
Extract code: "ABC123"
    ↓
Lookup saved_baskets by basket_code
    ↓ (Not found)
Show error: "Basket not found or invalid code"
    ↓ (Found)
Check basket status
    ↓ (Status != "active")
Show error: "Basket is no longer available (expired/retrieved/deleted)"
    ↓ (Status == "active")
Check expiration
    ↓ (Expired)
Update status to "expired"
Show error: "Basket has expired"
    ↓ (Not expired)
Check if current user has active cart
    ↓ (Has active cart)
Show confirmation: "You have items in your cart. Replace with saved basket?"
    - Option 1: Replace current cart
    - Option 2: Cancel
    ↓ (User chooses Replace)
Clear current cart items
    ↓ (No active cart OR user chose Replace)
Create new cart session (or use existing)
    ↓
Load all cart items from saved basket's cart_session_id
    ↓
For each item:
    - Check if product still exists
    - Check if product is still available
    - Check batch availability (if applicable)
    - Recalculate prices (prices may have changed)
    ↓
Add items to new cart session:
    - Copy all item data
    - Update prices if changed
    - Mark items that need attention (price changed, unavailable)
    ↓
Update saved_baskets:
    - retrieved_at: now
    - retrieved_count: increment
    - status: "retrieved" (optional - or keep "active" for multiple retrievals)
    ↓
Show success message: "Basket 'Basket Name' loaded successfully"
    ↓
If items had issues:
    Show warning: "Some items had price changes or are no longer available"
    Show list of affected items
    ↓
Cart is now populated and ready for checkout
```

### Flow 3: Manual Basket Retrieval (Future)

```
User clicks "Retrieve Basket" or "Saved Baskets"
    ↓
Show list of saved baskets (filtered by business/user)
    ↓
User selects a basket
    ↓
Follow same logic as QR code retrieval (from "Load all cart items" step)
```

## QR Code Generation

### Library Choice

- **qrcode** (npm package) - Simple, reliable
- **qrcode.react** - React component wrapper

### QR Code Data Format

```
BSK-{6_CHAR_CODE}
```

### QR Code Display

- Size: 256x256px minimum (for easy scanning)
- Error correction: Medium (Level M)
- Include text below QR code: "Basket Code: BSK-ABC123"
- Include expiration date
- Include basket name (if provided)

## Implementation Components

### 1. Database Schema

- ✅ `savedBaskets` table (already added)
- Add `basket_code` field with unique constraint
- Add `expires_at` field
- Add `status` field

### 2. Backend API Handlers

#### `saveBasket(cartSessionId, basketName, shiftId?, customerEmail?)`

- Generate unique basket code
- Update cart session status to "SAVED"
- Create saved_baskets record (with optional customer_email)
- Return basket code, saved basket ID, and cart items summary

#### `sendBasketEmail(basketId, customerEmail)`

- Lookup saved basket
- Generate email content with QR code
- Send email via email service (Resend/SMTP)
- Return success/error status

#### `generateBasketReceipt(basketId)`

- Lookup saved basket and cart items
- Generate receipt HTML/PDF with:
  - All cart items
  - QR code image
  - Basket details
- Return receipt data (HTML string or PDF blob)

#### `getBasketByCode(basketCode)`

- Lookup saved_baskets by basket_code
- Return saved basket with cart session and items
- Check expiration and status

#### `retrieveBasket(basketId, newCartSessionId)`

- Load items from saved cart session
- Validate items (product exists, available, etc.)
- Copy items to new cart session
- Update saved_baskets (retrieved_at, retrieved_count)
- Return items with any warnings

#### `getSavedBaskets(businessId, userId?, status?)`

- List saved baskets (for manual retrieval UI)
- Filter by business, user, status
- Sort by saved_at DESC

### 3. Frontend Components

#### `SaveBasketModal`

- **Step 1: Save Basket**
  - Input: Basket name (optional)
  - Button: "Save Basket"
- **Step 2: QR Code Display & Actions** (after saving)
  - Display:
    - Basket name
    - Basket code (text): "BSK-ABC123"
    - QR code image (large, scannable)
    - Expiration date
    - Item count and total
  - Two action buttons:
    1. **"Send QR Code via Email"**
       - Opens email input dialog
       - Customer email (optional)
       - Send button
       - Shows success/error message
    2. **"Print Receipt"**
       - Generates receipt with items + QR code
       - Opens print dialog
       - User can print or save as PDF
  - Close button

#### `BasketRetrievalHandler` (in barcode scanner hook)

- Detect "BSK-" prefix
- Call retrieval API
- Handle errors and warnings
- Populate cart

### 4. QR Code Generation Service

- Generate QR code image from basket code
- Return as data URL or blob
- Support printing
- Support email attachment

### 5. Email Service Integration

- **Email Template for Saved Basket**:
  - Subject: "Your Saved Basket - [Basket Name]"
  - HTML email with:
    - Business branding/logo
    - Greeting message
    - Basket details (name, code, expiration)
    - QR code image (embedded)
    - List of items (table format)
    - Total amount
    - Instructions: "Bring this QR code to the store and scan it to retrieve your basket"
    - Footer with business contact info
  - Plain text fallback
  - Attachments: QR code image file (optional)

### 6. Receipt Generation Service

- **Receipt Template for Saved Basket**:
  - Business header (logo, name, address)
  - "SAVED BASKET" title
  - Basket information:
    - Basket name
    - Basket code: "BSK-ABC123"
    - Saved date
    - Expiration date
  - Large QR code (centered, 300x300px minimum)
  - Items table:
    - Item name
    - Quantity/Weight
    - Unit price
    - Line total
  - Totals:
    - Subtotal
    - Tax
    - Total
  - Instructions section:
    - "To retrieve this basket, scan the QR code above"
    - "Or provide the basket code: BSK-ABC123"
  - Footer:
    - Business contact info
    - "This basket expires on [date]"
  - Format: HTML (for printing) or PDF

## Error Handling

### Save Basket Errors

1. **Empty Cart**: "Cart is empty. Add items before saving."
2. **Database Error**: "Failed to save basket. Please try again."
3. **Code Generation Conflict**: Retry with new code (should be rare)

### Email Errors

1. **Invalid Email**: "Please enter a valid email address."
2. **Email Service Error**: "Failed to send email. Please try again or print the receipt instead."
3. **Email Not Configured**: "Email service is not configured. Please print the receipt instead."

### Receipt Errors

1. **Print Dialog Cancelled**: Silent (user cancelled)
2. **Print Error**: "Failed to generate receipt. Please try again."
3. **No Printer Available**: "No printer found. You can save the receipt as PDF instead."

### Retrieve Basket Errors

1. **Invalid Code Format**: "Invalid basket code format."
2. **Basket Not Found**: "Basket not found. Code may be incorrect."
3. **Basket Expired**: "This basket has expired and is no longer available."
4. **Basket Already Retrieved**: "This basket has already been retrieved." (if status = "retrieved")
5. **Product No Longer Available**: "Some items are no longer available. Please review cart."
6. **Price Changes**: "Some items have price changes. Please review cart."

## Security Considerations

1. **Code Uniqueness**: Ensure basket codes are unique per business
2. **Access Control**: Only users from same business can retrieve baskets
3. **Expiration**: Auto-expire baskets after configured time (default: 7 days)
4. **Rate Limiting**: Limit basket saves per user per hour
5. **Audit Trail**: Log all basket saves and retrievals

## Configuration Options

1. **Basket Code Length**: 6 characters (configurable)
2. **Expiration Days**: 7 days (configurable)
3. **Max Retrievals**: Unlimited or limit (configurable)
4. **Auto-Expire**: Enable/disable automatic expiration
5. **QR Code Size**: 256px (configurable)

## Data Cleanup

### Automated Cleanup Job

- Run daily
- Delete expired baskets older than 30 days
- Archive retrieved baskets older than 90 days
- Log cleanup statistics

## Testing Scenarios

1. ✅ Save basket with items
2. ✅ Save basket with empty cart (should fail)
3. ✅ Scan QR code and retrieve basket
4. ✅ Scan invalid QR code (should fail)
5. ✅ Scan expired basket (should fail)
6. ✅ Retrieve basket with price changes
7. ✅ Retrieve basket with unavailable products
8. ✅ Retrieve basket when current cart has items
9. ✅ Multiple retrievals of same basket
10. ✅ Basket expiration
11. ✅ Send QR code via email (with valid email)
12. ✅ Send QR code via email (with invalid email - should fail)
13. ✅ Send QR code via email (email service error handling)
14. ✅ Print receipt with QR code
15. ✅ Print receipt (no printer available - fallback to PDF)
16. ✅ Receipt contains all items and correct totals
17. ✅ QR code on receipt is scannable
18. ✅ Email contains QR code and item list
19. ✅ Customer can scan QR code from printed receipt
20. ✅ Customer can scan QR code from email

## Success Criteria

- ✅ User can save basket with QR code generation
- ✅ QR code is scannable by standard barcode scanners
- ✅ Scanning QR code populates cart with saved items
- ✅ System handles expired/retrieved baskets gracefully
- ✅ System handles price changes and unavailable items
- ✅ Basket codes are unique and secure
- ✅ Proper error messages for all failure cases
- ✅ User can send QR code via email to customer
- ✅ User can print receipt with QR code and all items
- ✅ Receipt is properly formatted and printable
- ✅ Email contains QR code and basket details
- ✅ Customer can retrieve basket by scanning QR from email or receipt

## Email Template Structure

### Email Subject

```
Your Saved Basket - [Basket Name]
```

### Email Body (HTML)

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      /* Business branding styles */
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <img src="[Business Logo]" alt="[Business Name]" />
        <h1>[Business Name]</h1>
      </div>

      <div class="content">
        <h2>Your Saved Basket</h2>
        <p>Hello,</p>
        <p>Your basket has been saved. You can retrieve it by scanning the QR code below when you return to the store.</p>

        <div class="basket-info">
          <p><strong>Basket Name:</strong> [Basket Name]</p>
          <p><strong>Basket Code:</strong> BSK-[CODE]</p>
          <p><strong>Expires:</strong> [Expiration Date]</p>
        </div>

        <div class="qr-code">
          <img src="[QR Code Image Data URL]" alt="Basket QR Code" />
          <p>Scan this code at the store</p>
        </div>

        <div class="items-list">
          <h3>Items in your basket:</h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <!-- Loop through items -->
              <tr>
                <td>[Item Name]</td>
                <td>[Quantity/Weight]</td>
                <td>£[Unit Price]</td>
                <td>£[Line Total]</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>Subtotal:</strong></td>
                <td>£[Subtotal]</td>
              </tr>
              <tr>
                <td colspan="3"><strong>Tax:</strong></td>
                <td>£[Tax]</td>
              </tr>
              <tr>
                <td colspan="3"><strong>Total:</strong></td>
                <td>£[Total]</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="instructions">
          <h3>How to retrieve your basket:</h3>
          <ol>
            <li>Visit our store</li>
            <li>Show the QR code above to the cashier, or</li>
            <li>Scan the QR code using our barcode scanner</li>
            <li>Your basket will be loaded automatically</li>
          </ol>
          <p><strong>Note:</strong> This basket expires on [Expiration Date]. Please retrieve it before then.</p>
        </div>
      </div>

      <div class="footer">
        <p>[Business Name]</p>
        <p>[Business Address]</p>
        <p>[Business Phone] | [Business Email]</p>
      </div>
    </div>
  </body>
</html>
```

## Receipt Template Structure

### Receipt Layout

```
┌─────────────────────────────────────┐
│        [Business Logo]               │
│        [Business Name]               │
│        [Business Address]            │
│        [Business Phone]              │
├─────────────────────────────────────┤
│         SAVED BASKET                 │
├─────────────────────────────────────┤
│ Basket Name: [Name]                 │
│ Basket Code: BSK-[CODE]             │
│ Saved: [Date/Time]                  │
│ Expires: [Date/Time]                │
├─────────────────────────────────────┤
│                                     │
│        [QR CODE - LARGE]            │
│                                     │
│   Scan to retrieve this basket      │
│                                     │
├─────────────────────────────────────┤
│ ITEMS:                              │
│ ─────────────────────────────────── │
│ [Item Name]      [Qty]  £[Price]   │
│ [Item Name]      [Qty]  £[Price]   │
│ ...                                 │
├─────────────────────────────────────┤
│ Subtotal:                  £[Sub]   │
│ Tax:                       £[Tax]   │
│ ─────────────────────────────────── │
│ Total:                     £[Total] │
├─────────────────────────────────────┤
│ INSTRUCTIONS:                       │
│ • Scan the QR code above to        │
│   retrieve this basket              │
│ • Or provide code: BSK-[CODE]      │
│ • Expires: [Date]                  │
├─────────────────────────────────────┤
│ Thank you for shopping with us!     │
│ [Business Contact Info]             │
└─────────────────────────────────────┘
```

## Implementation Notes

### Email Service

- Use existing email service (Resend/SMTP) if available
- Generate QR code as base64 image for email embedding
- Include plain text version for email clients that don't support HTML
- Handle email service errors gracefully

### Receipt Printing

- Use browser print API (`window.print()`)
- Generate receipt as HTML with print-optimized CSS
- Ensure QR code is large enough for scanning (minimum 300x300px)
- Support saving as PDF (via browser print to PDF)
- Use print media queries for proper formatting

### Customer Experience Flow

1. Customer adds items to cart
2. Cashier clicks "Save basket"
3. Cashier chooses:
   - **Email**: Customer provides email, receives QR code via email
   - **Receipt**: Cashier prints receipt with QR code, gives to customer
4. Customer returns later with:
   - QR code from email (on phone)
   - OR printed receipt with QR code
5. Cashier scans QR code
6. Basket is automatically loaded
7. Customer can proceed to checkout
