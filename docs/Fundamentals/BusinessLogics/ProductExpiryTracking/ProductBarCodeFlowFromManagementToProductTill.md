### The Overall Goal of Product Creation

Think of your POS system as a digital filing cabinet for your inventory. Every product you sell needs a "file" inside this cabinet. This file contains all the information the system needs to sell the item, track it, and reorder it.

---

### Part 1: The Product Creation Process (Manual Entry)

This is the foundational step, done either by typing information in or by importing it.

**Step 1: Navigate to the Product Management Module**

- Log in to your POS software's back-end or admin panel.
- Look for a section labeled **"Products," "Inventory," "Items,"** or **"Catalog."**

**Step 2: Initiate Adding a New Product**

- There will be a prominent button like **"Add Product," "New Item,"** or **"Create Product."** Click it.

**Step 3: Fill in the Core Product Information**
A form will appear. The client needs to fill in key details. Essential fields are usually marked with an asterisk (\*).

- **Product Name/Description:** e.g., "Acme Wireless Mouse - Black"
- **SKU (Stock Keeping Unit):** This is a unique internal code you create. It's critical for tracking.
  - _Example:_ `ACME-MOUSE-BLK`
- **Price:** The selling price (e.g., `24.99`).
- **Cost:** What you paid for the item (e.g., `12.50`). This is for profit calculation.
- **Tax Setting:** Is the product taxable? (Yes/No).
- **Category:** Assign it to a category like "Electronics," "Computer Accessories," etc. This helps with reporting and organization.

**Step 4: Inventory Management Settings**

- **Track Stock:** Enable this option if you want the system to automatically deduct sold items from your inventory count.
- **Current Stock Quantity:** Enter the number of units you currently have on hand (e.g., `50`).
- **Low Stock Alert:** Set a threshold (e.g., `5`). The system will warn you when stock falls to this level.

**Step 5: Save the Product**

- Click **"Save," "Create,"** or **"Add Product."** The item is now in your system and can be sold.

---

### Part 2: Where Barcodes Come In

A barcode is simply a **unique identifier** that the computer can read instantly. It's a fast alternative to typing.

**1. Understanding the Barcode Field**

- In the product creation form, there is a field labeled **"Barcode," "UPC," "EAN,"** or **"GTIN."**

**2. How Does a Product Get a Barcode?**
There are two main scenarios:

- **Scenario A: Pre-Barcoded Products (Most Common)**

  - You buy products from a wholesaler or manufacturer (e.g., a can of Coke, a specific brand of headphones).
  - These items **already have a barcode** printed on their packaging.
  - **What the client does:** They simply type the numbers from that barcode into the "Barcode" field in their POS system.
  - _Example:_ A box of LEGO has a barcode `5702016110011`. The client enters `5702016110011` into the product's record.

- **Scenario B: Your Own Products (No Existing Barcode)**
  - You sell items that don't have a barcode (e.g., homemade crafts, bakery items, custom t-shirts, bulk nuts).
  - **What the client does:** The POS system can often **generate a unique internal barcode** for you. Alternatively, you can buy a roll of "blank" UPC codes online and assign one to the product. You then print a sticky label with this new barcode and attach it to the product or its bin.

---

### Part 3: How the Barcode Scanner Fits In

The barcode scanner is the bridge between the physical product and the digital record in your POS.

**1. The "Magic" Connection**

- The scanner is plugged into the computer (usually via USB) and acts like a super-fast keyboard.
- When you scan a barcode, it translates the lines into the corresponding numbers and "types" them into whatever field is active on the screen, followed by an "Enter" keypress.

**2. Using the Scanner in Practice**

- **At the Checkout/Sales Screen:**

  1.  The cashier opens a new sale.
  2.  They pick up a product (e.g., the Acme Wireless Mouse) and scan its barcode.
  3.  _Instantly_, the scanner sends the barcode number to the POS.
  4.  The POS software searches its database for a product with that exact barcode.
  5.  It finds the "Acme Wireless Mouse" record and adds it to the sale—pulling in the name, price, and tax setting automatically.
  6.  The cashier moves on to the next item. This is **incredibly faster** than searching for the product by name.

- **During Inventory Management:**
  - **Receiving Stock:** When a new shipment arrives, you can scan each item's barcode to quickly add the quantities to your inventory count.
  - **Stocktake:** Instead of manually writing down counts, you walk around the store and scan each item. The POS system will bring up the product, and you just type in the physical count you see on the shelf.

### Summary: The Seamless Workflow

1.  **Create the Product:** Manually enter the product's details (Name, Price, SKU) into the POS system.
2.  **Assign a Barcode:** Link the product to a unique barcode number (either from the manufacturer or generated internally).
3.  **Use the Scanner:** In daily operations, use the barcode scanner to instantly call up that product's information for sales, receiving, and counting.

This process turns the complex task of managing hundreds or thousands of items into a fast, accurate, and efficient operation.

Looking at this wholesaler stock report, here's how barcodes work in this file and how they are generated:

## The Barcode Field: **"Eans" Column**

The **"Eans" column** contains the barcode numbers that would be used for scanning products.

## How These Barcodes Are Generated:

### 1. **Manufacturer-Assigned Barcodes (Most Common)**

- These are pre-printed on products by manufacturers
- Examples from your file:
  - `5000112552126` (Dr Pepper) - Standard 13-digit EAN
  - `8801030000396` (Chum Chum Strawberry) - Korean product EAN
  - `8718226323002` (MAAZA LYCHEE) - Dutch product EAN
  - `5901359154213` (Tyskie) - Polish product EAN

### 2. **Internal/Wholesaler Codes Used as Barcodes**

- Some items use internal codes that double as scannable barcodes
- Examples:
  - `05013668436239` (Blackstrom) - Likely a wholesaler's internal code
  - `PP274623BKR` appears in Item Code but `5000112552126` is the actual scannable EAN

### 3. **Multiple Barcodes for Same Product**

- One product can have multiple valid barcodes
- Example: `Jinro Strawberry` has Eans: `8801048178018|8801048179145`
  - The `|` symbol separates two valid barcodes for the same product

## Key Insights for Your POS Setup:

### **What to Use as Barcode in Your System:**

- Use the numbers from the **"Eans" column** when creating products
- If multiple barcodes exist (separated by `|`), you can enter all of them in your POS

### **Important Notes:**

1. **Some products have $0.00 Cost Price** - you'll need to update these with actual costs
2. **Some missing Supplier data** - you may want to complete this information
3. **Watch for negative profit items** like:
   - Holsten Pills (-£24.57)
   - Nigerian Guinness (-£40.00)
     These indicate retail price may be too low compared to cost

### **Recommended Action:**

When creating these products in your POS, use the "Eans" numbers as the primary barcode, and consider adding the "Item Code" as a secondary SKU for internal tracking.

The barcode scanner will read these EAN numbers and instantly find the correct product in your system during sales.

When your product table has a "barcode" field, you should copy/paste the exact value from the "Eans" column for each corresponding product.

## Here's how it works in practice:

### **Direct Mapping:**

```
CSV "Eans" column  →  Your POS "Barcode" field
5000112552126      →  5000112552126
8801030000396      →  8801030000396
8718226323002      →  8718226323002
```

### **Special Cases to Handle:**

1. **Multiple Barcodes** (like Jinro Strawberry):

   - **Option A:** Enter the first barcode `8801048178018` as primary
   - **Option B:** If your POS supports multiple barcodes per product, enter both separated by commas or in separate fields

2. **Internal Codes as EANs** (like Blackstrom `05013668436239`):

   - Still use the exact Eans value `05013668436239` - it will scan the same way

3. **Item Code vs EAN** (like Dr Pepper):
   - Item Code: `PP274623BKR` (internal reference)
   - **Eans/Barcode:** `5000112552126` ← **Use this one for scanning**

## Why This Works Perfectly:

- When you scan the **physical product's barcode**, it will match the **exact number** you entered from the "Eans" column
- The scanner sends `5000112552126` → POS searches barcode field → finds Dr Pepper → auto-populates price, description, etc.

## Pro Tip:

You can use the "Item Code" column as your **SKU** field in the POS for internal tracking, while using "Eans" exclusively for the barcode/scanner functionality.

This approach ensures seamless scanning of all the products you just purchased from this wholesaler!
