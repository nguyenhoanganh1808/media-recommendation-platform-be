# 📌 Media Tracking and Recommendation System

<!-- [![Build Status](https://img.shields.io/github/workflow/status/nguyenhoanganh1808/media-recommendation-platform-be/CI)](https://github.com/hoanganhng/media-tracking) -->
<!-- [![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) -->

[![Node.js](https://img.shields.io/badge/Node.js-v18.x-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15.x-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-v5.x-purple.svg)](https://www.prisma.io/)

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [API Documentation](#api-documentation)
<!-- - [Contributing](#contributing) -->
- [License](#license)
- [Contact](#contact)

## Project Overview

The Media Tracking and Recommendation System is a comprehensive platform designed to enhance user experience in discovering, tracking, and discussing various forms of media. The system supports Movies, Games, and Manga, providing users with powerful tools to manage their media consumption and discover new content.

Users can:

- Discover, rate, and review media across different categories
- Create and manage personalized media lists (e.g., "Watch Later", "Favorites")
- Follow other users and receive activity notifications
- Get personalized recommendations based on their preferences
- Access rich content through integrations with TMDB, IGDB, and MyAnimeList
- Authenticate securely using JWT and refresh tokens

The backend infrastructure provides a robust and scalable API to support these features while maintaining high performance and security standards.

## Features

### User Management

- **Secure Authentication:** Email/password login with JWT tokens
- **Role-Based Access Control:** Different permission levels for users, moderators, and administrators
- **Profile Customization:** Customizable user profiles with avatars, bios, and preferences
- **Social Connections:** Follow/unfollow system with user activity feeds

### Media Management

- **Multi-Media Support:** Comprehensive management of Movies, Games, and Manga
- **Type-Specific Attributes:** Media-specific details (e.g., runtime for movies, platforms for games)
- **Search and Discovery:** Advanced filtering and search capabilities
- **Media Details:** Comprehensive information including synopsis, release dates, and creators

### Ratings and Reviews

- **Media Rating:** 10-star rating system with half-star precision
- **Review System:** Detailed text reviews with formatting options
<!-- - **Social Interaction:** Like and comment on reviews -->
- **Visibility Settings:** Public, private, and followers-only review visibility

### Media Lists

- **Custom Lists:** Create and manage personalized media lists
- **List Customization:** Custom ordering, notes, and privacy settings
- **List Sharing:** Share lists with followers or publicly
- **Status Tracking:** Track consumption status (e.g., "Watching", "Completed")

### Personalized Recommendations

- **Preference-Based:** Recommendations based on user genre preferences
- **Rating-Based:** Suggestions from similarly rated content
- **Social-Based:** Recommendations from followed users' highly-rated media
- **Popularity:** Trending and popular content discovery

### Social Features

- **Activity Feed:** View followed users' recent activities
- **Notifications:** Receive alerts for follows, likes, and comments
<!-- - **User Discovery:** Find users with similar tastes -->
- **Social Sharing:** Share ratings and reviews with followers

### External API Integrations

- **TMDB:** Rich movie and TV show data
- **IGDB:** Comprehensive video game information
- **MyAnimeList:** Detailed manga and anime data
- **Data Synchronization:** Regular updates from external sources

### Authentication and Security

- **JWT Authentication:** Secure token-based authentication
- **Refresh Token Mechanism:** Secure session management
- **Role-Based Permissions:** Fine-grained access control
- **Rate Limiting:** Protection against abuse and DDoS attacks

## Technology Stack

### Backend Development

- **Runtime:** Node.js
- **Framework:** Express.js
- **API Documentation:** Swagger/OpenAPI

### Database and Data Management

- **Primary Database:** PostgreSQL
- **ORM:** Prisma
- **Caching:** Redis
<!-- - **Search:** PostgreSQL Full-Text Search -->

### Infrastructure and Deployment

- **Cloud Provider:** AWS
- **Compute:** EC2
- **Database Service:** RDS
<!-- - **Object Storage:** S3 (for media assets) -->

### DevOps and CI/CD

- **Containerization:** Docker
- **CI/CD:** GitHub Actions
- **Reverse Proxy:** Nginx
<!-- - **Monitoring:** Prometheus and Grafana -->

### Security

- **Authentication:** JWT
- **Password Hashing:** bcrypt
- **HTTPS:** Let's Encrypt SSL certificates

## Installation & Setup

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v15 or later)
- Redis (v6 or later)
- Docker and Docker Compose (optional, for containerized setup)
- API keys for TMDB, IGDB, and MyAnimeList

### Basic Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/hoanganhng/media-tracking.git
   cd media-tracking
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

4. Configure the `.env` file with your specific settings:
   ```
   # Node Environment
   NODE_ENV=development
   SERVER_URL=http://localhost:3000
   ```

# Server Configuration

PORT=3000
HTTPS_PORT=3443
API_PREFIX=/api
CORS_ORIGIN=http://localhost:3000,http://localhost:8080

# Database Configuration

DATABASE_URL=postgresql://username:password@localhost:5432/media_tracking

# Redis Configuration

REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# JWT Configuration

JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging

LOG_LEVEL=info

# Media API Keys for External Services

TMDB_API_KEY=your_tmdb_api_key
RAWG_API_KEY=your_rawg_api_key

# Email Configuration (for notifications)

EMAIL_FROM=noreply@mediatracksystem.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password

# File Upload Configuration

UPLOAD_DIRECTORY=uploads
MAX_FILE_SIZE=5000000

# Recommendation Engine Configuration

RECOMMENDATION*BATCH_SIZE=100
RECOMMENDATION_UPDATE_INTERVAL=0 */6 \_ \* \*

# Timezone

TZ=UTC

````

5. Initialize the database:
```bash
npx prisma migrate dev
npx prisma generate
````

6. Seed the database with initial data (optional):
   ```bash
   pnpm db:seed
   ```

### Docker Setup

1. Make sure Docker and Docker Compose are installed on your system.

2. Build and start the containers:

   ```bash
   docker-compose up -d
   ```

3. The application will be accessible at `http://localhost:3000`.

### Nginx Configuration (Production)

For production deployments, configure Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Usage

### Running the Application

#### Development Mode

```bash
pnpm dev
```

The server will run on `http://localhost:3000` (or the port specified in your .env file) with hot reloading enabled.

#### Production Mode

```bash
pnpm build
pnpm start
```

### Important Scripts

- `pnpm dev`: Start the development server with hot reloading
- `pnpm build`: Build the application for production
- `pnpm start`: Start the production server
- `pnpm test`: Run tests
- `pnpm lint`: Check for linting issues
- `pnpm db:seed`: Seed the database with initial data
- `pnpm prisma:migrate`: Run database migrations

## API Documentation

Once the application is running, you can access the Swagger API documentation at:

```
http://localhost:3000/api/docs
```

This provides a comprehensive interface for exploring and testing all available API endpoints.

<!-- ## Contributing

We welcome contributions to the Media Tracking and Recommendation System! Please follow these steps to contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure everything works (`npm test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request -->

### Contribution Guidelines

- Follow the existing code style and conventions
- Write and update tests for new features
- Update documentation as needed
- Make sure all tests pass before submitting pull requests
- Reference relevant issues in pull requests and commits

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

**Nguyen Hoang Anh**

- GitHub: [nguyenhoanganh1808](https://github.com/nguyenhoanganh1808)
- Email: nguyenhoanganh.it2003@gmail.com
- LinkedIn: [Nguyen Hoang Anh](https://www.linkedin.com/in/anhnh23/)

---

© 2025 Media Tracking and Recommendation System
