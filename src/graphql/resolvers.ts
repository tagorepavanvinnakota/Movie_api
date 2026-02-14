import { prisma } from "../config/db-adapter";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireAuth } from "../utils/requireAuth";
import { GraphQLError } from "graphql";
import { Context } from "../server";

type CreateOrUpdateReviewArgs = {
  movieId: string;
  content: string;
  isSpoiler?: boolean;
};

type ReviewsByMovieArgs = {
  movieId: string;
  cursor?: string;
  limit?: number;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
export const resolvers = {
  Query: {
    movies: async (
      _: unknown,
      args: { page: number; limit: number },
      context: Context,
    ) => {
      const { page, limit } = args;

      const skip = (page - 1) * limit;

      return prisma.movie.findMany({
        orderBy: { popularity: "desc" },
        skip,
        take: limit,
      });
    },

    movie: async (_: unknown, args: { id: string }) => {
      return prisma.movie.findUnique({ where: { id: args.id } });
    },
    
    reviewsByMovie: async (
      _: unknown,
      { movieId, cursor, limit = 10 }: ReviewsByMovieArgs,
    ) => {
      const take = Math.min(limit, 50);

      const reviews = await prisma.review.findMany({
        where: { movieId },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor },
        }),
      });

      const hasNextPage = reviews.length > take;
      const items = hasNextPage ? reviews.slice(0, take) : reviews;
      const nextCursor = hasNextPage ? items[items.length - 1].id : null;

      return {
        items,
        nextCursor,
        hasNextPage,
      };
    },
  },

  Mutation: {
    register: async (
      _: unknown,
      args: { input: { name: string; email: string; password: string } },
    ) => {
      const { name, email, password } = args.input;

      //check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });

      if (existingUser) {
        throw new Error("User with this email already exists");
      }
      //hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const roles = await prisma.role.findMany();
      console.log("ROLES FROM PRISMA:", roles);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: hashedPassword,
          role: { connect: { name: "user" } },
        },
      });
      return user;
    },
    login: async (
      _: unknown,
      args: { input: { email: string; password: string } },
    ) => {
      const { email, password } = args.input;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error("Invalid email or password");
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new Error("Invalid email or password");
      }

      const token = jwt.sign(
        { userId: user.id, role: user.roleId },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      return { token, user };
    },
    addToWishlist: async (
      _: unknown,
      { movieId }: { movieId: string },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // 1️⃣ Check movie exists
      const movie = await prisma.movie.findUnique({
        where: { id: movieId },
      });

      if (!movie) {
        throw new GraphQLError("Movie not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // 2️⃣ Prevent duplicate wishlist entry
      const existing = await prisma.wishlist.findUnique({
        where: {
          userId_movieId: {
            userId: user.id,
            movieId,
          },
        },
      });

      if (existing) {
        return true; // idempotent success
      }

      // 3️⃣ Create wishlist entry
      await prisma.wishlist.create({
        data: {
          userId: user.id,
          movieId,
        },
      });

      return true;
    },
    rateMovie: async (
      _: unknown,
      { movieId, value }: { movieId: string; value: number },
      context: Context,
    ) => {
      const user = requireAuth(context);

      // 1️⃣ Validate rating range
      if (value < 1 || value > 5) {
        throw new GraphQLError("Rating must be between 1 and 5", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // 2️⃣ Ensure movie exists
      const movie = await prisma.movie.findUnique({
        where: { id: movieId },
      });

      if (!movie) {
        throw new GraphQLError("Movie not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // 3️⃣ Run atomic transaction
      await prisma.$transaction(async (tx) => {
        const existing = await tx.rating.findUnique({
          where: {
            userId_movieId: {
              userId: user.id,
              movieId,
            },
          },
        });

        // 🆕 New rating
        if (!existing) {
          const newCount = movie.ratingCount + 1;
          const newAverage =
            (movie.averageRating * movie.ratingCount + value) / newCount;

          await tx.rating.create({
            data: {
              userId: user.id,
              movieId,
              value,
            },
          });

          await tx.movie.update({
            where: { id: movieId },
            data: {
              ratingCount: newCount,
              averageRating: newAverage,
            },
          });

          return;
        }

        // 🔄 Update existing rating
        const newAverage =
          (movie.averageRating * movie.ratingCount - existing.value + value) /
          movie.ratingCount;

        await tx.rating.update({
          where: {
            userId_movieId: {
              userId: user.id,
              movieId,
            },
          },
          data: { value },
        });

        await tx.movie.update({
          where: { id: movieId },
          data: { averageRating: newAverage },
        });
      });

      return true;
    },
    createOrUpdateReview: async (
      _: unknown,
      { movieId, content, isSpoiler }: CreateOrUpdateReviewArgs,
      context: Context,
    ): Promise<boolean> => {
      const user = requireAuth(context);

      // 1️⃣ Validate text
      const trimmed = content.trim();

      if (trimmed.length < 3) {
        throw new GraphQLError("Review too short", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      if (trimmed.length > 2000) {
        throw new GraphQLError("Review too long", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // 2️⃣ Ensure movie exists
      const movie = await prisma.movie.findUnique({
        where: { id: movieId },
        select: { id: true },
      });

      if (!movie) {
        throw new GraphQLError("Movie not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // 3️⃣ Upsert review (atomic & clean)
      await prisma.review.upsert({
        where: {
          userId_movieId: {
            userId: user.id,
            movieId,
          },
        },
        update: {
          content: trimmed,
          isSpoiler: isSpoiler ?? false,
        },
        create: {
          userId: user.id,
          movieId,
          content: trimmed,
          isSpoiler: isSpoiler ?? false,
        },
      });

      return true;
    },
  },

  ReviewItem: {
    user: async (
      parent: { userId: string },
      _: unknown,
      context: Context,
    ) => {
      const user = await context.loaders.userLoader.load(parent.userId);

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return user;
    },
  },
};
