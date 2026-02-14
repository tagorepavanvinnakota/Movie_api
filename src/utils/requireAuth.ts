import { GraphQLError } from "graphql";
import { Context } from "../server";

export function requireAuth(context: Context) {
  if (!context.currentUser) {
    throw new GraphQLError("Unauthenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  return context.currentUser;
}
