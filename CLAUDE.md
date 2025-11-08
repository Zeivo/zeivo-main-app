# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zeivo is a price comparison platform for electronics products built with React, TypeScript, Vite, and Supabase. The application allows users to browse products, compare prices from different merchants, and track price alerts. It features an admin panel for managing products and an AI-powered price scraping and normalization system.

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn-ui + Tailwind CSS + Radix UI
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **AI/ML**: Google Vertex AI (Gemini 2.5 Flash)
- **Web Scraping**: Firecrawl API

## Development Commands

```bash
# Install dependencies
npm i

# Start development server (runs on http://localhost:8080)
npm run dev

# Build for production
npm build

# Build for development mode
npm run build:dev

# Lint the codebase
npm run lint

# Preview production build
npm preview
```

## Architecture

### Frontend Structure

- **`src/App.tsx`**: Main application entry point with router configuration
- **`src/main.tsx`**: React DOM mounting
- **`src/pages/`**: Page components for routing
  - `Index.tsx`: Homepage with product listings
  - `Product.tsx`: Individual product detail page with variants and merchant listings
  - `Auth.tsx`: Authentication (sign in/sign up)
  - `Admin.tsx`: Admin dashboard for managing products and processing AI jobs
  - `Profile.tsx`: User profile management
  - `Support.tsx`: Customer support page
  - `TestVertexAI.tsx`: Testing interface for Vertex AI integration
- **`src/components/ui/`**: shadcn-ui components (auto-generated, do not manually edit)
- **`src/hooks/`**: Custom React hooks
  - `useAuth.tsx`: Authentication state management
  - `useAdmin.tsx`: Admin role verification
  - `useProducts.tsx`: Product data fetching with React Query
- **`src/integrations/supabase/`**: Supabase client and auto-generated types
  - `client.ts`: Supabase client configuration
  - `types.ts`: Auto-generated TypeScript types from database schema
- **`src/lib/`**: Utility functions

### Backend Structure (Supabase Edge Functions)

All Edge Functions are in `supabase/functions/`:

- **`ai-worker/`**: Processes AI jobs from the queue (product normalization, attribute extraction)
- **`update-prices/`**: Scrapes merchant websites for product prices using Firecrawl
- **`check-price-alerts/`**: Monitors price changes and sends alerts to users
- **`fix-invalid-prices/`**: Validates and fixes incorrect price data
- **`search-product-images/`**: Searches for and updates product images
- **`test-vertex-ai/`**: Testing endpoint for Vertex AI integration

### Database Schema

Key tables (see `src/integrations/supabase/types.ts` for complete schema):

- **`products`**: Product catalog (name, slug, category, image)
- **`product_variants`**: Product variants (storage, color, model, prices)
- **`merchant_listings`**: Individual price listings from merchants
- **`ai_jobs`**: Queue for AI processing tasks (normalization, extraction)
- **`ai_cache`**: Caching layer for AI responses
- **`price_alerts`**: User price tracking alerts
- **`profiles`**: User profiles (linked to auth.users)

### Data Flow

1. **Price Scraping**: `update-prices` function scrapes merchant sites → stores raw data in `merchant_listings`
2. **AI Processing**: Creates jobs in `ai_jobs` → `ai-worker` processes with Vertex AI → normalizes prices and extracts attributes
3. **Frontend Display**: React Query hooks fetch data → displays in product pages with real-time updates

## Key Patterns

### Authentication

- Uses `useAuth` hook for auth state management
- Supabase Auth with email/password
- Protected routes check user session
- Admin routes additionally check `is_admin` flag in profiles table

### Data Fetching

All data fetching uses TanStack Query with custom hooks in `src/hooks/useProducts.tsx`:
- `useProducts()`: Fetch all products
- `useProduct(slug)`: Fetch single product by slug
- `useProductVariants(productId)`: Fetch variants for a product
- `useVariantListings(variantId)`: Fetch merchant listings for a variant

### AI Integration

- AI jobs are queued in `ai_jobs` table with `status: 'pending'`
- `ai-worker` function processes jobs using Vertex AI (Gemini 2.5 Flash)
- Results are cached in `ai_cache` table for performance
- Two job types:
  - `normalize-offer`: Match merchant listings to products
  - `extract-attributes`: Extract product attributes from text

### TypeScript Configuration

- Path alias: `@/*` maps to `./src/*`
- Relaxed strictness for rapid development (noImplicitAny: false, strictNullChecks: false)
- Use the alias consistently across imports

## Supabase Edge Functions

### Local Development

```bash
# Requires Supabase CLI
supabase functions serve <function-name>
```

### Deployment

Edge Functions are deployed through Lovable or manually via Supabase CLI. Configuration is in `supabase/config.toml`.

### JWT Verification

- `verify_jwt = true`: Requires authenticated user (used for admin/protected functions)
- `verify_jwt = false`: Public access (used for webhooks and background jobs)

## Environment Variables

Required for Supabase Edge Functions:
- `VERTEX_AI_API_KEY`: Google Cloud API key for Vertex AI
- `FIRECRAWL_API_KEY`: Firecrawl API key for web scraping

## Important Conventions

- **All new routes must be added above the catch-all `*` route in `App.tsx`**
- Database types in `src/integrations/supabase/types.ts` are auto-generated - do not edit manually
- shadcn-ui components in `src/components/ui/` are auto-generated - do not edit directly
- Use React Query for all data fetching - avoid direct Supabase calls in components
- Product URLs use slug-based routing: `/produkt/:slug`

## Lovable Integration

This project is managed through Lovable (lovable.dev). Changes made via Lovable are automatically committed to the repository. The `lovable-tagger` plugin is used in development mode for component tracking.
