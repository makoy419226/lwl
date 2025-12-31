# Liquid Washes Laundry Management System

## Overview

A full-stack laundry business management application built for "Liquid Washes Laundry" in the UAE. The system handles inventory management, client tracking, billing, and daily sales reporting. It features a React frontend with a clean, modern UI and an Express.js backend with PostgreSQL database storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled via Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state with custom hooks pattern
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens (CSS variables for theming)
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript compiled with tsx for development, esbuild for production
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod schemas shared between frontend and backend via `@shared/*` path alias

### Data Storage
- **Database**: PostgreSQL (connection via `DATABASE_URL` environment variable)
- **Schema Location**: `shared/schema.ts` - defines products, clients, bills, client_transactions, and users tables
- **Migrations**: Drizzle Kit with `drizzle-kit push` command for schema synchronization

### Authentication
- Simple username/password authentication stored in the users table
- Session state managed client-side via localStorage
- Role-based access (admin, staff roles defined in schema)
- No session middleware currently implemented on backend

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks for data fetching
│   └── lib/             # Utilities and query client setup
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database access layer
│   ├── db.ts            # Drizzle database connection
│   └── seed.ts          # Database seeding for laundry items
├── shared/              # Shared code between frontend/backend
│   ├── schema.ts        # Drizzle table definitions
│   └── routes.ts        # API route type definitions
└── migrations/          # Drizzle migration files
```

### Build System
- Development: `tsx` for TypeScript execution with Vite dev server
- Production: esbuild bundles server code, Vite builds client to `dist/public`
- Static file serving from `dist/public` in production mode

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connected via `pg` driver with connection pooling
- **Drizzle ORM**: Type-safe database queries and schema management

### UI Libraries
- **Radix UI**: Accessible, unstyled component primitives (dialog, dropdown, tabs, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **react-icons**: Additional icons (WhatsApp integration)

### Form & Validation
- **Zod**: Schema validation for both frontend forms and API request/response
- **React Hook Form**: Form state management
- **drizzle-zod**: Generates Zod schemas from Drizzle table definitions

### Data Fetching
- **TanStack React Query**: Async state management with caching

### Date Handling
- **date-fns**: Date formatting and manipulation utilities

### Development Tools
- **Vite**: Frontend build tool with HMR
- **esbuild**: Fast server bundling for production
- **TypeScript**: Type safety across the entire stack