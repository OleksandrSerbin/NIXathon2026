import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

/**
 * Request logging middleware
 * Logs all incoming requests and outgoing responses
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log incoming request
  Logger.log(`[${requestId}] Incoming ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type')
  });

  // Log request body for POST requests (truncated for large bodies)
  if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.length > 1000) {
      Logger.log(`[${requestId}] Request body (truncated)`, {
        size: bodyStr.length,
        preview: bodyStr.substring(0, 500) + '...'
      });
    } else {
      Logger.log(`[${requestId}] Request body`, req.body);
    }
  }

  // Capture response
  const originalSend = res.send;
  res.send = function (body: any): Response {
    const timeMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log response
    Logger.log(`[${requestId}] Response ${req.method} ${req.path}`, {
      statusCode,
      timeMs: `${timeMs}ms`,
      responseSize: typeof body === 'string' ? body.length : JSON.stringify(body).length
    });

    // Log response body for debugging (truncated)
    if (statusCode >= 200 && statusCode < 300) {
      try {
        const responseBody = typeof body === 'string' ? JSON.parse(body) : body;
        const responseStr = JSON.stringify(responseBody);
        if (responseStr.length > 1000) {
          Logger.debug(`[${requestId}] Response body (truncated)`, {
            size: responseStr.length,
            preview: responseStr.substring(0, 500) + '...'
          });
        } else {
          Logger.debug(`[${requestId}] Response body`, responseBody);
        }
      } catch (e) {
        // Not JSON, skip
      }
    } else {
      Logger.warn(`[${requestId}] Error response`, {
        statusCode,
        body: typeof body === 'string' ? body.substring(0, 200) : body
      });
    }

    return originalSend.call(this, body);
  };

  next();
}
