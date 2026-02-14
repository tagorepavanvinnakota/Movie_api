-- CreateIndex

CREATE INDEX CONCURRENTLY "Review_movieId_createdAt_idx"
ON "Review" ("movieId", "createdAt" DESC);
