import {
  PrismaClient,
  MediaType,
  MediaStatus,
  Role,
  NotificationType,
  $Enums,
} from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import axios from "axios";
import { config } from "../src/config/env";

const prisma = new PrismaClient();

// Configuration for external APIs (you'll need to provide your own API keys)
const TMDB_API_KEY = config.TMDB_API_KEY;
const RAWG_API_KEY = config.RAWG_API_KEY;
const MANGA_API_URL = "https://api.jikan.moe/v4";
// Utility function to add a delay (for rate limiting)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Main seeding function
async function main() {
  console.log("Start seeding...");

  // Clear existing data
  await clearDatabase();

  // Create basic data
  const genres = await seedGenres();
  const platforms = await seedPlatforms();
  const users = await seedUsers();

  // Create media entries
  const movies = await fetchAndCreateMovies();
  const games = await fetchAndCreateGames();
  const manga = await fetchAndCreateManga();
  const allMedia = [...movies, ...games];

  // Create relationships
  await createUserRelationships(users);
  await createMediaRatingsAndReviews(users, allMedia);
  await createMediaLists(users, allMedia);
  await createUserPreferences(users);
  await createNotifications(users);

  // Update calculated fields
  await updateMediaRatings(allMedia);

  console.log("Seeding finished successfully!");
}

// Clear the database before seeding
async function clearDatabase() {
  const tablesToClear = [
    "refresh_tokens",
    "notifications",
    "follows",
    "media_list_items",
    "media_lists",
    "user_preferences",
    "media_reviews",
    "media_ratings",
    "genre_on_media",
    "external_media_ids",
    "media",
    "platforms",
    "genres",
    "users",
  ];

  for (const table of tablesToClear) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }

  console.log("Database cleared successfully");
}

// Seed genres for all media types
async function seedGenres() {
  const genreData = [
    // Movie genres
    { name: "Action", description: "Exciting action sequences" },
    {
      name: "Adventure",
      description:
        "Exciting stories, often with new experiences or exotic locales",
    },
    {
      name: "Animation",
      description:
        "Films made with animated illustrations, clay, or computer graphics",
    },
    { name: "Comedy", description: "Light-hearted and humorous content" },
    {
      name: "Drama",
      description: "Character development and emotional themes",
    },
    { name: "Fantasy", description: "Imaginative and magical elements" },
    {
      name: "Horror",
      description: "Intended to frighten and scare the audience",
    },
    { name: "Romance", description: "Focus on romantic relationships" },
    {
      name: "Sci-Fi",
      description: "Scientific and technological themes and advancements",
    },
    { name: "Thriller", description: "Suspenseful and exciting content" },

    // Game genres
    { name: "FPS", description: "First-person shooter games" },
    {
      name: "RPG",
      description: "Role-playing games with character development",
    },
    { name: "Strategy", description: "Games that require careful planning" },
    {
      name: "Simulation",
      description: "Games that simulate real-world activities",
    },
    { name: "Sports", description: "Games based on sports" },
    { name: "Puzzle", description: "Games that require problem-solving" },
    {
      name: "Open World",
      description: "Games with large explore environments",
    },
    {
      name: "MMORPG",
      description: "Massively multiplayer online role-playing games",
    },

    // Manga genres
    { name: "Shonen", description: "Targeted towards teenage boys" },
    { name: "Shojo", description: "Targeted towards teenage girls" },
    { name: "Seinen", description: "Targeted towards adult men" },
    { name: "Josei", description: "Targeted towards adult women" },
    { name: "Isekai", description: "Character transported to another world" },
    {
      name: "Mecha",
      description: "Featuring robots and mechanical technology",
    },
    { name: "Slice of Life", description: "Portraying everyday experiences" },
  ];

  const genres = await Promise.all(
    genreData.map((genre) => prisma.genre.create({ data: genre })),
  );

  console.log(`Created ${genres.length} genres`);
  return genres;
}

// Seed gaming platforms
async function seedPlatforms() {
  const platformData = [
    { name: "PC" },
    { name: "PlayStation 5" },
    { name: "PlayStation 4" },
    { name: "Xbox Series X/S" },
    { name: "Xbox One" },
    { name: "Nintendo Switch" },
    { name: "iOS" },
    { name: "Android" },
  ];

  const platforms = await Promise.all(
    platformData.map((platform) =>
      prisma.platform.create({
        data: platform,
      }),
    ),
  );

  console.log(`Created ${platforms.length} platforms`);
  return platforms;
}

// Seed users
async function seedUsers() {
  const userData = [
    {
      email: "admin@example.com",
      username: "admin",
      password: await hashPassword("adminPassword123"),
      firstName: "Admin",
      lastName: "User",
      bio: "System administrator",
      role: Role.ADMIN,
      isActive: true,
    },
    {
      email: "moderator@example.com",
      username: "moderator",
      password: await hashPassword("moderatorPassword123"),
      firstName: "Mod",
      lastName: "User",
      bio: "Content moderator",
      role: Role.MODERATOR,
      isActive: true,
    },
    {
      email: "user@example.com",
      username: "user",
      password: await hashPassword("userPassword123"),
      firstName: "Zodd",
      lastName: "...",
      bio: "Rengular user",
      role: Role.USER,
      isActive: true,
    },
  ];

  // Create regular users
  for (let i = 1; i <= 10; i++) {
    userData.push({
      email: `user${i}@example.com`,
      username: `user${i}`,
      password: await hashPassword("userPassword123"),
      firstName: `User${i}`,
      lastName: `Sample`,
      bio: `Regular user account ${i}`,
      role: Role.USER,
      isActive: true,
    });
  }

  const users = await Promise.all(
    userData.map((user) =>
      prisma.user.create({
        data: user,
      }),
    ),
  );

  console.log(`Created ${users.length} users`);
  return users;
}

// Fetch and create movie data from TMDB API
async function fetchAndCreateMovies(pageCount = 5) {
  if (!TMDB_API_KEY) {
    console.warn("TMDB_API_KEY not found, using fallback movie data");
    return createFallbackMovies();
  }

  try {
    let allMovies: any = [];
    for (let page = 1; page <= pageCount; page++) {
      const response = await axios.get(
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`,
      );
      const movieData: any[] = response.data.results;

      const movies = await Promise.all(
        movieData.map(async (movie) => {
          try {
            // Get detailed movie info
            const detailsResponse = await axios.get(
              `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=en-US`,
            );
            const movieDetails = detailsResponse.data;

            // Get credits for director
            const creditsResponse = await axios.get(
              `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}`,
            );
            const directors = creditsResponse.data.crew.filter(
              (person: any) => person.job === "Director",
            );
            const director = directors.length > 0 ? directors[0].name : null;

            // Create the movie in the database
            return await prisma.media.create({
              data: {
                title: movieDetails.title,
                originalTitle: movieDetails.original_title,
                description: movieDetails.overview,
                releaseDate: new Date(movieDetails.release_date),
                mediaType: MediaType.MOVIE,
                status: MediaStatus.RELEASED,
                coverImage: movieDetails.poster_path
                  ? `https://image.tmdb.org/t/p/w500${movieDetails.poster_path}`
                  : null,
                backdropImage: movieDetails.backdrop_path
                  ? `https://image.tmdb.org/t/p/original${movieDetails.backdrop_path}`
                  : null,
                popularity: movieDetails.popularity,
                averageRating: movieDetails.vote_average,
                ratingsCount: movieDetails.vote_count,
                duration: movieDetails.runtime,
                director: director,
                externalIds: {
                  create: {
                    source: "TMDB",
                    externalId: String(movieDetails.id),
                  },
                },
                genres: {
                  create: movieDetails.genres.map((genre: any) => ({
                    genre: {
                      connectOrCreate: {
                        where: { name: genre.name },
                        create: {
                          name: genre.name,
                          description: `TMDB Genre: ${genre.name}`,
                        },
                      },
                    },
                  })),
                },
              },
            });
          } catch (error: any) {
            console.error(
              `Failed to process movie ${movie.id}:`,
              error.message,
            );
            return null; // Skip the movie if an error occurs
          }
        }),
      );

      console.log(`Created ${movies.length} movies from TMDB`);
      allMovies = [...allMovies, ...movies];
    }
    return allMovies; // Return all movies created from TMDB
  } catch (error) {
    console.error("Error fetching movies from TMDB:", error);
    return createFallbackMovies();
  }
}

// Create fallback movie data if API access fails
async function createFallbackMovies() {
  const movieData = [
    {
      title: "The Shawshank Redemption",
      description:
        "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
      releaseDate: new Date("1994-09-23"),
      director: "Frank Darabont",
      duration: 142,
      genres: ["Drama"],
    },
    {
      title: "The Godfather",
      description:
        "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
      releaseDate: new Date("1972-03-24"),
      director: "Francis Ford Coppola",
      duration: 175,
      genres: ["Crime", "Drama"],
    },
    {
      title: "Inception",
      description:
        "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
      releaseDate: new Date("2010-07-16"),
      director: "Christopher Nolan",
      duration: 148,
      genres: ["Action", "Sci-Fi", "Thriller"],
    },
    {
      title: "Pulp Fiction",
      description:
        "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
      releaseDate: new Date("1994-10-14"),
      director: "Quentin Tarantino",
      duration: 154,
      genres: ["Crime", "Drama"],
    },
    {
      title: "The Dark Knight",
      description:
        "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
      releaseDate: new Date("2008-07-18"),
      director: "Christopher Nolan",
      duration: 152,
      genres: ["Action", "Crime", "Drama"],
    },
  ];

  const movies = await Promise.all(
    movieData.map(async (movie) => {
      const { genres, ...movieWithoutGenres } = movie;
      return await prisma.media.create({
        data: {
          ...movieWithoutGenres,
          mediaType: MediaType.MOVIE,
          status: MediaStatus.RELEASED,
          popularity: Math.random() * 100,
          averageRating: Math.random() * 5 + 5, // Rating between 5-10
          ratingsCount: Math.floor(Math.random() * 10000),
          genres: {
            create: genres.map((genreName) => ({
              genre: {
                connectOrCreate: {
                  where: { name: genreName },
                  create: { name: genreName },
                },
              },
            })),
          },
        },
      });
    }),
  );

  console.log(`Created ${movies.length} fallback movies`);
  return movies;
}

// // Fetch and create game data from IGDB API
// async function fetchAndCreateGames() {
//   if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
//     console.warn("IGDB API credentials not found, using fallback game data");
//     return createFallbackGames();
//   }

//   try {
//     // Get access token from Twitch (IGDB owner)
//     const tokenResponse = await axios.post(
//       `https://id.twitch.tv/oauth2/token?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`
//     );
//     const accessToken = tokenResponse.data.access_token;

//     // Query IGDB for popular games
//     const response = await axios.post(
//       "https://api.igdb.com/v4/games",
//       "fields name,summary,first_release_date,rating,rating_count,cover.url,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,platforms.name,genres.name,status; limit 10; sort rating desc; where rating != null & platforms != null & cover != null;",
//       {
//         headers: {
//           "Client-ID": IGDB_CLIENT_ID,
//           Authorization: `Bearer ${accessToken}`,
//         },
//       }
//     );

//     const gameData = response.data;
//     const games = await Promise.all(
//       gameData.map(async (game: any) => {
//         try {
//           // Find developer and publisher
//           const developer =
//             game.involved_companies?.find((company: any) => company.developer)
//               ?.company.name || null;
//           const publisher =
//             game.involved_companies?.find((company: any) => company.publisher)
//               ?.company.name || null;

//           // Get platforms
//           const platformNames =
//             game.platforms?.map((platform: any) => platform.name) || [];

//           // Get status
//           let gameStatus: MediaStatus = MediaStatus.RELEASED;
//           if (game.status === 0) gameStatus = MediaStatus.UPCOMING;
//           if (game.status === 4) gameStatus = MediaStatus.DISCONTINUED;

//           // Create the game in the database
//           return await prisma.media.create({
//             data: {
//               title: game.name,
//               description: game.summary || null,
//               releaseDate: game.first_release_date
//                 ? new Date(game.first_release_date * 1000)
//                 : null,
//               mediaType: MediaType.GAME,
//               status: gameStatus,
//               coverImage: game.cover?.url
//                 ? game.cover.url.replace("t_thumb", "t_cover_big")
//                 : null,
//               popularity: game.rating_count || 0,
//               averageRating: game.rating ? game.rating / 10 : 5, // IGDB uses 0-100 scale
//               ratingsCount: game.rating_count || 0,
//               developer: developer,
//               publisher: publisher,
//               externalIds: {
//                 create: {
//                   source: "IGDB",
//                   externalId: String(game.id),
//                 },
//               },
//               genres: {
//                 create:
//                   game.genres?.map((genre: any) => ({
//                     genre: {
//                       connectOrCreate: {
//                         where: { name: genre.name },
//                         create: {
//                           name: genre.name,
//                           description: `IGDB Genre: ${genre.name}`,
//                         },
//                       },
//                     },
//                   })) || [],
//               },
//               platforms: {
//                 connectOrCreate: platformNames.map((name: any) => ({
//                   where: { name },
//                   create: { name },
//                 })),
//               },
//             },
//           });
//         } catch (error: any) {
//           console.error(`Failed to process game ${game.id}:`, error.message);
//           return null; // Skip this game if an error occurs
//         }
//       })
//     );

//     console.log(`Created ${games.length} games from IGDB`);
//     return games;
//   } catch (error) {
//     console.error("Error fetching games from IGDB:", error);
//     return createFallbackGames();
//   }
// }
// Fetch and create game data from RAWG API
async function fetchAndCreateGames(pageCount = 5) {
  if (!RAWG_API_KEY) {
    console.warn("RAWG_API_KEY not found, using fallback game data");
    return createFallbackGames();
  }

  try {
    let allGames: any = [];

    // RAWG returns 20 games per page by default
    for (let page = 1; page <= pageCount; page++) {
      console.log(`Fetching RAWG games page ${page} of ${pageCount}...`);

      // Get games from RAWG - sorted by rating
      const response = await axios.get(
        `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&page=${page}&page_size=40&ordering=-rating`,
      );

      const gameData = response.data.results;

      // Process each game in this page
      const games = await Promise.all(
        gameData.map(async (game: any) => {
          try {
            // Get detailed game info for additional data
            const detailsResponse = await axios.get(
              `https://api.rawg.io/api/games/${game.id}?key=${RAWG_API_KEY}`,
            );
            const gameDetails = detailsResponse.data;

            // Determine game status
            let gameStatus: MediaStatus = MediaStatus.RELEASED;
            if (new Date(gameDetails.released) > new Date()) {
              gameStatus = MediaStatus.UPCOMING;
            }

            // Find developer and publisher
            const developer =
              gameDetails.developers && gameDetails.developers.length > 0
                ? gameDetails.developers[0].name
                : null;

            const publisher =
              gameDetails.publishers && gameDetails.publishers.length > 0
                ? gameDetails.publishers[0].name
                : null;

            // Create the game in the database
            return await prisma.media.create({
              data: {
                title: gameDetails.name,
                description:
                  gameDetails.description_raw ||
                  gameDetails.description ||
                  null,
                releaseDate: gameDetails.released
                  ? new Date(gameDetails.released)
                  : null,
                mediaType: MediaType.GAME,
                status: gameStatus,
                coverImage: gameDetails.background_image || null,
                backdropImage: gameDetails.background_image_additional || null,
                popularity: gameDetails.ratings_count || 0,
                averageRating: gameDetails.rating || 0,
                ratingsCount: gameDetails.ratings_count || 0,
                duration: null, // RAWG doesn't provide playtime info in base response
                developer: developer,
                publisher: publisher,
                externalIds: {
                  create: {
                    source: "RAWG",
                    externalId: String(gameDetails.id),
                  },
                },
                genres: {
                  create:
                    gameDetails.genres?.map((genre: any) => ({
                      genre: {
                        connectOrCreate: {
                          where: { name: genre.name },
                          create: {
                            name: genre.name,
                            description: `RAWG Genre: ${genre.name}`,
                          },
                        },
                      },
                    })) || [],
                },
                platforms: {
                  connectOrCreate:
                    gameDetails.platforms?.map((platform: any) => ({
                      where: { name: platform.platform.name },
                      create: { name: platform.platform.name },
                    })) || [],
                },
              },
            });
          } catch (error: any) {
            console.error(`Failed to process game ${game.id}:`, error.message);
            return null; // Skip this game if an error occurs
          }
        }),
      );

      // Filter out null results (failed game creations)
      const validGames = games.filter((game) => game !== null);
      console.log(
        `Created ${validGames.length} games from RAWG (page ${page})`,
      );

      allGames = [...allGames, ...validGames];

      // Add a small delay to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`Total games created from RAWG: ${allGames.length}`);
    return allGames;
  } catch (error) {
    console.error("Error fetching games from RAWG:", error);
    return createFallbackGames();
  }
}

// Create fallback game data if API access fails
async function createFallbackGames() {
  const gameData = [
    {
      title: "The Legend of Zelda: Breath of the Wild",
      description:
        "An action-adventure game set in an open world where players control Link who awakens from a hundred-year slumber to defeat Calamity Ganon.",
      releaseDate: new Date("2017-03-03"),
      developer: "Nintendo",
      publisher: "Nintendo",
      genres: ["Action", "Adventure", "RPG", "Open World"],
      platforms: ["Nintendo Switch"],
    },
    {
      title: "Red Dead Redemption 2",
      description:
        "A western-themed action-adventure game set in an open world environment featuring a fictionalized take on the Western, Midwestern, and Southern United States in 1899.",
      releaseDate: new Date("2018-10-26"),
      developer: "Rockstar Games",
      publisher: "Rockstar Games",
      genres: ["Action", "Adventure", "Open World"],
      platforms: ["PlayStation 4", "Xbox One", "PC"],
    },
    {
      title: "The Witcher 3: Wild Hunt",
      description:
        "An action role-playing game where you play as Geralt of Rivia, a monster hunter tasked with finding a child of prophecy in a vast open world.",
      releaseDate: new Date("2015-05-19"),
      developer: "CD Projekt Red",
      publisher: "CD Projekt",
      genres: ["RPG", "Action", "Open World"],
      platforms: ["PC", "PlayStation 4", "Xbox One", "Nintendo Switch"],
    },
    {
      title: "Minecraft",
      description:
        "A sandbox video game that allows players to build and explore virtual worlds made up of blocks.",
      releaseDate: new Date("2011-11-18"),
      developer: "Mojang",
      publisher: "Mojang Studios",
      genres: ["Sandbox", "Simulation"],
      platforms: [
        "PC",
        "PlayStation 4",
        "Xbox One",
        "Nintendo Switch",
        "iOS",
        "Android",
      ],
    },
    {
      title: "Elden Ring",
      description:
        "An action role-playing game developed by FromSoftware and written by George R. R. Martin. Set in the realm of the Lands Between.",
      releaseDate: new Date("2022-02-25"),
      developer: "FromSoftware",
      publisher: "Bandai Namco Entertainment",
      genres: ["Action", "RPG", "Open World"],
      platforms: [
        "PC",
        "PlayStation 5",
        "PlayStation 4",
        "Xbox Series X/S",
        "Xbox One",
      ],
    },
  ];

  const games = await Promise.all(
    gameData.map(async (game) => {
      const { genres = [], platforms = [], ...gameWithoutRelations } = game;

      return prisma.media.create({
        data: {
          ...gameWithoutRelations,
          mediaType: MediaType.GAME,
          status: MediaStatus.RELEASED,
          popularity: Math.random() * 100,
          averageRating: Math.random() * 5 + 5, // Rating between 5-10
          ratingsCount: Math.floor(Math.random() * 10000),
          genres: {
            create: genres.map((genreName) => ({
              genre: {
                connectOrCreate: {
                  where: { name: genreName },
                  create: {
                    name: genreName,
                    description: `IGDB Genre: ${genreName}`,
                  },
                },
              },
            })),
          },
          platforms: {
            connectOrCreate: platforms.map((platformName) => ({
              where: { name: platformName },
              create: { name: platformName },
            })),
          },
        },
      });
    }),
  );

  console.log(`Created ${games.length} games`);

  console.log(`Created ${games.length} fallback games`);
  return games;
}

async function fetchAndCreateManga() {
  try {
    // Calculate number of pages needed (200 manga, 25 per page = 8 pages)
    const mangaPerPage = 25;
    const totalManga = 200;
    const totalPages = Math.ceil(totalManga / mangaPerPage);
    let allMangaData: any[] = [];

    // Fetch manga across multiple pages
    for (let page = 1; page <= totalPages; page++) {
      console.log(`Fetching page ${page} of ${totalPages}...`);
      const response = await axios.get(
        `${MANGA_API_URL}/top/manga?limit=${mangaPerPage}&page=${page}`,
      );
      allMangaData = [...allMangaData, ...response.data.data];

      // Add a 500ms delay to respect Jikan's rate limits (adjust as needed)
      if (page < totalPages) {
        await delay(500);
      }
    }

    // Limit to exactly 200 manga
    allMangaData = allMangaData.slice(0, totalManga);

    // Extract all unique genres from the manga data
    const allGenres = [
      ...new Set(
        allMangaData.flatMap((manga: any) =>
          manga.genres.map((g: any) => g.name),
        ),
      ),
    ];

    // Batch upsert genres
    await Promise.all(
      allGenres.map((genreName) =>
        prisma.genre.upsert({
          where: { name: genreName },
          update: {}, // No updates needed if genre exists
          create: {
            name: genreName,
            description: `MyAnimeList Genre: ${genreName}`,
          },
        }),
      ),
    );
    console.log(`Upserted ${allGenres.length} unique genres`);

    // Create manga records
    const mangas = await Promise.all(
      allMangaData.map(
        async (manga: {
          title: any;
          title_japanese: any;
          synopsis: any;
          published: { from: string | number | Date };
          status: string;
          images: { jpg: { large_image_url: any } };
          scored_by: any;
          score: any;
          authors: any[];
          volumes: any;
          mal_id: any;
          genres: any[];
        }) => {
          try {
            return await prisma.media.create({
              data: {
                title: manga.title,
                originalTitle: manga.title_japanese,
                description: manga.synopsis,
                releaseDate: manga.published?.from
                  ? new Date(manga.published.from)
                  : null,
                mediaType: MediaType.MANGA,
                status:
                  manga.status === "Finished" || manga.status === "Publishing"
                    ? MediaStatus.RELEASED
                    : MediaStatus.UPCOMING,
                coverImage: manga.images?.jpg?.large_image_url || null,
                popularity: manga.scored_by || 0,
                averageRating: manga.score || 5,
                ratingsCount: manga.scored_by || 0,
                author:
                  manga.authors
                    ?.map((author: { name: any }) => author.name)
                    .join(", ") || null,
                artist:
                  manga.authors
                    ?.map((author: { name: any }) => author.name)
                    .join(", ") || null,
                volumeCount: manga.volumes || 0,
                isCompleted: manga.status === "Finished",
                externalIds: {
                  create: {
                    source: "MyAnimeList",
                    externalId: String(manga.mal_id),
                  },
                },
                genres: {
                  create:
                    manga.genres?.map((genre: { name: any }) => ({
                      genre: {
                        connect: { name: genre.name },
                      },
                    })) || [],
                },
              },
            });
          } catch (error) {
            console.error(`Failed to create manga "${manga.title}":`, error);
            return null; // Skip failed entries
          }
        },
      ),
    );

    // Filter out any failed creations
    const successfulMangas = mangas.filter((m) => m !== null);
    console.log(`Created ${successfulMangas.length} manga from Jikan API`);
    return successfulMangas;
  } catch (error) {
    console.error("Error fetching manga from Jikan API:", error);
    return [];
  }
}
// Create fallback manga data if API access fails
async function createFallbackManga() {
  const mangaData = [
    {
      title: "One Piece",
      originalTitle: "ワンピース",
      description:
        "Follows the adventures of Monkey D. Luffy and his pirate crew in order to find the greatest treasure ever left by the legendary Pirate, Gold Roger.",
      releaseDate: new Date("1997-07-22"),
      author: "Eiichiro Oda",
      artist: "Eiichiro Oda",
      volumeCount: 100,
      isCompleted: false,
      genres: ["Action", "Adventure", "Fantasy", "Shonen"],
    },
    {
      title: "Berserk",
      originalTitle: "ベルセルク",
      description:
        "Guts is a skilled swordsman who joins forces with a mercenary group named 'Band of the Hawk', led by the charismatic Griffith.",
      releaseDate: new Date("1989-08-25"),
      author: "Kentaro Miura",
      artist: "Kentaro Miura",
      volumeCount: 41,
      isCompleted: false,
      genres: ["Action", "Adventure", "Drama", "Fantasy", "Horror", "Seinen"],
    },
    {
      title: "Attack on Titan",
      originalTitle: "進撃の巨人",
      description:
        "In a world where humanity lives inside cities surrounded by enormous walls due to the Titans, gigantic humanoid creatures who devour humans seemingly without reason.",
      releaseDate: new Date("2009-09-09"),
      author: "Hajime Isayama",
      artist: "Hajime Isayama",
      volumeCount: 34,
      isCompleted: true,
      genres: ["Action", "Drama", "Fantasy", "Horror", "Shonen"],
    },
    {
      title: "Fullmetal Alchemist",
      originalTitle: "鋼の錬金術師",
      description:
        "Two brothers search for a Philosopher's Stone after an attempt to revive their deceased mother goes wrong and leaves them in damaged physical forms.",
      releaseDate: new Date("2001-07-12"),
      author: "Hiromu Arakawa",
      artist: "Hiromu Arakawa",
      volumeCount: 27,
      isCompleted: true,
      genres: ["Action", "Adventure", "Drama", "Fantasy", "Shonen"],
    },
    {
      title: "Death Note",
      originalTitle: "デスノート",
      description:
        "A high school student discovers a supernatural notebook that grants its user the ability to kill anyone whose name and face they know.",
      releaseDate: new Date("2003-12-01"),
      author: "Tsugumi Ohba",
      artist: "Takeshi Obata",
      volumeCount: 12,
      isCompleted: true,
      genres: [
        "Mystery",
        "Psychological",
        "Supernatural",
        "Thriller",
        "Shonen",
      ],
    },
  ];

  const manga = await Promise.all(
    mangaData.map(async (mangaItem) => {
      const { genres = [], ...mangaWithoutGenres } = mangaItem;

      return prisma.media.create({
        data: {
          ...mangaWithoutGenres,
          mediaType: MediaType.MANGA,
          status: MediaStatus.RELEASED,
          popularity: Math.random() * 100,
          averageRating: Math.random() * 5 + 5, // Rating between 5-10
          ratingsCount: Math.floor(Math.random() * 10000),
          genres: {
            create: genres.map((genreName) => ({
              genre: {
                connectOrCreate: {
                  where: { name: genreName },
                  create: {
                    name: genreName,
                    description: `MyAnimeList Genre: ${genreName}`,
                  },
                },
              },
            })),
          },
        },
      });
    }),
  );

  console.log(`Created ${manga.length} manga entries`);

  console.log(`Created ${manga.length} fallback manga`);
  return manga;
}

// Create relationships between users (followers/following)
async function createUserRelationships(users: string | any[]) {
  const follows: { followerId: any; followingId: any }[] = [];

  // Create random follow relationships
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (i !== j && Math.random() > 0.6) {
        // 40% chance to follow
        follows.push({
          followerId: users[i].id,
          followingId: users[j].id,
        });
      }
    }
  }

  // Create the follow relationships concurrently
  await Promise.all(
    follows.map((follow) => prisma.follow.create({ data: follow })),
  );

  console.log(`Created ${follows.length} follow relationships`);
}

// Create media ratings and reviews
async function createMediaRatingsAndReviews(
  users: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    username: string;
    password: string;
    firstName: string | null;
    lastName: string | null;
    bio: string | null;
    avatar: string | null;
    isActive: boolean;
    role: $Enums.Role;
    lastLogin: Date | null;
  }[],
  allMedia: any[],
) {
  const ratings: { userId: any; mediaId: any; rating: any }[] = [];
  const reviews: {
    userId: any;
    content: any;
    likesCount: any;
    mediaId: any;
  }[] = [];

  // Generate ratings and reviews
  for (const user of users) {
    // Each user rates and reviews some random media
    const mediaToRate = allMedia.filter(() => Math.random() > 0.5);

    for (const media of mediaToRate) {
      // Generate rating
      const rating = Math.floor(Math.random() * 10) + 1; // 1-10 rating

      ratings.push({
        userId: user.id,
        mediaId: media.id,
        rating: rating,
      });

      // 50% chance to also write a review
      if (Math.random() > 0.5) {
        const reviewTemplates = [
          `I ${rating > 5 ? "really enjoyed" : "didn't really like"} this. The ${media.mediaType === MediaType.MOVIE ? "plot" : media.mediaType === MediaType.GAME ? "gameplay" : "story"} was ${rating > 5 ? "engaging" : "lacking"}.`,
          `${rating > 8 ? "Absolutely loved it!" : rating > 5 ? "Pretty good overall." : "Could have been better."} ${rating > 5 ? "Highly recommended." : "Not sure I would recommend this."}`,
          `${rating > 5 ? "One of the best" : "Not the best"} ${media.mediaType.toLowerCase()}s I've experienced. ${rating > 5 ? "Worth checking out!" : "Maybe skip this one."}`,
          `Giving this a ${rating}/10. ${rating > 7 ? "Outstanding!" : rating > 4 ? "Decent." : "Disappointing."}`,
        ];

        const randomReview =
          reviewTemplates[Math.floor(Math.random() * reviewTemplates.length)];

        reviews.push({
          userId: user.id,
          mediaId: media.id,
          content: randomReview,
          likesCount: Math.floor(Math.random() * 50),
        });
      }
    }
  }

  // Create the ratings
  for (const rating of ratings) {
    await prisma.mediaRating.create({
      data: rating,
    });
  }

  // Create the reviews
  for (const review of reviews) {
    await prisma.mediaReview.create({
      data: review,
    });
  }

  console.log(
    `Created ${ratings.length} ratings and ${reviews.length} reviews`,
  );
}

// Create media lists for users
async function createMediaLists(users: any[], allMedia: any[]) {
  const listTemplates = [
    { name: "Favorites", description: "My all-time favorites" },
    { name: "Watch Later", description: "Things I want to check out" },
    { name: "Currently Watching", description: "What I'm into right now" },
    { name: "Completed", description: "What I've finished" },
    { name: "Dropped", description: "Gave up on these" },
  ];

  await Promise.all(
    users.map(async (user: { id: any }) => {
      // Each user gets 1-3 random lists
      const numLists = Math.floor(Math.random() * 3) + 1;
      const selectedTemplates: {}[] = [];

      for (let i = 0; i < numLists; i++) {
        const randomTemplate =
          listTemplates[Math.floor(Math.random() * listTemplates.length)];

        // Avoid duplicate list names for the same user
        if (selectedTemplates.includes(randomTemplate.name)) continue;
        selectedTemplates.push(randomTemplate.name);

        // Create the list
        const list = await prisma.mediaList.create({
          data: {
            userId: user.id,
            name: randomTemplate.name,
            description: randomTemplate.description,
            isPublic: Math.random() > 0.3, // 70% chance to be public
          },
        });

        // Add some random media to the list
        const mediaToAdd = allMedia.filter(() => Math.random() > 0.7); // 30% chance to add each media

        await Promise.all(
          mediaToAdd.map((media: { id: any; title: any }, index: any) =>
            prisma.mediaListItem.create({
              data: {
                listId: list.id,
                mediaId: media.id,
                notes:
                  Math.random() > 0.5 ? `My thoughts on ${media.title}` : null,
                order: index,
              },
            }),
          ),
        );
      }
    }),
  );

  console.log(`Created media lists for ${users.length} users`);
}

// Create user preferences for recommendation system
async function createUserPreferences(users: string | any[]) {
  // Get all genres
  const genres = await prisma.genre.findMany();

  for (const user of users) {
    // Each user gets 3-7 genre preferences
    const numPreferences = Math.floor(Math.random() * 5) + 3;
    const userGenres = [...genres]
      .sort(() => 0.5 - Math.random())
      .slice(0, numPreferences);

    for (const genre of userGenres) {
      await prisma.userPreference.create({
        data: {
          userId: user.id,
          genreId: genre.id,
          mediaTypePreference:
            Object.values(MediaType)[Math.floor(Math.random() * 3)], // Random media type
          preferenceStrength: Math.random() * 0.5 + 0.5, // Random strength between 0.5 and 1.0
        },
      });
    }
  }

  console.log(`Created genre preferences for ${users.length} users`);
}

// Create notifications
async function createNotifications(users: string | any[]) {
  const notificationTemplates = [
    {
      type: NotificationType.NEW_RECOMMENDATION,
      title: "New Recommendations Available",
      message: "We have new recommendations based on your preferences!",
    },
    {
      type: NotificationType.NEW_FOLLOWER,
      title: "New Follower",
      message: "Someone started following you!",
    },
    {
      type: NotificationType.NEW_RATING,
      title: "Rating on Your Review",
      message: "Someone liked your review!",
    },
    {
      type: NotificationType.NEW_REVIEW,
      title: "New Review",
      message: "A media item on your list has a new review!",
    },
    {
      type: NotificationType.LIST_SHARE,
      title: "List Shared With You",
      message: "Someone shared a media list with you!",
    },
    {
      type: NotificationType.SYSTEM_NOTIFICATION,
      title: "Welcome to MediaTracker",
      message: "Thanks for joining! Start tracking your favorite media!",
    },
  ];

  for (const user of users) {
    // Each user gets 2-5 random notifications
    const numNotifications = Math.floor(Math.random() * 4) + 2;

    for (let i = 0; i < numNotifications; i++) {
      const randomTemplate =
        notificationTemplates[
          Math.floor(Math.random() * notificationTemplates.length)
        ];

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: randomTemplate.type,
          title: randomTemplate.title,
          message: randomTemplate.message,
          isRead: Math.random() > 0.5, // 50% chance to be read
          data:
            randomTemplate.type === NotificationType.NEW_FOLLOWER
              ? {
                  followerId:
                    users[Math.floor(Math.random() * users.length)].id,
                }
              : {},
        },
      });
    }
  }

  console.log(`Created notifications for ${users.length} users`);
}

// Update media average ratings
async function updateMediaRatings(allMedia: string | any[]) {
  for (const media of allMedia) {
    // Get all ratings for this media
    const ratings = await prisma.mediaRating.findMany({
      where: {
        mediaId: media.id,
      },
    });

    if (ratings.length > 0) {
      // Calculate average rating
      const totalRating = ratings.reduce((sum, item) => sum + item.rating, 0);
      const averageRating = totalRating / ratings.length;

      // Update the media item
      await prisma.media.update({
        where: {
          id: media.id,
        },
        data: {
          averageRating: averageRating,
          ratingsCount: ratings.length,
        },
      });
    }
  }

  console.log(`Updated average ratings for ${allMedia.length} media items`);
}

// Main function with enhanced execution

// Run the seeding
main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Close the Prisma client
    await prisma.$disconnect();
  });
