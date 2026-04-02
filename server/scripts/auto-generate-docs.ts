import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { name, version, description } from '../package.json';

interface RouteInfo {
  path: string;
  method: string;
  handler: string;
  middleware: string[];
  validation?: string;
}

interface ValidationSchema {
  [key: string]: any;
}

// Auto-generate OpenAPI spec from TypeScript types and validation schemas
async function generateOpenAPISpec() {
  const openAPISpec = {
    openapi: '3.0.0',
    info: {
      title: `${name} API Documentation`,
      version,
      description: description || 'RESTful API with Node.js, TypeScript, Express, and Prisma',
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

  // Auto-generate schemas from validation files
  await generateSchemasFromValidation(openAPISpec);

  // Auto-generate paths from route files
  await generatePathsFromRoutes(openAPISpec);

  // Add common responses
  addCommonResponses(openAPISpec);

  return openAPISpec;
}

async function generateSchemasFromValidation(spec: any) {
  try {
    // Read validation files
    const validationFiles = await glob('src/validations/*.validation.ts');

    for (const file of validationFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const fileName = path.basename(file, '.validation.ts');

      // Extract validation schemas (this is a simplified approach)
      // In a real implementation, you'd parse the Zod schemas more thoroughly
      if (content.includes('register')) {
        spec.components.schemas.RegisterRequest = {
          type: 'object',
          required: ['email', 'name', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            password: { type: 'string', format: 'password', minLength: 8, example: 'password123' },
          },
        };
      }

      if (content.includes('login')) {
        spec.components.schemas.LoginRequest = {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', example: 'password123' },
          },
        };
      }
    }
  } catch (error) {
    console.warn('Warning: Could not parse validation schemas:', error);
  }
}

async function generatePathsFromRoutes(spec: any) {
  try {
    // Read route files
    const routeFiles = await glob('src/routes/v1/*.route.ts');

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const fileName = path.basename(file, '.route.ts');

      // Extract route information using regex
      const routeMatches = content.match(
        /router\.(get|post|put|patch|delete|put)\(['"`]([^'"`]+)['"`]/g
      );

      if (routeMatches) {
        for (const match of routeMatches) {
          const methodMatch = match.match(
            /router\.(get|post|put|patch|delete|put)\(['"`]([^'"`]+)['"`]/
          );
          if (methodMatch) {
            const method = methodMatch[1];
            const routePath = methodMatch[2];
            const fullPath = `/${fileName}${routePath}`;

            // Auto-generate path documentation
            spec.paths[fullPath] = {
              [method]: {
                summary: `${method.toUpperCase()} ${fileName}`,
                description: `Auto-generated endpoint for ${fileName}`,
                tags: [fileName.charAt(0).toUpperCase() + fileName.slice(1)],
                responses: {
                  '200': {
                    description: 'Success',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            message: { type: 'string' },
                            data: { type: 'object' },
                          },
                        },
                      },
                    },
                  },
                  '400': { $ref: '#/components/responses/BadRequest' },
                  '401': { $ref: '#/components/responses/Unauthorized' },
                  '500': { $ref: '#/components/responses/InternalServerError' },
                },
              },
            };

            // Add request body for POST/PUT/PATCH
            if (['post', 'put', 'patch'].includes(method)) {
              const schemaName = `${fileName.charAt(0).toUpperCase() + fileName.slice(1)}Request`;
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
          }
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not parse route files:', error);
  }
}

function addCommonResponses(spec: any) {
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
    console.log('🔄 Auto-generating API documentation...');

    const spec = await generateOpenAPISpec();

    // Ensure docs directory exists
    const docsDir = path.join(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Write the generated spec
    const outputPath = path.join(docsDir, 'auto-generated-api-spec.json');
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));

    console.log('✅ Auto-generated API documentation successfully!');
    console.log(`📄 Generated: ${outputPath}`);
    console.log(`📊 Found ${Object.keys(spec.paths || {}).length} endpoints`);
    console.log(`📋 Found ${Object.keys(spec.components?.schemas || {}).length} schemas`);

    // Also update the main swagger definition
    const swaggerDefPath = path.join(process.cwd(), 'src', 'docs', 'swaggerDef.ts');
    if (fs.existsSync(swaggerDefPath)) {
      console.log('📝 Updating main swagger definition...');
      // You could update the main swagger definition here if needed
    }
  } catch (error) {
    console.error('❌ Auto-generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { generateOpenAPISpec };
