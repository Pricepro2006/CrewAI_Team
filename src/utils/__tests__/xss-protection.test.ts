/**
 * Comprehensive XSS Protection Tests
 * Tests against OWASP XSS Filter Evasion Cheat Sheet
 */

import { describe, it, expect } from 'vitest';
import { 
  xssProtection, 
  XSSEncoder, 
  XSSSchemas,
  type SanitizationLevel 
} from '../xss-protection';

describe('XSS Protection', () => {
  describe('Basic XSS Attack Vectors', () => {
    it('should sanitize script tags', () => {
      const vectors = [
        '<script>alert("XSS")</script>',
        '<SCRIPT>alert("XSS")</SCRIPT>',
        '<script>alert(String.fromCharCode(88,83,83))</script>',
        '<script src="http://evil.com/xss.js"></script>',
        '<<SCRIPT>alert("XSS");//<</SCRIPT>',
        '<script>alert(/XSS/)</script>',
      ];

      vectors.forEach(vector => {
        const sanitized = xssProtection.sanitizeHTML(vector);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('</script>');
        expect(sanitized).not.toContain('alert');
      });
    });

    it('should sanitize event handlers', () => {
      const vectors = [
        '<img src=x onerror="alert(\'XSS\')">',
        '<body onload="alert(\'XSS\')">',
        '<div onclick="alert(\'XSS\')">Click me</div>',
        '<input onfocus="alert(\'XSS\')" autofocus>',
        '<select onchange="alert(\'XSS\')"></select>',
        '<form onsubmit="alert(\'XSS\')">',
        '<iframe onload="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
      ];

      vectors.forEach(vector => {
        const sanitized = xssProtection.sanitizeHTML(vector);
        expect(sanitized).not.toMatch(/on\w+=/i);
        expect(sanitized).not.toContain('alert');
      });
    });

    it('should sanitize javascript: URLs', () => {
      const vectors = [
        '<a href="javascript:alert(\'XSS\')">Click</a>',
        '<a href="  javascript:alert(\'XSS\')">Click</a>',
        '<a href="java\nscript:alert(\'XSS\')">Click</a>',
        '<a href="java&#x09;script:alert(\'XSS\')">Click</a>',
        '<img src="javascript:alert(\'XSS\')">',
        '<iframe src="javascript:alert(\'XSS\')">',
      ];

      vectors.forEach(vector => {
        const sanitized = xssProtection.sanitizeHTML(vector);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('alert');
      });
    });

    it('should sanitize data: URLs', () => {
      const vectors = [
        '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>',
        '<img src="data:image/svg+xml,<svg onload=alert(\'XSS\')>">',
        '<object data="data:text/html,<script>alert(\'XSS\')</script>">',
      ];

      vectors.forEach(vector => {
        const sanitized = xssProtection.sanitizeHTML(vector);
        expect(sanitized).not.toContain('data:');
        expect(sanitized).not.toContain('alert');
      });
    });
  });

  describe('Advanced XSS Attack Vectors', () => {
    it('should sanitize CSS expressions', () => {
      const vectors = [
        '<div style="background:url(javascript:alert(\'XSS\'))">',
        '<div style="width: expression(alert(\'XSS\'));">',
        '<style>body{background:url("javascript:alert(\'XSS\')")}</style>',
        '<div style="behavior: url(xss.htc);">',
      ];

      vectors.forEach(vector => {
        const sanitized = xssProtection.sanitizeHTML(vector, 'strict');
        expect(sanitized).not.toContain('expression(');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('behavior:');
      });
    });

    it('should sanitize SVG-based XSS', () => {
      const vectors = [
        '<svg><script>alert(\'XSS\')</script></svg>',
        '<svg onload="alert(\'XSS\')"></svg>',
        '<svg><animate onbegin="alert(\'XSS\')" />',
        '<svg><set attributeName="onmouseover" to="alert(\'XSS\')"/>',
        '<svg><handler xmlns:ev="http://www.w3.org/2001/xml-events" ev:event="load">alert(\'XSS\')</handler></svg>',
      ];

      vectors.forEach(vector => {
        const sanitized = xssProtection.sanitizeHTML(vector);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('alert');
      });
    });

    it('should sanitize HTML5 injection vectors', () => {
      const vectors = [
        '<video><source onerror="alert(\'XSS\')">',
        '<audio src=x onerror="alert(\'XSS\')">',
        '<details open ontoggle="alert(\'XSS\')">',
        '<marquee onstart="alert(\'XSS\')">',
        '<isindex action="javascript:alert(\'XSS\')">',
      ];

      vectors.forEach(vector => {
        const sanitized = xssProtection.sanitizeHTML(vector);
        expect(sanitized).not.toMatch(/on\w+=/i);
        expect(sanitized).not.toContain('javascript:');
      });
    });

    it('should handle encoded XSS attempts', () => {
      const vectors = [
        '<IMG SRC=&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;>',
        '<IMG SRC=&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3A&#x61&#x6C&#x65&#x72&#x74&#x28&#x27&#x58&#x53&#x53&#x27&#x29>',
        '<IMG SRC="jav&#x09;ascript:alert(\'XSS\');">',
        '<IMG SRC="jav\tascript:alert(\'XSS\');">',
      ];

      vectors.forEach(vector => {
        const sanitized = xssProtection.sanitizeHTML(vector);
        expect(sanitized).not.toContain('alert');
        expect(sanitized).not.toMatch(/javascript:/i);
      });
    });
  });

  describe('Context-Specific Encoding', () => {
    it('should properly encode for HTML context', () => {
      const input = '<script>alert("XSS")</script>&<>"\'`=/';
      const encoded = XSSEncoder.html(input);
      
      expect(encoded).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;&amp;&lt;&gt;&quot;&#x27;&#x60;&#x3D;&#x2F;');
      expect(encoded).not.toContain('<');
      expect(encoded).not.toContain('>');
    });

    it('should properly encode for JavaScript context', () => {
      const input = '</script><script>alert("XSS")</script>';
      const encoded = XSSEncoder.javascript(input);
      
      expect(encoded).toContain('\\x3C');
      expect(encoded).toContain('\\x3E');
      expect(encoded).not.toContain('</script>');
    });

    it('should properly encode for CSS context', () => {
      const input = 'expression(alert("XSS"))';
      const encoded = XSSEncoder.css(input);
      
      expect(encoded).toMatch(/\\[0-9a-f]{6}/);
      expect(encoded).not.toContain('expression');
    });

    it('should properly encode for URL context', () => {
      const input = 'javascript:alert("XSS")';
      const encoded = XSSEncoder.url(input);
      
      expect(encoded).toBe('javascript%3Aalert(%22XSS%22)');
      expect(encoded).not.toContain(':');
    });

    it('should properly encode for HTML attributes', () => {
      const input = '" onmouseover="alert(\'XSS\')"';
      const encoded = XSSEncoder.attribute(input);
      
      expect(encoded).toBe('&quot; onmouseover&#x3D;&quot;alert(&#x27;XSS&#x27;)&quot;');
      expect(encoded).not.toContain('"');
    });
  });

  describe('URL Sanitization', () => {
    it('should block dangerous URL protocols', () => {
      const dangerousURLs = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
        'file:///etc/passwd',
        'blob:https://example.com/uuid',
      ];

      dangerousURLs.forEach(url => {
        const sanitized = xssProtection.sanitizeURL(url);
        expect(sanitized).toBe('');
      });
    });

    it('should allow safe URLs', () => {
      const safeURLs = [
        'https://example.com',
        'http://example.com',
        '/relative/path',
        'relative/path',
        '../parent/path',
      ];

      safeURLs.forEach(url => {
        const sanitized = xssProtection.sanitizeURL(url);
        expect(sanitized).not.toBe('');
        expect(sanitized).toBe(encodeURIComponent(url));
      });
    });
  });

  describe('String Sanitization', () => {
    it('should remove null bytes', () => {
      const input = 'Hello\x00World';
      const sanitized = xssProtection.sanitizeString(input);
      expect(sanitized).toBe('HelloWorld');
    });

    it('should remove unicode direction override characters', () => {
      const input = 'Hello\u202EWorld';
      const sanitized = xssProtection.sanitizeString(input);
      expect(sanitized).toBe('HelloWorld');
    });

    it('should remove template expressions', () => {
      const input = 'Hello {{evil}} World';
      const sanitized = xssProtection.sanitizeString(input);
      expect(sanitized).toBe('Hello  World');
    });

    it('should normalize whitespace', () => {
      const input = 'Hello\r\n\t\tWorld';
      const sanitized = xssProtection.sanitizeString(input);
      expect(sanitized).toBe('Hello World');
    });
  });

  describe('Object Sanitization', () => {
    it('should recursively sanitize object properties', () => {
      const input = {
        name: '<script>alert("XSS")</script>',
        nested: {
          value: 'Hello {{injection}} World',
          array: ['<img onerror="alert(\'XSS\')">'],
        },
      };

      const sanitized = xssProtection.sanitizeInput(input) as any;
      
      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.nested.value).not.toContain('{{');
      expect(sanitized.nested.array[0]).not.toContain('onerror');
    });

    it('should skip dangerous object keys', () => {
      const input = {
        safe: 'value',
        document: 'dangerous',
        window: 'dangerous',
        location: 'dangerous',
      };

      const sanitized = xssProtection.sanitizeInput(input) as any;
      
      expect(sanitized.safe).toBe('value');
      expect(sanitized.document).toBeUndefined();
      expect(sanitized.window).toBeUndefined();
      expect(sanitized.location).toBeUndefined();
    });
  });

  describe('Zod Schema Integration', () => {
    it('should sanitize strings through schema', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const result = XSSSchemas.safeString.parse(input);
      
      expect(result).not.toContain('<script>');
      expect(result).toBe('Hello <script>alert("XSS")</script> World');
    });

    it('should sanitize HTML content through schema', () => {
      const input = '<p>Hello</p><script>alert("XSS")</script>';
      const result = XSSSchemas.htmlContent.parse(input);
      
      expect(result).toContain('<p>Hello</p>');
      expect(result).not.toContain('<script>');
    });

    it('should validate and sanitize URLs through schema', () => {
      const safeURL = 'https://example.com';
      const dangerousURL = 'javascript:alert("XSS")';
      
      expect(XSSSchemas.safeURL.parse(safeURL)).toBe(encodeURIComponent(safeURL));
      expect(XSSSchemas.safeURL.parse(dangerousURL)).toBe('');
    });

    it('should validate safe identifiers', () => {
      expect(() => XSSSchemas.safeId.parse('valid-id_123')).not.toThrow();
      expect(() => XSSSchemas.safeId.parse('invalid<id>')).toThrow();
      expect(() => XSSSchemas.safeId.parse('../../etc/passwd')).toThrow();
    });
  });

  describe('CSP Generation', () => {
    it('should generate secure CSP headers', () => {
      const csp = xssProtection.generateCSP({
        nonce: 'test-nonce',
        reportUri: '/csp-report',
        upgradeInsecureRequests: true,
      });

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'nonce-test-nonce'");
      expect(csp).toContain("frame-src 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain('report-uri /csp-report');
    });
  });

  describe('Sanitization Levels', () => {
    const htmlWithVariousTags = `
      <div class="container">
        <h1>Title</h1>
        <p>Paragraph with <strong>bold</strong> and <em>italic</em></p>
        <script>alert("XSS")</script>
        <iframe src="evil.com"></iframe>
        <table><tr><td>Cell</td></tr></table>
        <style>body { color: red; }</style>
        <form action="submit"><input type="text"></form>
      </div>
    `;

    it('should apply strict sanitization', () => {
      const sanitized = xssProtection.sanitizeHTML(htmlWithVariousTags, 'strict');
      
      expect(sanitized).toContain('<h1>Title</h1>');
      expect(sanitized).toContain('<strong>bold</strong>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<iframe>');
      expect(sanitized).not.toContain('<table>');
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('<form>');
    });

    it('should apply moderate sanitization', () => {
      const sanitized = xssProtection.sanitizeHTML(htmlWithVariousTags, 'moderate');
      
      expect(sanitized).toContain('<h1>Title</h1>');
      expect(sanitized).toContain('<strong>bold</strong>');
      expect(sanitized).toContain('<table>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<iframe>');
      expect(sanitized).not.toContain('<form>');
    });

    it('should apply minimal sanitization', () => {
      const sanitized = xssProtection.sanitizeHTML(htmlWithVariousTags, 'minimal');
      
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>bold</strong>');
      expect(sanitized).not.toContain('<h1>');
      expect(sanitized).not.toContain('<div>');
      expect(sanitized).not.toContain('<table>');
      expect(sanitized).not.toContain('<script>');
    });
  });
});