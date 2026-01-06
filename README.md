# JuruKasa

**JuruKasa** is a modern Point-of-Sale (POS) web application with integrated double-entry accounting, designed specifically for small retail businesses in Indonesia. It runs entirely in your browser with local database storage, giving you the convenience of a desktop application without installation.

## What is JuruKasa?

JuruKasa is a complete business management solution that combines:

- **Point-of-Sale (POS) Cashier** — Process sales quickly with product search, quantity management, discounts, and multiple payment methods
- **Inventory Management** — Track stock levels, set up barcodes, perform stock taking, and get low-stock alerts
- **Procurement** — Manage suppliers and create purchase orders
- **Double-Entry Accounting** — Full accounting system compliant with Indonesian accounting standards (PSAK/IFRS)
- **Financial Reports** — Generate trial balance, balance sheet, and income statements
- **Fiscal Year Management** — Handle fiscal year periods and automated year-end closing entries

### Key Features

| Feature | Description |
|---------|-------------|
| 🏪 **POS Cashier** | Fast checkout with product selection, discount application, and payment processing |
| 📦 **Stock Management** | Real-time inventory tracking with stock alerts and stock taking support |
| 📊 **Financial Dashboard** | At-a-glance view of revenue, cash balances, and business metrics |
| 📒 **Chart of Accounts** | Pre-configured Indonesian retail business chart of accounts |
| 🔒 **Local-First** | Your data stays in your browser or your own Turso database |

## What JuruKasa is NOT

- ❌ **Not a cloud service** — JuruKasa doesn't store your data on our servers. You own and control your data completely.
- ❌ **Not a multi-user system** — This is a single-user application designed for individual business owners or cashiers.
- ❌ **Not mobile-ready yet** — Currently optimized for desktop browsers (Chromium-based, version 140+). Mobile support is planned.
- ❌ **Not an ERP system** — JuruKasa focuses on POS and basic accounting, not full enterprise resource planning.

## System Requirements

- **Modern Chromium-based browser** (Chrome, Edge, Brave, etc.) version 140 or above
- **Turso database** for data persistence (free tier available)
- **Internet connection** for initial setup and database sync

## Getting Started

### Step 1: Create a Turso Database

JuruKasa uses [Turso](https://turso.tech/) as its database backend. Turso offers a generous free tier perfect for small businesses.

1. Sign up at [turso.tech](https://turso.tech/)
2. Install the Turso CLI:
   ```bash
   # macOS
   brew install tursodatabase/tap/turso
   
   # Linux
   curl -sSfL https://get.tur.so/install.sh | bash
   
   # Windows (WSL)
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
3. Login and create a database:
   ```bash
   turso auth login
   turso db create jurukasa
   ```
4. Get your database URL and create an auth token:
   ```bash
   turso db show jurukasa --url
   turso db tokens create jurukasa
   ```

### Step 2: Access JuruKasa

**Option A: Use the hosted version**

TODO: Update with actual hosted URL when available.

**Option B: Run locally**

1. Clone the repository:
   ```bash
   git clone https://github.com/faisalhakim47/jurukasa-web.git
   cd jurukasa-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open http://localhost:8000 in your browser

### Step 3: Configure Your Business

On first launch, you'll be guided through the setup wizard:

1. **Configure Database** — Enter your Turso database URL and auth token
2. **Business Configuration** — Set up your business name, currency, and fiscal year settings
3. **Chart of Accounts** — Select "Retail Business - Indonesia" template for a pre-configured Indonesian retail chart of accounts

### Step 4: Start Using JuruKasa

After setup, you'll see the main dashboard with navigation to:

- **Dashboard** — Overview of your business metrics
- **Books** — Access accounting features like journal entries, chart of accounts, and financial reports
- **Stock** — Manage inventory, barcodes, and perform stock taking
- **Procure** — Handle suppliers and purchase orders
- **Sale** — Access the POS cashier and view sales history
- **Settings** — Configure application settings

## Using the POS Cashier

1. Navigate to **Sale** → **Point of Sales**
2. Select products from the right panel (they'll be added to your invoice)
3. Adjust quantities using the +/- buttons
4. Applied discounts are calculated automatically (or add general discounts manually)
5. Add payment methods and amounts
6. Click **Complete Sale** to process the transaction

All sales automatically generate proper accounting journal entries for:
- Sales revenue
- Cost of goods sold (COGS)
- Inventory reduction
- Payment method receipts
- Applied discounts

## Data Backup

Since JuruKasa uses Turso as the database, your data is automatically synced and backed up by Turso's infrastructure. You can also:

- Export your database using Turso CLI: `turso db shell jurukasa .dump > backup.sql`
- Create database replicas for additional redundancy

## Development

For developers who want to contribute or customize JuruKasa:

```bash
# Install dependencies
npm install

# Build vendor bundles (required after dependency updates)
npm run build

# Start development server
npm start

# Run tests
npm test

# Run database schema tests
npm run test:db
```

### Technology Stack

- **Frontend**: Vanilla JavaScript with Web Components
- **Templating**: lit-html
- **Reactivity**: @vue/reactivity
- **Styling**: Material 3 Expressive Design System
- **Database**: SQLite via Turso/LibSQL
- **Testing**: Playwright

## License

JuruKasa is licensed under the [Functional Source License (FSL-1.1-MIT)](LICENSE).

This means:
- ✅ Free for personal and internal business use
- ✅ Free for non-commercial education and research
- ✅ Source code becomes MIT licensed after 2 years
- ❌ Cannot be used to create competing commercial products

## Support

If you encounter issues or have questions:

1. Check the [Issues](https://github.com/faisalhakim47/jurukasa-web/issues) page
2. Create a new issue with detailed information about your problem

---

<p align="center">
  Made with ❤️ for Indonesian small businesses<br>
  <small>© 2026 Faisal Hakim</small>
</p>
