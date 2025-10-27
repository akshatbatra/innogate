# Database Setup for Innogate Research Platform

## Prerequisites

- PostgreSQL installed and running
- Node.js and npm installed

## Setup Steps

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE innogate;

# Exit psql
\q
```

### 2. Run Database Migrations

Using Drizzle Kit (recommended):
```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Run migrations
```

Or push schema directly (for development):
```bash
npm run db:push
```

### 3. Seed the Database (Optional)

Run the seed SQL file:
```bash
psql -U postgres -d innogate -f seed.sql
```

Or connect to the database and run the seed commands manually.

### 4. Verify Setup

Open Drizzle Studio to browse your database:
```bash
npm run db:studio
```

## Database Schema

### `users` table
- Stores Auth0 authenticated users
- Primary key: `id` (UUID)
- Unique constraints: `email`, `auth0_sub`

### `linked_researchers` table
- Stores ORCID associations for each user
- Primary key: `id` (UUID)
- Foreign key: `user_id` references `users(id)`
- Unique constraint: `(user_id, orcid_id)` - prevents duplicate ORCID links

## Usage

The database will automatically:
- Store user profiles when they log in via Auth0
- Link ORCID IDs to user accounts when they add researchers
- Cascade delete linked researchers when a user is deleted
- Prevent duplicate ORCID associations per user
