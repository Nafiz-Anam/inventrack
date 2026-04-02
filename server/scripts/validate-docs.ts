import swaggerJsdoc from 'swagger-jsdoc';
import swaggerDefinition from '../src/docs/swaggerDef.js';

try {
  const specs = swaggerJsdoc({
    swaggerDefinition,
    apis: ['src/docs/*.yml', 'src/routes/v1/*.ts', 'src/controllers/*.ts'],
    failOnErrors: true,
  });

  console.log('✅ API documentation is valid!');
  console.log(`📊 Found ${Object.keys((specs as any).paths || {}).length} endpoints`);
  console.log(`📋 Found ${Object.keys((specs as any).components?.schemas || {}).length} schemas`);
  console.log(`🏷️  Found ${(specs as any).tags?.length || 0} tags`);
} catch (error) {
  console.error(
    '❌ API documentation validation failed:',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
