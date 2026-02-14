import "dotenv/config";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./graphql/schema";
import { resolvers } from "./graphql/resolvers";
import { prisma } from "./config/db-adapter";
import { verifyToken } from "./utils/auth";
import { createUserLoader } from "./loaders/userLoader";

// -------- Context Type --------
export interface Context {
  currentUser: {
    id: string;
    role: string;
  } | null;
  loaders: {
    userLoader: ReturnType<typeof createUserLoader>;
  };
}

// -------- Context Middleware --------
const context = async ({ req }: { req: any }): Promise<Context> => {
  const authHeader = req.headers.authorization;

  let currentUser: Context["currentUser"] = null;

  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");

    try {
      const payload = verifyToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          role: { select: { name: true } },
        },
      });

      if (user) {
        currentUser = {
          id: user.id,
          role: user.role.name,
        };
      }
    } catch {
     
    }
  }

  return {
    currentUser,
    loaders: {
      userLoader: createUserLoader(),
    },
  };
};

async function startServer() {
  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
  });

  const { url } = await startStandaloneServer(server, {
    context,
    listen: { port: 2000 },
  });

  console.log(`🚀 GraphQL server ready at ${url}`);
}

startServer();