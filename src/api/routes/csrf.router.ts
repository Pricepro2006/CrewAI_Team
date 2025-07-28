import { Router } from 'express';
import { ensureCSRFToken, generateCSRFToken, setCSRFCookie } from '../middleware/security/csrf.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/csrf-token
 * Fetches or generates a CSRF token for the client
 */
router.get('/csrf-token', (req, res) => {
  try {
    // Check if token already exists in session/cookie
    let token = req.cookies?.['__Host-csrf-token'] || (req as any).session?.csrfToken;
    
    // Generate new token if none exists
    if (!token) {
      token = generateCSRFToken();
      
      // Set cookie
      setCSRFCookie(res, token, req.secure || process.env.NODE_ENV === 'production');
      
      // Store in session if available
      if ((req as any).session) {
        (req as any).session.csrfToken = token;
      }
      
      logger.debug('Generated new CSRF token for client', 'CSRF', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } else {
      logger.debug('Returning existing CSRF token to client', 'CSRF', {
        ip: req.ip,
      });
    }
    
    // Return token to client
    res.json({
      token,
      expiresIn: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    });
  } catch (error) {
    logger.error('Failed to generate CSRF token', 'CSRF', error);
    res.status(500).json({
      error: 'Failed to generate security token',
    });
  }
});

/**
 * POST /api/csrf-token/validate
 * Validates a CSRF token (for testing/debugging)
 */
router.post('/csrf-token/validate', (req, res) => {
  const requestToken = req.headers['x-csrf-token'] as string | undefined;
  const storedToken = req.cookies?.['__Host-csrf-token'] || (req as any).session?.csrfToken;
  
  if (!requestToken) {
    return res.status(400).json({
      valid: false,
      error: 'No token provided in request',
    });
  }
  
  if (!storedToken) {
    return res.status(400).json({
      valid: false,
      error: 'No stored token found',
    });
  }
  
  const isValid = requestToken === storedToken;
  
  return res.json({
    valid: isValid,
    message: isValid ? 'Token is valid' : 'Token mismatch',
  });
});

export default router;