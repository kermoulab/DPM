import { createApp } from '../../server/app.js';

const app = createApp();

export const handler = async (event: any, context: any) => {
  // Convert Netlify serverless event to Express request/response format
  return new Promise((resolve) => {
    const req: any = {
      method: event.httpMethod,
      url: event.path + (event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : ''),
      headers: event.headers || {},
      body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body) : undefined,
    };

    const res: any = {
      statusCode: 200,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this.headers[name.toLowerCase()];
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send(body: any) {
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: typeof body === 'string' ? body : JSON.stringify(body),
        });
      },
      json(obj: any) {
        this.headers['content-type'] = 'application/json';
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: JSON.stringify(obj),
        });
      },
      sendStatus(code: number) {
        this.statusCode = code;
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: '',
        });
      },
      type(contentType: string) {
        this.headers['content-type'] = contentType;
        return this;
      },
      sendFile(filePath: string) {
        try {
          const fs = require('fs');
          const data = fs.readFileSync(filePath, 'utf8');
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            body: data,
          });
        } catch {
          resolve({
            statusCode: 404,
            headers: this.headers,
            body: 'Not Found',
          });
        }
      },
    };

    app(req, res);
  });
};
