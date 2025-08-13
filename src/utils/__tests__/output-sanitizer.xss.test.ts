/**
 * XSS-specific tests for output sanitizer
 */

import { describe, it, expect } from 'vitest';
import { 
  sanitizeLLMOutput, 
  sanitizeForContext, 
  autoSanitize,
  quickSanitize,
  sanitizeJSONOutput 
} from '../output-sanitizer';

describe('Output Sanitizer XSS Protection', () => {
  describe('sanitizeLLMOutput with XSS', () => {
    it('should detect and remove XSS patterns', () => {
      const input = `
        Here's the response: <script>alert("XSS")</script>
        And a link: <a href="javascript:alert('XSS')">Click me</a>
        With template: {{malicious.code}}
      `;

      const result = sanitizeLLMOutput(input);
      
      expect(result.metadata?.xssProtected).toBe(true);
      expect(result.metadata?.removedItems).toContain('xss_patterns');
      expect(result.content).not.toContain('{{malicious.code}}');
      expect(result.content).not.toContain('<script>');
    });

    it('should preserve safe content while removing XSS', () => {
      const input = `
        # Safe Heading
        This is **bold** text with legitimate content.
        Here's a [safe link](https://example.com).
        But this is bad: <img src=x onerror="alert('XSS')">
      `;

      const result = sanitizeLLMOutput(input);
      
      expect(result.content).toContain('# Safe Heading');
      expect(result.content).toContain('**bold**');
      expect(result.content).toContain('[safe link]');
      expect(result.content).not.toContain('onerror=');
    });
  });

  describe('Context-specific sanitization', () => {
    describe('email context', () => {
      it('should apply minimal HTML sanitization for email', () => {
        const input = `
          <p>Hello user@example.com</p>
          <script>steal.cookies()</script>
          <div onclick="hack()">Click</div>
        `;

        const result = sanitizeForContext(input, 'email');
        
        expect(result.content).toContain('<p>');
        expect(result.content).toContain('[EMAIL_PROTECTED]');
        expect(result.content).not.toContain('<script>');
        expect(result.content).not.toContain('onclick=');
        expect(result.metadata?.xssProtected).toBe(true);
      });
    });

    describe('web context', () => {
      it('should apply strict HTML sanitization for web', () => {
        const input = `
          <h1>Title</h1>
          <p>Content with <a href="javascript:void(0)">bad link</a></p>
          <iframe src="evil.com"></iframe>
          <img src="valid.jpg" onerror="alert('XSS')">
        `;

        const result = sanitizeForContext(input, 'web');
        
        expect(result.content).toContain('<h1>Title</h1>');
        expect(result.content).toContain('<p>');
        expect(result.content).not.toContain('javascript:');
        expect(result.content).not.toContain('<iframe');
        expect(result.content).not.toContain('onerror=');
      });
    });

    describe('html context', () => {
      it('should apply moderate HTML sanitization', () => {
        const input = `
          <table>
            <tr><td>Data</td></tr>
          </table>
          <style>body { background: url(javascript:alert('XSS')); }</style>
          <form action="steal.php"><input name="password"></form>
        `;

        const result = sanitizeForContext(input, 'html');
        
        expect(result.content).toContain('<table>');
        expect(result.content).toContain('<tr>');
        expect(result.content).not.toContain('<style>');
        expect(result.content).not.toContain('<form>');
        expect(result.content).not.toContain('javascript:');
      });
    });

    describe('markdown context', () => {
      it('should preserve markdown while escaping HTML', () => {
        const input = `
          # Heading
          **Bold** and *italic* text
          [Link](https://example.com)
          <script>alert('XSS')</script>
          <div>HTML content</div>
        `;

        const result = sanitizeForContext(input, 'markdown');
        
        expect(result.content).toContain('# Heading');
        expect(result.content).toContain('**Bold**');
        expect(result.content).toContain('[Link]');
        expect(result.content).toContain('&lt;script&gt;');
        expect(result.content).toContain('&lt;div&gt;');
        expect(result.content).not.toContain('<script>');
      });

      it('should allow markdown image syntax', () => {
        const input = '![Alt text](image.png)';
        const result = sanitizeForContext(input, 'markdown');
        
        expect(result.content).toContain('![Alt text](image.png)');
      });
    });

    describe('api context', () => {
      it('should strip all HTML and redact tokens', () => {
        const input = `
          API Response: <b>Success</b>
          Token: sk_test_abcdef1234567890abcdef1234567890
          <script>alert('XSS')</script>
        `;

        const result = sanitizeForContext(input, 'api');
        
        expect(result.content).not.toContain('<b>');
        expect(result.content).not.toContain('<script>');
        expect(result.content).toContain('[TOKEN_REDACTED]');
        expect(result.content).not.toContain('sk_test_');
      });
    });
  });

  describe('Auto-detection sanitization', () => {
    it('should detect and sanitize HTML content', () => {
      const input = '<h1>Title</h1><p>Content</p><script>alert("XSS")</script>';
      const result = autoSanitize(input);
      
      expect(result.content).toContain('<h1>Title</h1>');
      expect(result.content).not.toContain('<script>');
    });

    it('should detect and sanitize markdown content', () => {
      const input = '# Heading\n**Bold** text with <script>alert("XSS")</script>';
      const result = autoSanitize(input);
      
      expect(result.content).toContain('# Heading');
      expect(result.content).toContain('**Bold**');
      expect(result.content).not.toContain('<script>');
    });

    it('should detect email content and sanitize appropriately', () => {
      const input = 'Contact us at admin@example.com <script>alert("XSS")</script>';
      const result = autoSanitize(input);
      
      expect(result.content).toContain('[EMAIL_PROTECTED]');
      expect(result.content).not.toContain('admin@example.com');
      expect(result.content).not.toContain('<script>');
    });

    it('should default to general sanitization for plain text', () => {
      const input = 'Just plain text with {{template}} injection';
      const result = autoSanitize(input);
      
      expect(result.content).not.toContain('{{template}}');
      expect(result.metadata?.xssProtected).toBe(true);
    });
  });

  describe('JSON output sanitization', () => {
    it('should sanitize JSON content for XSS', () => {
      const jsonWithXSS = JSON.stringify({
        message: '<script>alert("XSS")</script>',
        data: {
          html: '<img src=x onerror="alert(\'XSS\')">',
          template: 'Hello {{user}}',
        },
      });

      const result = sanitizeJSONOutput(jsonWithXSS);
      
      expect(result.valid).toBe(true);
      expect(result.parsed.message).not.toContain('<script>');
      expect(result.parsed.data.html).not.toContain('onerror=');
      expect(result.parsed.data.template).not.toContain('{{user}}');
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJSON = '{ broken json <script>alert("XSS")</script>';
      const result = sanitizeJSONOutput(invalidJSON);
      
      expect(result.valid).toBe(false);
      expect(result.content).not.toContain('<script>');
    });
  });

  describe('Quick sanitize', () => {
    it('should provide fast XSS-safe sanitization', () => {
      const input = 'Quick response with <script>alert("XSS")</script> removed';
      const result = quickSanitize(input);
      
      expect(result).not.toContain('<script>');
      expect(result).toContain('Quick response with');
    });
  });

  describe('Integration with system tags', () => {
    it('should remove internal tags and apply XSS protection', () => {
      const input = `
        <think>Internal thought</think>
        Public response with <script>alert("XSS")</script>
        <debug>Debug info</debug>
        And {{template}} injection
      `;

      const result = sanitizeLLMOutput(input);
      
      expect(result.content).not.toContain('<think>');
      expect(result.content).not.toContain('<debug>');
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('{{template}}');
      expect(result.content).toContain('Public response with');
      expect(result.metadata?.removedItems).toContain('internal_tags');
      expect(result.metadata?.xssProtected).toBe(true);
    });
  });
});