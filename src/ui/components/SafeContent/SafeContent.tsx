/**
 * SafeContent Component
 * Renders content with XSS protection using DOMPurify
 */

import React from 'react';
import DOMPurify from 'dompurify';

export type SanitizationLevel = 'strict' | 'moderate' | 'minimal';

interface SafeContentProps {
  content: string;
  level?: SanitizationLevel;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * DOMPurify configurations for different sanitization levels
 */
const PURIFY_CONFIGS = {
  strict: {
    ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                   'blockquote', 'code', 'pre', 'em', 'strong', 'u', 's', 'strike',
                   'ul', 'ol', 'li', 'hr', 'a', 'img'],
    ALLOWED_ATTR: ['class', 'id', 'href', 'src', 'alt', 'title', 'target'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  },
  moderate: {
    ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'blockquote', 'code', 'pre', 'em', 'strong', 'u', 's', 'strike',
                   'ul', 'ol', 'li', 'hr', 'a', 'img', 'table', 'thead', 'tbody',
                   'tr', 'td', 'th', 'caption', 'col', 'colgroup'],
    ALLOWED_ATTR: ['class', 'id', 'href', 'src', 'alt', 'title', 'target', 'style',
                   'width', 'height', 'colspan', 'rowspan'],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  },
  minimal: {
    ALLOWED_TAGS: ['p', 'br', 'em', 'strong'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  },
};

/**
 * SafeContent component for rendering sanitized HTML content
 */
export const SafeContent: React.FC<SafeContentProps> = ({
  content,
  level = 'strict',
  className,
  as: Component = 'div',
}) => {
  const sanitizedContent = React.useMemo(() => {
    if (!content || typeof content !== 'string') return '';
    
    const config = PURIFY_CONFIGS[level];
    return DOMPurify.sanitize(content, config);
  }, [content, level]);

  return (
    <Component 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

/**
 * Hook for sanitizing content
 */
export const useSanitize = (content: string, level: SanitizationLevel = 'strict'): string => {
  return React.useMemo(() => {
    if (!content || typeof content !== 'string') return '';
    
    const config = PURIFY_CONFIGS[level];
    return DOMPurify.sanitize(content, config);
  }, [content, level]);
};

/**
 * Safe text component (no HTML parsing)
 */
export const SafeText: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className 
}) => {
  const text = String(children || '');
  
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return <span className={className}>{escaped}</span>;
};

/**
 * Safe link component with URL validation
 */
export const SafeLink: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
  rel?: string;
}> = ({ href, children, className, target, rel }) => {
  const safeHref = React.useMemo(() => {
    if (!href || typeof href !== 'string') return '#';
    
    // Check for dangerous protocols
    const dangerousProtocols = /^(javascript|data|vbscript|blob|file):/i;
    if (dangerousProtocols.test(href.trim())) {
      console.warn('Dangerous URL protocol detected:', href);
      return '#';
    }
    
    // Validate URL
    try {
      const url = new URL(href, window.location.origin);
      // Only allow http(s) and relative URLs
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return '#';
      }
      return href;
    } catch {
      // If not a valid URL, treat as relative path
      return href.startsWith('/') ? href : `/${href}`;
    }
  }, [href]);

  // Ensure rel includes security attributes for external links
  const safeRel = React.useMemo(() => {
    const rels = new Set(rel?.split(' ') || []);
    if (target === '_blank') {
      rels.add('noopener');
      rels.add('noreferrer');
    }
    return Array.from(rels).join(' ') || undefined;
  }, [rel, target]);

  return (
    <a 
      href={safeHref} 
      className={className}
      target={target}
      rel={safeRel}
    >
      {children}
    </a>
  );
};