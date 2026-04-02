import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import swaggerDefinition from '../../docs/swaggerDef';
import auth from '../../middlewares/auth';
import config from '../../config/config';

const router = express.Router();

const specs = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: ['src/docs/*.yml', 'src/routes/v1/*.ts', 'src/controllers/*.ts'],
  failOnErrors: true,
});

// Custom Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true,
    requestInterceptor: (req: any) => {
      // Add authorization header if available
      const token = localStorage.getItem('accessToken');
      if (token) {
        req.headers.Authorization = `Bearer ${token}`;
      }
      return req;
    },
  },
};

// Protect docs in production with authentication
if (config.env === 'production') {
  router.use(auth('manageUsers'));
}

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, swaggerUiOptions));

// Serve the OpenAPI specification as JSON
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// Serve the OpenAPI specification as YAML
router.get('/yaml', (req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  res.send(specs);
});

export default router;
