import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';

// Prevent background promise rejections from abruptly exiting the Lambda runtime
process.on('unhandledRejection', (reason) => {
  console.error('[Netlify Function] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Netlify Function] Uncaught exception:', err);
});

const app = createApp();
const serverlessHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  if (event) {
    if (typeof event.path === 'string' && event.path.startsWith('/.netlify/functions/api')) {
      event.path = event.path.replace(/^\/\.netlify\/functions\/api/, '/api');
    }
    if (typeof event.rawPath === 'string' && event.rawPath.startsWith('/.netlify/functions/api')) {
      event.rawPath = event.rawPath.replace(/^\/\.netlify\/functions\/api/, '/api');
    }
    if (!event.path && event.rawUrl) {
      try {
        event.path = new URL(event.rawUrl).pathname;
      } catch {
        event.path = '/api';
      }
    }
  }
  try {
    return await serverlessHandler(event, context);
  } catch (err: any) {
    console.error('[Netlify Function] Handler execution error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error. Please try again.',
        details: err?.message
      })
    };
  }
};

