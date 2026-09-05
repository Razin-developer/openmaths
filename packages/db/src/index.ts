import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Moved verbatim from the pre-split app's src/lib/prisma.ts (PRD "Split into app + server" P0) — same
// pooled-singleton pattern, just relocated so both `app` and (starting P1) `server` can share one
// Prisma client instead of each maintaining their own pool against the same database.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// PRD "Performance Audit & Answer-Rendering Fix" B1 — `max: 1` meant the ENTIRE app ran at most
// one DB query at a time, every other query queuing behind it; DATABASE_URL's own
// `connection_limit=10` was silently overridden by this. 10 matches that connection string
// (env-overridable for deployments with a different pooled-Postgres limit).
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? "10");
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL, max: POOL_MAX }));

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "../generated/prisma/enums";
export type * from "../generated/prisma/client";
