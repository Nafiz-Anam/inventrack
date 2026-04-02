const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

/* global console, process */
// Simple auto-generator that reads route files and validation schemas
async function generateSimpleOpenAPISpec() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  const openAPISpec = {
    openapi: '3.0.0',
    info: {
      title: `${packageJson.name} API Documentation`,
      version: packageJson.version,
      description:
        packageJson.description || 'RESTful API with Node.js, TypeScript, Express, and Prisma',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:8000/v1',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
    paths: {},
    components: {
      schemas: {},
      responses: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };

  // Parse validation files
  await parseValidationFiles(openAPISpec);

  // Parse route files
  await parseRouteFiles(openAPISpec);

  // Add common responses
  addCommonResponses(openAPISpec);

  return openAPISpec;
}

async function parseValidationFiles(spec) {
  try {
    const validationFiles = await glob('src/validations/*.validation.ts');

    for (const file of validationFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const match = file.match(/src\/validations\/(\w+)\.validation\.ts/);
      const schemaName = match ? match[1] : null;

      if (schemaName) {
        // Extract Zod schemas using regex
        const schemaMatches = content.match(/const\s+(\w+)\s*=\s*z\.object\(/g);

        if (schemaMatches) {
          for (const match of schemaMatches) {
            const name = match.match(/const\s+(\w+)\s*=/)?.[1];
            if (name === schemaName) {
              // Generate basic schema from field names
              const fields = extractFieldsFromZod(content, schemaName);
              if (fields.length > 0) {
                spec.components.schemas[schemaName] = {
                  type: 'object',
                  properties: {},
                  required: [],
                };

                fields.forEach(field => {
                  spec.components.schemas[schemaName].properties[field] = {
                    type: 'string',
                    example: `example-${field}`,
                  };

                  // Check if field is required
                  if (content.includes(`${field}: z.string().min(1)`)) {
                    spec.components.schemas[schemaName].required.push(field);
                  }
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not parse validation files:', error.message);
  }
}

function extractFieldsFromZod(content) {
  const fields = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const fieldMatch = line.match(/(\w+):\s*z\./);
    if (fieldMatch) {
      fields.push(fieldMatch[1]);
    }
  }

  return fields;
}

// Main execution

async function parseRouteFiles(spec) {
  try {
    const routeFiles = await glob('src/routes/v1/*.route.ts');

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const fileName = path.basename(file, '.route.ts');
      const tagName = fileName.charAt(0).toUpperCase() + fileName.slice(1);

      // Extract route definitions
      const routeMatches = content.match(
        /router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g
      );

      if (routeMatches) {
        for (const match of routeMatches) {
          const methodMatch = match.match(
            /router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/
          );
          if (methodMatch) {
            const method = methodMatch[1];
            const routePath = methodMatch[2];
            const fullPath = `/${fileName}${routePath}`;

            // Generate endpoint documentation
            spec.paths[fullPath] = {
              [method]: {
                summary: `${method.toUpperCase()} ${fileName}`,
                description: `Auto-generated endpoint for ${fileName}`,
                tags: [tagName],
                responses: {
                  200: {
                    description: 'Success',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            message: { type: 'string', example: 'Operation successful' },
                            data: { type: 'object' },
                          },
                        },
                      },
                    },
                  },
                  400: { $ref: '#/components/responses/BadRequest' },
                  401: { $ref: '#/components/responses/Unauthorized' },
                  403: { $ref: '#/components/responses/Forbidden' },
                  404: { $ref: '#/components/responses/NotFound' },
                  500: { $ref: '#/components/responses/InternalServerError' },
                },
              },
            };

            // Add request body for POST/PUT/PATCH
            if (['post', 'put', 'patch'].includes(method)) {
              const schemaName = `${tagName}Request`;
              if (spec.components.schemas[schemaName]) {
                spec.paths[fullPath][method].requestBody = {
                  required: true,
                  content: {
                    'application/json': {
                      schema: { $ref: `#/components/schemas/${schemaName}` },
                    },
                  },
                };
              }
            }

            // Add security for protected routes
            if (fileName !== 'health') {
              spec.paths[fullPath][method].security = [{ bearerAuth: [] }];
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not parse route files:', error.message);
  }
}

function addCommonResponses(spec) {
  spec.components.responses = {
    BadRequest: {
      description: 'Bad Request',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: { type: 'integer', example: 400 },
              message: { type: 'string', example: 'Bad Request' },
            },
          },
        },
      },
    },
    Unauthorized: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: { type: 'integer', example: 401 },
              message: { type: 'string', example: 'Please authenticate' },
            },
          },
        },
      },
    },
    Forbidden: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: { type: 'integer', example: 403 },
              message: { type: 'string', example: 'Forbidden' },
            },
          },
        },
      },
    },
    NotFound: {
      description: 'Not Found',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: { type: 'integer', example: 404 },
              message: { type: 'string', example: 'Not found' },
            },
          },
        },
      },
    },
    InternalServerError: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: { type: 'integer', example: 500 },
              message: { type: 'string', example: 'Internal Server Error' },
            },
          },
        },
      },
    },
  };
}

// Main execution
async function main() {
  try {
    console.log('🔄 Simple auto-generating API documentation...');

    const spec = await generateSimpleOpenAPISpec();

    // Ensure docs directory exists
    const docsDir = path.join(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Write the generated spec
    const outputPath = path.join(docsDir, 'simple-auto-generated-api-spec.json');
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));

    console.log('✅ Simple auto-generated API documentation successfully!');
    console.log(`📄 Generated: ${outputPath}`);
    console.log(`📊 Found ${Object.keys(spec.paths || {}).length} endpoints`);
    console.log(`📋 Found ${Object.keys(spec.components?.schemas || {}).length} schemas`);
  } catch (error) {
    console.error('❌ Simple auto-generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateSimpleOpenAPISpec };
