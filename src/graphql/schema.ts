import { gql } from "graphql-tag";

export const typeDefs = gql`
  type Movie {
    id: String!
    tmdbId: Int!
    title: String!
    description: String
    releaseDate: String
    posterUrl: String
    backdropUrl: String
    popularity: Float
  }

  type User {
    id: String!
    name: String!
    email: String!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
  }

  type Query {
    movies(page: Int!, limit: Int!): [Movie!]!
    movie(id: String!): Movie
    reviewsByMovie(
      movieId: String!
      cursor: String
      limit: Int = 10
    ): ReviewConnection!
  }

  type Mutation {
    register(input: RegisterInput!): User!
    login(input: LoginInput!): AuthPayload!
    addToWishlist(movieId: String!): Boolean!
    rateMovie(movieId: String!, value: Int!): Boolean!
    createOrUpdateReview(
      movieId: String!
      content: String!
      isSpoiler: Boolean
    ): Boolean!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type ReviewItem {
    id: ID!
    content: String!
    isSpoiler: Boolean!
    createdAt: String!
    updatedAt: String!
    user: ReviewUser!
  }

  type ReviewUser {
    id: ID!
    name: String!
    avatarUrl: String
  }

  type ReviewConnection {
    items: [ReviewItem!]!
    nextCursor: String
    hasNextPage: Boolean!
  }

`;
