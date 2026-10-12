import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';

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
  return serverlessHandler(event, context);
};
