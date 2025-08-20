/**
 * Example LLM Router
 * Demonstrates proper client context extraction for rate limiting
 */

import { Router, Request, Response } from 'express';
import { LlamaCppHttpProvider } from '../../core/llm/LlamaCppHttpProvider.js';
import { extractLLMContext, createLLMOptionsWithContext } from '../utils/llm-context-extractor.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

const router = Router();

// Initialize LLM provider
const llamaProvider = new LlamaCppHttpProvider('http://localhost:8081');

// Request validation schema
const GenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4096).optional(),
  systemPrompt: z.string().optional()
});

/**
 * POST /api/llm/generate
 * Generate text with proper client-specific rate limiting
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedBody = GenerateRequestSchema.parse(req.body);
    
    // Extract client context for rate limiting
    const context = extractLLMContext(req);
    
    logger.info('Processing LLM generation request', 'LLM_ROUTE', {
      hasUserId: !!context.userId,
      hasSessionId: !!context.sessionId,
      ip: context.ip,
      promptLength: validatedBody.prompt.length
    });
    
    // Generate text with client-specific rate limiting
    const response = await llamaProvider.generate(
      validatedBody.prompt,
      {
        temperature: validatedBody.temperature,
        maxTokens: validatedBody.maxTokens,
        systemPrompt: validatedBody.systemPrompt,
        context // Pass context for proper rate limiting
      }
    );
    
    // Return successful response
    res.json({
      success: true,
      data: {
        response: response.response,
        model: response.model,
        tokensGenerated: response.tokensGenerated,
        tokensPerSecond: response.tokensPerSecond
      },
      metadata: {
        clientId: context.userId ? `user:${context.userId}` : 
                  context.sessionId ? `session:${context.sessionId}` :
                  context.ip ? `ip:${context.ip}` : 'anonymous'
      }
    });
    
  } catch (error) {
    // Handle different error types
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body', 'LLM_ROUTE', { errors: error.errors });
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors
      });
    }
    
    if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
      logger.warn('Rate limit exceeded', 'LLM_ROUTE', { 
        ip: extractLLMContext(req).ip 
      });
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: 60 // seconds
      });
    }
    
    if (error instanceof Error && error.message.includes('Server is at capacity')) {
      logger.warn('Server at capacity', 'LLM_ROUTE');
      return res.status(503).json({
        success: false,
        error: 'Server is temporarily at capacity',
        retryAfter: 30 // seconds
      });
    }
    
    // Generic error handling
    logger.error('LLM generation failed', 'LLM_ROUTE', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/llm/stream
 * Stream text generation with proper client-specific rate limiting
 */
router.post('/stream', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedBody = GenerateRequestSchema.parse(req.body);
    
    // Extract client context
    const context = extractLLMContext(req);
    
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Stream generation with client-specific rate limiting
    const stream = llamaProvider.generateStream(
      validatedBody.prompt,
      {
        temperature: validatedBody.temperature,
        maxTokens: validatedBody.maxTokens,
        systemPrompt: validatedBody.systemPrompt,
        context // Pass context for proper rate limiting
      }
    );
    
    // Stream chunks to client
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    
  } catch (error) {
    // Handle errors
    if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
      res.write(`data: ${JSON.stringify({ 
        error: 'Rate limit exceeded',
        retryAfter: 60 
      })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ 
        error: 'Generation failed' 
      })}\n\n`);
    }
    res.end();
  }
});

/**
 * GET /api/llm/status
 * Check LLM provider status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const modelInfo = llamaProvider.getModelInfo();
    const isReady = llamaProvider.isReady();
    
    res.json({
      success: true,
      data: {
        ready: isReady,
        model: modelInfo.model,
        contextSize: modelInfo.contextSize,
        loaded: modelInfo.loaded,
        activeRequests: modelInfo.processCount
      }
    });
  } catch (error) {
    logger.error('Failed to get LLM status', 'LLM_ROUTE', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

export default router;