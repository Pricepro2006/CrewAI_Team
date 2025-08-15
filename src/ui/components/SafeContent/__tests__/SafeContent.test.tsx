/**
 * Tests for SafeContent React components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SafeContent, SafeText, SafeLink, useSanitize } from '../SafeContent.js';
import { renderHook } from '@testing-library/react';

// Mock DOMPurify for consistent test results
vi.mock('dompurify', () => ({
  default: {
    sanitize: (content: string, config: any) => {
      // Simple mock implementation for testing
      let result = content;
      
      // Remove script tags
      result = result.replace(/<script[^>]*>.*?<\/script>/gi, '');
      
      // Remove event handlers
      result = result.replace(/\son\w+\s*=/gi, '');
      
      // Remove dangerous protocols
      result = result.replace(/javascript:/gi, '');
      result = result.replace(/data:/gi, '');
      
      // Apply tag restrictions based on config
      if (config.FORBID_TAGS) {
        config.FORBID_TAGS.forEach((tag: string) => {
          const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
          result = result.replace(regex, '');
        });
      }
      
      return result;
    },
  },
}));

describe('SafeContent Component', () => {
  describe('Basic rendering', () => {
    it('should render safe HTML content', () => {
      render(
        <SafeContent content="<p>Hello <strong>World</strong></p>" />
      );
      
      expect(screen.getByText('World')).toBeInTheDocument();
      const strong = screen.getByText('World');
      expect(strong.tagName).toBe('STRONG');
    });

    it('should remove script tags', () => {
      const { container } = render(
        <SafeContent content='<p>Hello</p><script>alert("XSS")</script>' />
      );
      
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(container.innerHTML).not.toContain('<script>');
      expect(container.innerHTML).not.toContain('alert');
    });

    it('should remove event handlers', () => {
      const { container } = render(
        <SafeContent content={`<div onclick="alert('XSS')">Click me</div>`} />
      );
      
      expect(screen.getByText('Click me')).toBeInTheDocument();
      expect(container.innerHTML).not.toContain('onclick');
    });

    it('should handle empty content', () => {
      const { container } = render(
        <SafeContent content="" />
      );
      
      expect(container.firstChild?.textContent).toBe('');
    });

    it('should handle null/undefined content', () => {
      const { container } = render(
        <SafeContent content={null as any} />
      );
      
      expect(container.firstChild?.textContent).toBe('');
    });
  });

  describe('Sanitization levels', () => {
    it('should apply strict sanitization by default', () => {
      const { container } = render(
        <SafeContent content='<p>Text</p><iframe src="evil.com"></iframe>' />
      );
      
      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(container.innerHTML).not.toContain('<iframe');
    });

    it('should apply moderate sanitization when specified', () => {
      const { container } = render(
        <SafeContent 
          content='<table><tr><td>Cell</td></tr></table><script>alert("XSS")</script>' 
          level="moderate"
        />
      );
      
      expect(screen.getByText('Cell')).toBeInTheDocument();
      expect(container.innerHTML).toContain('<table>');
      expect(container.innerHTML).not.toContain('<script>');
    });

    it('should apply minimal sanitization when specified', () => {
      const { container } = render(
        <SafeContent 
          content='<p>Text</p><div>More</div><h1>Title</h1>' 
          level="minimal"
        />
      );
      
      expect(container.innerHTML).toContain('<p>');
      // In minimal mode, div and h1 might be stripped
    });
  });

  describe('Custom element rendering', () => {
    it('should render as specified element', () => {
      const { container } = render(
        <SafeContent content="<p>Content</p>" as="section" />
      );
      
      expect(container.firstChild?.nodeName).toBe('SECTION');
    });

    it('should apply className', () => {
      render(
        <SafeContent content="<p>Content</p>" className="custom-class" />
      );
      
      const element = screen.getByText('Content').parentElement;
      expect(element).toHaveClass('custom-class');
    });
  });
});

describe('SafeText Component', () => {
  it('should escape HTML entities', () => {
    const { container } = render(
      <SafeText>{'<script>alert("XSS")</script>'}</SafeText>
    );
    
    expect(container.innerHTML).toContain('&lt;script&gt;');
    expect(container.innerHTML).toContain('&quot;');
    expect(container.innerHTML).not.toContain('<script>');
  });

  it('should handle special characters', () => {
    const { container } = render(
      <SafeText>{'<>&"\'/='}</SafeText>
    );
    
    expect(container.innerHTML).toContain('&lt;');
    expect(container.innerHTML).toContain('&gt;');
    expect(container.innerHTML).toContain('&amp;');
    expect(container.innerHTML).toContain('&quot;');
    expect(container.innerHTML).toContain('&#x27;');
    expect(container.innerHTML).toContain('&#x2F;');
    expect(container.innerHTML).toContain('&#x3D;');
  });

  it('should apply className', () => {
    render(
      <SafeText className="text-class">Text content</SafeText>
    );
    
    expect(screen.getByText('Text content')).toHaveClass('text-class');
  });
});

describe('SafeLink Component', () => {
  it('should render safe URLs', () => {
    render(
      <SafeLink href="https://example.com">Safe Link</SafeLink>
    );
    
    const link = screen.getByText('Safe Link') as HTMLAnchorElement;
    expect(link.href).toBe('https://example.com/');
  });

  it('should block javascript: URLs', () => {
    // Mock console.warn for this test
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(
      <SafeLink href="javascript:alert('XSS')">Bad Link</SafeLink>
    );
    
    const link = screen.getByText('Bad Link') as HTMLAnchorElement;
    expect(link.href).toMatch(/#$/);
    expect(warnSpy).toHaveBeenCalledWith(
      'Dangerous URL protocol detected:',
      expect.any(String)
    );
    
    warnSpy.mockRestore();
  });

  it('should block data: URLs', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(
      <SafeLink href="data:text/html,<script>alert('XSS')</script>">Data Link</SafeLink>
    );
    
    const link = screen.getByText('Data Link') as HTMLAnchorElement;
    expect(link.href).toMatch(/#$/);
    
    warnSpy.mockRestore();
  });

  it('should handle relative URLs', () => {
    render(
      <SafeLink href="/relative/path">Relative Link</SafeLink>
    );
    
    const link = screen.getByText('Relative Link') as HTMLAnchorElement;
    expect(link.pathname).toBe('/relative/path');
  });

  it('should add security attributes for external links', () => {
    render(
      <SafeLink href="https://external.com" target="_blank">External Link</SafeLink>
    );
    
    const link = screen.getByText('External Link') as HTMLAnchorElement;
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
  });

  it('should preserve existing rel attributes', () => {
    render(
      <SafeLink href="https://example.com" target="_blank" rel="author">Author Link</SafeLink>
    );
    
    const link = screen.getByText('Author Link') as HTMLAnchorElement;
    expect(link.rel).toContain('author');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
  });

  it('should apply className', () => {
    render(
      <SafeLink href="https://example.com" className="link-class">Styled Link</SafeLink>
    );
    
    expect(screen.getByText('Styled Link')).toHaveClass('link-class');
  });
});

describe('useSanitize Hook', () => {
  it('should sanitize content with default level', () => {
    const { result } = renderHook(() => 
      useSanitize('<p>Hello</p><script>alert("XSS")</script>')
    );
    
    expect(result.current).toContain('<p>Hello</p>');
    expect(result.current).not.toContain('<script>');
  });

  it('should sanitize content with specified level', () => {
    const { result } = renderHook(() => 
      useSanitize(
        '<table><tr><td>Data</td></tr></table><script>alert("XSS")</script>',
        'moderate'
      )
    );
    
    expect(result.current).toContain('<table>');
    expect(result.current).not.toContain('<script>');
  });

  it('should memoize sanitized content', () => {
    const { result, rerender } = renderHook(
      ({ content, level }) => useSanitize(content, level),
      {
        initialProps: {
          content: '<p>Test</p>',
          level: 'strict' as const,
        },
      }
    );
    
    const firstResult = result.current;
    
    // Re-render with same props
    rerender({ content: '<p>Test</p>', level: 'strict' });
    
    expect(result.current).toBe(firstResult);
  });

  it('should update when content changes', () => {
    const { result, rerender } = renderHook(
      ({ content }) => useSanitize(content),
      {
        initialProps: { content: '<p>First</p>' },
      }
    );
    
    expect(result.current).toContain('First');
    
    rerender({ content: '<p>Second</p>' });
    
    expect(result.current).toContain('Second');
    expect(result.current).not.toContain('First');
  });
});