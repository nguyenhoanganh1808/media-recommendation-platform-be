import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../src/config/env';
import { logger } from '../src/config/logger';
import express, { Express } from 'express';

// Base server URL from environment variables or default
const BASE_URL = config.SERVER_URL || 'http://localhost:3000';

// Create debug logger
const debug = (message: string, ...args: any[]) => {
  logger.info(`[Swagger Debug] ${message}`, ...args);
};

/**
 * Manually defined OpenAPI schemas for core entities
 */
const manualSchemas = {
  User: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      username: { type: 'string' },
      password: {
        type: 'string',
        description: 'Password (hashed, never returned in responses)',
      },
      role: { type: 'string', enum: ['USER', 'MODERATOR', 'ADMIN'] },
      bio: { type: 'string', nullable: true },
      avatar: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'email', 'username', 'password', 'role'],
  },
  Media: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      description: { type: 'string' },
      releaseDate: { type: 'string', format: 'date' },
      mediaType: { type: 'string', enum: ['MOVIE', 'GAME', 'MANGA'] },
      externalIds: {
        type: 'object',
        properties: {
          tmdb: { type: 'string', nullable: true },
          igdb: { type: 'string', nullable: true },
          mal: { type: 'string', nullable: true },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'title', 'mediaType'],
  },
  Rating: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      mediaId: { type: 'string', format: 'uuid' },
      score: { type: 'integer', minimum: 1, maximum: 10 },
      review: { type: 'string', nullable: true },
      likes: { type: 'integer', default: 0 },
      isPublic: { type: 'boolean', default: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'userId', 'mediaId', 'score'],
  },
  MediaList: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      isPublic: { type: 'boolean', default: true },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            mediaId: { type: 'string', format: 'uuid' },
            notes: { type: 'string', nullable: true },
            order: { type: 'integer' },
          },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'userId', 'name'],
  },
};

/**
 * Manually defined routes to ensure documentation when JSDoc annotations are missing
 */
const manualRoutes = {
  auth: [
    {
      path: '/api/auth/register',
      method: 'post',
      summary: 'Register a new user',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'username', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                username: { type: 'string', minLength: 3 },
                password: { type: 'string', minLength: 8 },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'User registered successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                  token: { type: 'string' },
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationError' },
      },
    },
    {
      path: '/api/auth/login',
      method: 'post',
      summary: 'User login',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                  token: { type: 'string' },
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
      },
    },
    {
      path: '/api/auth/refresh',
      method: 'post',
      summary: 'Refresh access token',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['refreshToken'],
              properties: {
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Token refreshed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
      },
    },
    {
      path: '/api/auth/logout',
      method: 'post',
      summary: 'User logout',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Logout successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Logged out successfully',
                  },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
      },
    },
  ],
  users: [
    {
      path: '/api/users',
      method: 'get',
      summary: 'Get a list of users',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', default: 1 },
          description: 'Page number',
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10 },
          description: 'Number of items per page',
        },
      ],
      responses: {
        200: {
          description: 'List of users',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  users: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/User' },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      pages: { type: 'integer' },
                      page: { type: 'integer' },
                      limit: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
      },
    },
    {
      path: '/api/users/{id}',
      method: 'get',
      summary: 'Get user by ID',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          schema: { type: 'string', format: 'uuid' },
          required: true,
          description: 'User ID',
        },
      ],
      responses: {
        200: {
          description: 'User details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/User' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFoundError' },
      },
    },
  ],
  media: [
    {
      path: '/api/media',
      method: 'get',
      summary: 'Get a list of media',
      parameters: [
        {
          in: 'query',
          name: 'type',
          schema: { type: 'string', enum: ['MOVIE', 'GAME', 'MANGA'] },
          description: 'Media type filter',
        },
        {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', default: 1 },
          description: 'Page number',
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 10 },
          description: 'Number of items per page',
        },
      ],
      responses: {
        200: {
          description: 'List of media',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  media: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Media' },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      pages: { type: 'integer' },
                      page: { type: 'integer' },
                      limit: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ],
};

/**
 * Convert manual route definitions to OpenAPI path objects
 */
function generatePathsFromManualRoutes() {
  const paths: any = {};

  // Process each category of routes
  Object.keys(manualRoutes).forEach((category) => {
    manualRoutes[category as keyof typeof manualRoutes].forEach((route) => {
      const { path, method, ...routeInfo } = route;

      // Initialize path object if it doesn't exist
      if (!paths[path]) {
        paths[path] = {};
      }

      // Add method to path
      paths[path][method] = {
        tags: [category.charAt(0).toUpperCase() + category.slice(1)],
        ...routeInfo,
      };
    });
  });

  return paths;
}

/**
 * Swagger definition options
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Media Tracking and Recommendation API',
      version: '1.0.0',
      description:
        'API for discovering, rating, and getting recommendations for Movies, Games, and Manga',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'API Support',
        email: 'support@mediarecapi.com',
      },
    },
    servers: [
      {
        url: BASE_URL,
        description: 'Development server',
      },
    ],
    components: {
      schemas: manualSchemas,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    example: 'error',
                  },
                  message: {
                    type: 'string',
                    example: 'Unauthorized',
                  },
                },
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    example: 'error',
                  },
                  message: {
                    type: 'string',
                    example: 'Resource not found',
                  },
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    example: 'error',
                  },
                  message: {
                    type: 'string',
                    example: 'Validation error',
                  },
                  errors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: {
                          type: 'string',
                        },
                        message: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Media', description: 'Media endpoints (movies, games, manga)' },
      { name: 'Ratings', description: 'Rating and review endpoints' },
      { name: 'Lists', description: 'Custom media lists endpoints' },
      { name: 'Recommendations', description: 'Recommendation endpoints' },
      { name: 'Notifications', description: 'Notification endpoints' },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: generatePathsFromManualRoutes(),
  },
  // Path to the API docs
  apis: [
    './src/api/**/*.routes.ts',
    './src/api/**/*.controller.ts',
    './src/types/**/*.ts',
  ],
};

/**
 * Generate Swagger documentation and save to file
 * This version ensures documentation is generated even if no JSDoc comments are found
 */
async function generateSwagger() {
  try {
    debug('Starting Swagger documentation generation...');

    // Find and log available files to debug path issues
    debug('Scanning for route files...');
    const routeFiles = glob.sync('./src/api/**/*.routes.ts');
    debug(`Found ${routeFiles.length} route files:`, routeFiles);

    const controllerFiles = glob.sync('./src/api/**/*.controller.ts');
    debug(`Found ${controllerFiles.length} controller files:`, controllerFiles);

    // Generate Swagger specification
    debug('Generating Swagger specification...');
    const swaggerSpec: any = swaggerJsdoc(options);

    // Add statistics to debug output
    const pathCount = Object.keys(swaggerSpec.paths).length;
    const schemaCount = Object.keys(swaggerSpec.components.schemas).length;
    debug(
      `Generated documentation with ${pathCount} paths and ${schemaCount} schemas`
    );

    // Create output directory if it doesn't exist
    const outputDir = path.resolve(process.cwd(), './src/public/docs');
    debug(`Creating output directory: ${outputDir}`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write swagger.json file
    const outputPath = path.join(outputDir, 'swagger.json');
    debug(`Writing Swagger specification to: ${outputPath}`);
    fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2), 'utf8');

    console.log(`Swagger documentation generated: ${outputPath}`);

    // Generate Swagger UI
    generateSwaggerUI(swaggerSpec, outputDir);

    return swaggerSpec;
  } catch (error) {
    console.error('Error generating Swagger documentation:', error);
    process.exit(1);
  }
}

/**
 * Create a basic HTML page that loads Swagger UI
 */
function generateSwaggerUI(swaggerSpec: any, outputDir: string) {
  const htmlPath = path.join(outputDir, 'index.html');
  debug(`Generating Swagger UI at: ${htmlPath}`);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Media Tracking and Recommendation API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "./swagger.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        persistAuthorization: true,
        tagsSorter: 'alpha'
      });
      window.ui = ui;
    };
  </script>
</body>
</html>
  `;

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`Swagger UI generated: ${htmlPath}`);
}

/**
 * Add express routes to serve Swagger documentation
 * This can be imported and used in your app.ts file
 */
export function setupSwaggerRoutes(app: Express) {
  const docsPath = path.resolve(process.cwd(), './src/public/docs');

  // Serve Swagger UI static files
  app.use(
    '/docs',
    (req: any, res: any, next: any) => {
      // Log access for debugging
      console.log(`Swagger docs accessed: ${req.path}`);
      next();
    },
    express.static(docsPath)
  );

  console.log('Swagger routes set up at /docs');
}

/**
 * Main function to execute the Swagger generation process
 */
async function main() {
  console.log('Starting Swagger documentation generation...');

  // Generate the Swagger specification
  await generateSwagger();

  console.log('Swagger documentation generation complete!');
  console.log(
    'You can access the documentation at: http://localhost:3000/docs'
  );
  console.log(
    'Important: Make sure to add the setupSwaggerRoutes function to your app.ts file.'
  );
}

// Execute the main function when script is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { generateSwagger };
