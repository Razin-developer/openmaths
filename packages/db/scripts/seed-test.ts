/**
 * Guarded dev/staging reset + seed script (PRD "Sharing, Access Roles, Notifications &
 * Collaboration" §1/§9A).
 *
 * NEVER a blind destructive delete against production data — this refuses to run unless:
 *   1. NODE_ENV !== "production", AND
 *   2. DATABASE_URL clearly points at a local/non-production database, AND
 *   3. SEED_CONFIRM=1 is set explicitly on the invocation.
 *
 * What it does:
 *   - Keeps only two users: TEST_USER_EMAIL and SECOND_USER_EMAIL (creating either that's missing,
 *     with a hashed password), deleting every other user and everything that FK-cascades from
 *     their canvases.
 *   - Wipes ALL canvases (including the two kept users' own), then seeds one fresh
 *     "QA — All Features" canvas owned by the test user.
 *
 * Usage:
 *   SEED_CONFIRM=1 pnpm exec tsx scripts/seed-test.ts
 */
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const TEST_USER_EMAIL = (process.env.TEST_USER_EMAIL ?? "test@openmaths.dev").toLowerCase();
const SECOND_USER_EMAIL = (process.env.SECOND_USER_EMAIL ?? "second-test@openmaths.dev").toLowerCase();
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "TestUser12345!";
const SECOND_USER_PASSWORD = process.env.SECOND_USER_PASSWORD ?? "SecondTestUser12345!";

function assertSafeToRun() {
  if (process.env.SEED_CONFIRM !== "1") {
    console.error("Refusing to run: set SEED_CONFIRM=1 to confirm you want to reset this database.");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run: NODE_ENV is 'production'.");
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL ?? "";
  const looksLocal = /(^|@)(localhost|127\.0\.0\.1)([:/]|$)/i.test(dbUrl);
  if (!dbUrl || !looksLocal) {
    console.error(
      "Refusing to run: DATABASE_URL does not look like a local dev database " +
        "(expected localhost/127.0.0.1). Got: " +
        (dbUrl ? dbUrl.replace(/:[^:@/]+@/, ":***@") : "(unset)")
    );
    process.exit(1);
  }
}

assertSafeToRun();

const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL, max: 1 }));
const prisma = new PrismaClient({ adapter });

async function ensureUser(email: string, displayName: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 10);
  // Pre-verified (PRD "Auth & Security Audit" F1): email-based sharing access requires
  // `emailVerified`, and this script's whole point is exercising the sharing flow end to end —
  // a fresh QA account stuck unverified would silently block every §9C acceptance check on a
  // real account-existence detail that has nothing to do with what this script is testing.
  const created = await prisma.user.create({ data: { email, displayName, passwordHash, emailVerified: new Date() } });
  console.log(`Created missing user ${email}`);
  return created;
}

async function deleteUserCompletely(userId: string) {
  // Canvas -> Block/Connection/CanvasCollaborator/CanvasShareLink all cascade via onDelete:
  // Cascade on canvasId; Notification cascades via onDelete: Cascade on userId. ActivityEvent
  // and Skill/SkillTag have no cascade defined, so they're deleted explicitly first to satisfy
  // the FK before the user row itself goes.
  await prisma.canvas.deleteMany({ where: { userId } });
  await prisma.activityEvent.deleteMany({ where: { userId } });
  await prisma.skill.deleteMany({ where: { userId } });
  await prisma.skillTag.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

async function main() {
  console.log(`Keeping only: ${TEST_USER_EMAIL}, ${SECOND_USER_EMAIL}`);

  const testUser = await ensureUser(TEST_USER_EMAIL, "Test User", TEST_USER_PASSWORD);
  await ensureUser(SECOND_USER_EMAIL, "Second User", SECOND_USER_PASSWORD);

  const keepEmails = new Set([TEST_USER_EMAIL, SECOND_USER_EMAIL]);
  // `email: { notIn: [...] }` alone would silently spare guest accounts (email: null) — SQL's
  // NOT IN never matches NULL, so those rows just drop out of the result set. Match them
  // explicitly instead.
  const others = await prisma.user.findMany({
    where: { OR: [{ email: null }, { email: { notIn: Array.from(keepEmails) } }] },
    select: { id: true, email: true },
  });
  for (const other of others) {
    await deleteUserCompletely(other.id);
    console.log(`Deleted user ${other.email ?? other.id}`);
  }

  // Wipe ALL canvases per §1/§9A, including the two kept users' own, then reseed one QA canvas.
  const { count: canvasesDeleted } = await prisma.canvas.deleteMany({});
  console.log(`Deleted ${canvasesDeleted} canvas(es).`);

  const qaCanvas = await prisma.canvas.create({
    data: {
      title: "QA — All Features",
      userId: testUser.id,
      blocks: {
        create: [
          {
            kind: "QUESTION",
            status: "READY",
            title: "Sample question",
            prompt: "What is the area of a circle with radius 4?",
            positionX: 0,
            positionY: 0,
            messages: {
              create: [
                { role: "USER", content: "What is the area of a circle with radius 4?" },
                { role: "ASSISTANT", content: "The area is $\\pi r^2 = 16\\pi \\approx 50.27$ square units." },
              ],
            },
          },
          {
            kind: "NOTE",
            status: "READY",
            title: "Sample note",
            prompt: "Formulas to remember:\n- Circle area: πr²\n- Circle circumference: 2πr",
            positionX: 360,
            positionY: 0,
          },
        ],
      },
    },
  });
  console.log(`Seeded canvas "${qaCanvas.title}" (${qaCanvas.id}) for ${TEST_USER_EMAIL}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
