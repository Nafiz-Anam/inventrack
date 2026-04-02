const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');

/* global console, process */

// Import the swagger definition (we'll need to handle this differently for CommonJS)
function getSwaggerDefinition() {
  try {
    // Read the swagger definition file and extract the export
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

    return {
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
      components: {
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
  } catch (error) {
    console.error('Error reading swagger definition:', error);
    process.exit(1);
  }
}

try {
  console.log('🔍 Validating API documentation...');

  const swaggerDefinition = getSwaggerDefinition();

  const specs = swaggerJsdoc({
    definition: swaggerDefinition,
    apis: ['src/docs/*.yml', 'src/routes/v1/*.ts', 'src/controllers/*.ts'],
    failOnErrors: true,
  });

  console.log('✅ API documentation is valid!');
  console.log(`📊 Found ${Object.keys(specs.paths || {}).length} endpoints`);
  console.log(`📋 Found ${Object.keys(specs.components?.schemas || {}).length} schemas`);
  console.log(`🏷️  Found ${specs.tags?.length || 0} tags`);
} catch (error) {
  console.error('❌ API documentation validation failed:', error.message);
  process.exit(1);
}
