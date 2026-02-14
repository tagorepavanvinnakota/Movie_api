import axios from "axios";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  popularity: number;
}

export const getPopularMovies = async (): Promise<TMDBMovie[]> => {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new Error("TMDB_API_KEY missing in environment variables");
  }

  const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
    params: {
      api_key: apiKey,
      language: "en-US",
      page: 1,
    },
  });

  return response.data.results;
};
