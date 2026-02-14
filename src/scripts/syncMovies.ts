import "dotenv/config";
import { prisma } from "../config/db-adapter";
import { getPopularMovies } from "../services/tmdb.service";

async function syncMovies() {
  console.log("🔄 Starting TMDB sync...");

  const movies = await getPopularMovies();

  for (const movie of movies) {
    // Upsert Movie
    const dbMovie = await prisma.movie.upsert({
      where: { tmdbId: movie.id },
      update: {
        title: movie.title,
        description: movie.overview,
        releaseDate: movie.release_date ? new Date(movie.release_date) : null,
        posterUrl: movie.poster_path,
        backdropUrl: movie.backdrop_path,
        popularity: movie.popularity,
      },
      create: {
        tmdbId: movie.id,
        title: movie.title,
        description: movie.overview,
        releaseDate: movie.release_date ? new Date(movie.release_date) : null,
        posterUrl: movie.poster_path,
        backdropUrl: movie.backdrop_path,
        popularity: movie.popularity,
      },
    });

    // Handle Genres
    for (const genreId of movie.genre_ids) {
      const genre = await prisma.genre.upsert({
        where: { id: genreId },
        update: {},
        create: {
          id: genreId,
          name: `Genre-${genreId}`, // placeholder until genre sync added
        },
      });

      await prisma.movieGenre.upsert({
        where: {
          movieId_genreId: {
            movieId: dbMovie.id,
            genreId: genre.id,
          },
        },
        update: {},
        create: {
          movieId: dbMovie.id,
          genreId: genre.id,
        },
      });
    }
  }

  console.log("✅ TMDB sync completed");
}

syncMovies()
  .catch((err) => {
    console.error("❌ Sync failed:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });