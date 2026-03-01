const express = require('express');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUiExpress = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sarah Chatbot API',
      version: '1.0.0',
      description: 'Premium AI chatbot API documentation',
    },
    servers: [
      { url: process.env.API_URL || 'http://localhost:3000', description: 'Development' },
    ],
    components: {
      schemas: {
        Message: {
          type: 'object',
          required: ['tenant_id', 'session_id', 'text'],
          properties: {
            tenant_id: { type: 'string', format: 'uuid' },
            session_id: { type: 'string', format: 'uuid' },
            text: { type: 'string', maxLength: 5000 },
            lang: { type: 'string', enum: ['es', 'en', 'pt', 'gl'] },
          },
        },
        Lead: {
          type: 'object',
          required: ['tenant_id', 'name', 'email', 'business_line'],
          properties: {
            tenant_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            business_line: { type: 'string', enum: ['boostic', 'binnacle', 'marketing', 'tech'] },
          },
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsDoc(options);

const router = express.Router();
router.use('/api-docs', swaggerUiExpress.serve);
router.get('/api-docs', swaggerUiExpress.setup(swaggerSpec, {
  customCss: '.swagger-ui { font-family: "Space Grotesk", sans-serif; }',
}));

module.exports = router;
