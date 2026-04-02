import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import swaggerDefinition from '../src/docs/swaggerDef';

try {
  const specs = swaggerJsdoc({
    swaggerDefinition,
    apis: ['src/docs/*.yml', 'src/routes/v1/*.ts', 'src/controllers/*.ts'],
    failOnErrors: true,
  });

  // Ensure docs directory exists
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Write JSON specification
  const jsonPath = path.join(docsDir, 'api-spec.json');
  fs.writeFileSync(jsonPath, JSON.stringify(specs, null, 2));

  console.log('✅ API documentation generated successfully!');
  console.log(`📄 Generated: ${jsonPath}`);
  console.log(`📊 Found ${Object.keys((specs as any).paths || {}).length} endpoints`);
  console.log(`📋 Found ${Object.keys((specs as any).components?.schemas || {}).length} schemas`);
  console.log(`🏷️  Found ${(specs as any).tags?.length || 0} tags`);
} catch (error) {
  console.error(
    '❌ API documentation generation failed:',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
