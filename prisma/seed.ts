import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding users + reviews only...");

  // 1️⃣ Fetch existing movies (CRITICAL)
  const movies = await prisma.movie.findMany({
    select: { id: true },
  });

  if (movies.length === 0) {
    throw new Error("❌ No movies found. Seed TMDB data first.");
  }

  // Get or create user role
  const userRole = await prisma.role.upsert({
    where: { name: "user" },
    update: {},
    create: { name: "user" },
  });

  // 2️⃣ Create users
  const users = await Promise.all(
    Array.from({ length: 200 }).map(async (_, i) =>
      prisma.user.create({
        data: {
          email: `loaduser${Date.now()}_${i}@test.com`,
          passwordHash: await bcrypt.hash("password123", 10),
          name: `Load User ${i}`,
          roleId: userRole.id,
        },
      })
    )
  );

  // 3️⃣ Create large review dataset
  const reviewsData = [];

  for (const movie of movies) {
    for (let i = 0; i < 150; i++) {
      const user = users[Math.floor(Math.random() * users.length)];

      reviewsData.push({
        userId: user.id,
        movieId: movie.id,
        content: "Load test review",
        isSpoiler: Math.random() > 0.85,
        createdAt: new Date(Date.now() - Math.random() * 1e10),
      });
    }
  }

  await prisma.review.createMany({
    data: reviewsData,
    skipDuplicates: true,
  });

  console.log("✅ Load seeding complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
