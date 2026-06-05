# Member Payment Tracker

A production-ready Next.js 15 administrative application to track membership directories, payments, subscriptions, and dues, integrated with Supabase PostgreSQL, Supabase Auth, and Tailwind CSS v4.

This is an internal administrative tool designed for a single administrator. It contains **no public registration**, **no member-facing portal**, and **no online payment gateways**.

---

## Tech Stack
* **Framework**: Next.js 15 (App Router, React 19)
* **Language**: TypeScript
* **Styling**: Tailwind CSS v4
* **Database & Auth**: Supabase PostgreSQL & Auth
* **Hosting**: Vercel (Frontend/API) and Supabase (Backend)

---

## Features
1. **Admin Portal**: Secure password-based admin login with session persistence. Unauthorized users are auto-logged out.
2. **Dashboard Widgets**:
   * Total Members
   * Paid Members
   * Unpaid Members (Due Soon + Overdue)
   * Due Today
   * Due This Week
   * Overdue Members
   * Prominent click-to-view overdue alert banner.
3. ** Roster Management**:
   * Add members with subscription configuration (Monthly/Yearly, cost, start date).
   * Edit profile data.
   * Delete members with validation confirmation modal.
4. **Subscription Due Tracking**:
   * Monthly subscriptions: Due Soon = within 7 days; Overdue = past due date.
   * Yearly subscriptions: Due Soon = within 30 days; Overdue = past due date.
   * Option A Billing Extension: If not overdue, adds interval from current due date; if overdue, adds interval from payment date.
5. **Instant Search & Status Filtering**: Search members by name or phone number instantly with status categorization tabs.
6. **Payment Logging**: Record installments, notes, and auto-calculate next due date. Maintains full historical log.
7. **Audit Reporting**: Export membership audits to CSV and print clean ledger reports.

---

## Folder Structure
```text
├── public/                  # Static assets
├── supabase/
│   └── schema.sql           # Database tables, indexes, RLS, and triggers
├── src/
│   ├── app/
│   │   ├── dashboard/       # Protected dashboard layouts & sub-routes
│   │   │   ├── members/     # Roster lists & detail profile logs
│   │   │   ├── pending/     # Collections ledger
│   │   │   └── reports/     # Financial summary page
│   │   ├── login/           # Authentication portal
│   │   ├── globals.css      # Custom Tailwind styles & print media overrides
│   │   ├── layout.tsx       # Next.js main layout wrapper
│   │   └── page.tsx         # Route root redirector
│   ├── components/
│   │   └── Sidebar.tsx      # Responsive navigation drawer
│   ├── lib/
│   │   ├── admin.ts         # Server-side verification check
│   │   ├── dueUtils.ts      # Due date math & database status syncing
│   │   └── supabase.ts      # Supabase browser and server wrappers
│   └── middleware.ts        # Next.js authentication router protection
├── .env.example             # Example environment variables
├── package.json             # App dependencies
└── tsconfig.json            # TypeScript configuration
```

---

## Setup & Database Configuration

### 1. Database Schema Deployment
1. Go to your [Supabase Dashboard](https://supabase.com/).
2. Select your project, and open the **SQL Editor** on the left menu.
3. Click **New Query**, paste the contents of `supabase/schema.sql`, and click **Run**.
   * *This creates the `admins`, `members`, and `payments` tables, indexes for performance, Row Level Security (RLS) filters, and a trigger to link authenticated users to the admin profile.*

### 2. Admin User Creation
Since there is no public registration form, administrative accounts must be added manually:
1. Go to your **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Fill in the email and password, and click **Create User**.
   * *The Postgres trigger `on_auth_user_created` automatically creates an entry for this user in the public `admins` table, allowing them to bypass RLS policies.*

---

## Local Development Configuration

### 1. Configure Environment Variables
Copy the `.env.example` file and create `.env.local`:
```bash
cp .env.example .env.local
```
Update `.env.local` with your Supabase credentials found in **Project Settings** -> **API**:
* `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase API URL.
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Project Anon Public Key.

### 2. Launch the Development Server
Install dependencies and run Next.js:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment Instructions

### Deploying Database (Supabase)
The database structure is managed in your Supabase project as described in the Setup section. No other database hosting is required.

### Deploying Frontend (Vercel)
1. Push your project code to a git repository (GitHub, GitLab, Bitbucket).
2. Log in to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
3. Import your repository.
4. Expand **Environment Variables** and add:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**. Vercel will build the Next.js app and assign a dynamic `.vercel.app` URL to access your Tracker.
