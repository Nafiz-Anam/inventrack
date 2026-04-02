import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { name, version, description } from '../package.json';

// Advanced auto-generator that reads Zod validation schemas and TypeScript types
async function generateAdvancedOpenAPISpec() {
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

  // Parse Zod validation schemas
  await parseZodSchemas(openAPISpec);

  // Parse route files and extract endpoints
  await parseRouteFiles(openAPISpec);

  // Add common responses
  addCommonResponses(openAPISpec);

  return openAPISpec;
}

async function parseZodSchemas(spec: any) {
  try {
    const validationFiles = await glob('src/validations/*.validation.ts');

    for (const file of validationFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const fileName = path.basename(file, '.validation.ts');

      // Parse Zod schemas using regex patterns
      const schemaMatches = content.match(/const\s+(\w+)\s*=\s*z\.object\(/g);

      if (schemaMatches) {
        for (const match of schemaMatches) {
          const schemaName = match.match(/const\s+(\w+)\s*=/)?.[1];
          if (schemaName) {
            const schemaStart = content.indexOf(match);
            const schemaEnd = findClosingBrace(content, schemaStart + match.length);
            const schemaDefinition = content.substring(schemaStart, schemaEnd);

            // Convert Zod schema to OpenAPI schema
            const openAPISchema = convertZodToOpenAPI(schemaDefinition, schemaName);
            if (openAPISchema) {
              spec.components.schemas[schemaName] = openAPISchema;
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not parse Zod schemas:', error);
  }
}

function convertZodToOpenAPI(zodSchema: string, schemaName: string) {
  const schema: any = {
    type: 'object',
    properties: {},
    required: [],
  };

  // Parse Zod field definitions
  const fieldMatches = zodSchema.match(/(\w+):\s*z\.([^(]+)\(/g);

  if (fieldMatches) {
    for (const match of fieldMatches) {
      const fieldMatch = match.match(/(\w+):\s*z\.([^(]+)\(/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const zodType = fieldMatch[2];

        // Convert Zod types to OpenAPI types
        const openAPIType = convertZodTypeToOpenAPI(zodType, zodSchema, fieldName);
        if (openAPIType) {
          schema.properties[fieldName] = openAPIType;

          // Check if field is required
          if (zodSchema.includes(`${fieldName}: z.${zodType}().min(1)`)) {
            schema.required.push(fieldName);
          }
        }
      }
    }
  }

  return Object.keys(schema.properties).length > 0 ? schema : null;
}

function convertZodTypeToOpenAPI(zodType: string, fullSchema: string, fieldName: string) {
  const baseType: any = {
    type: 'string', // default
  };

  switch (zodType.toLowerCase()) {
    case 'string':
      baseType.type = 'string';
      if (fullSchema.includes(`${fieldName}: z.string().email()`)) {
        baseType.format = 'email';
      }
      if (fullSchema.includes(`${fieldName}: z.string().min(`)) {
        const minMatch = fullSchema.match(
          new RegExp(`${fieldName}: z\\.string\\(\\)\\.min\\((\\d+)\\)`)
        );
        if (minMatch) {
          baseType.minLength = parseInt(minMatch[1]);
        }
      }
      break;
    case 'number':
      baseType.type = 'number';
      break;
    case 'boolean':
      baseType.type = 'boolean';
      break;
    case 'array':
      baseType.type = 'array';
      baseType.items = { type: 'string' };
      break;
    default:
      baseType.type = 'string';
  }

  // Add examples based on field name
  baseType.example = generateExample(fieldName, baseType.type);

  return baseType;
}

function generateExample(fieldName: string, type: string) {
  const examples: { [key: string]: any } = {
    email: 'user@example.com',
    password: 'password123',
    name: 'John Doe',
    id: 1,
    role: 'USER',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  };

  return (
    examples[fieldName] ||
    (type === 'string' ? 'example' : type === 'number' ? 1 : type === 'boolean' ? true : null)
  );
}

function findClosingBrace(content: string, startIndex: number): number {
  let braceCount = 0;
  let inString = false;
  let stringChar = '';

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];

    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar) {
      inString = false;
    } else if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return i + 1;
        }
      }
    }
  }

  return content.length;
}

async function parseRouteFiles(spec: any) {
  try {
    const routeFiles = await glob('src/routes/v1/*.route.ts');

    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const fileName = path.basename(file, '.route.ts');
      const tagName = fileName.charAt(0).toUpperCase() + fileName.slice(1);

      // Extract route definitions using more sophisticated regex
      const routePatterns = [
        /router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g,
        /router\.route\(['"`]([^'"`]+)['"`]\)\.(get|post|put|patch|delete)/g,
      ];

      for (const pattern of routePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const method = match[1];
          const routePath = match[2] || match[1];
          const fullPath = `/${fileName}${routePath}`;

          // Generate endpoint documentation
          const endpoint = generateEndpointDoc(method, fileName, routePath, tagName);
          spec.paths[fullPath] = {
            [method]: endpoint,
          };
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not parse route files:', error);
  }
}

function generateEndpointDoc(method: string, fileName: string, routePath: string, tagName: string) {
  const endpoint: any = {
    summary: `${method.toUpperCase()} ${fileName}`,
    description: `Auto-generated endpoint for ${fileName}`,
    tags: [tagName],
    responses: {
      '200': {
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
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '403': { $ref: '#/components/responses/Forbidden' },
      '404': { $ref: '#/components/responses/NotFound' },
      '500': { $ref: '#/components/responses/InternalServerError' },
    },
  };

  // Add request body for POST/PUT/PATCH methods
  if (['post', 'put', 'patch'].includes(method)) {
    const schemaName = `${tagName}Request`;
    endpoint.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${schemaName}` },
        },
      },
    };
  }

  // Add security for protected routes
  if (fileName !== 'health') {
    endpoint.security = [{ bearerAuth: [] }];
  }

  return endpoint;
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
    console.log('🔄 Advanced auto-generating API documentation...');

    const spec = await generateAdvancedOpenAPISpec();

    // Ensure docs directory exists
    const docsDir = path.join(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Write the generated spec
    const outputPath = path.join(docsDir, 'advanced-auto-generated-api-spec.json');
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));

    console.log('✅ Advanced auto-generated API documentation successfully!');
    console.log(`📄 Generated: ${outputPath}`);
    console.log(`📊 Found ${Object.keys(spec.paths || {}).length} endpoints`);
    console.log(`📋 Found ${Object.keys(spec.components?.schemas || {}).length} schemas`);
  } catch (error) {
    console.error('❌ Advanced auto-generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { generateAdvancedOpenAPISpec };
