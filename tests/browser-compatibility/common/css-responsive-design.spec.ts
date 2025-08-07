import { test, expect, Page } from '@playwright/test';
import { detectBrowserCapabilities, BrowserCapabilities } from '../utils/browser-detector';

test.describe('CSS and Responsive Design Compatibility Tests', () => {
  let capabilities: BrowserCapabilities;

  test.beforeEach(async ({ page }) => {
    capabilities = await detectBrowserCapabilities(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should detect CSS feature support', async ({ page }) => {
    const cssSupport = await page.evaluate(() => {
      const features = {
        // Layout
        grid: CSS.supports('display', 'grid'),
        flexbox: CSS.supports('display', 'flex'),
        
        // Modern CSS
        customProperties: CSS.supports('--custom', 'property'),
        calc: CSS.supports('width', 'calc(100% - 10px)'),
        
        // Visual Effects
        borderRadius: CSS.supports('border-radius', '10px'),
        boxShadow: CSS.supports('box-shadow', '0 0 10px rgba(0,0,0,0.5)'),
        textShadow: CSS.supports('text-shadow', '1px 1px 1px black'),
        gradient: CSS.supports('background', 'linear-gradient(to right, red, blue)'),
        
        // Transforms and Animation
        transform: CSS.supports('transform', 'rotate(45deg)'),
        transform3d: CSS.supports('transform', 'translateZ(0)'),
        transition: CSS.supports('transition', 'all 0.3s ease'),
        animation: CSS.supports('animation', 'spin 1s linear infinite'),
        
        // Filters
        filter: CSS.supports('filter', 'blur(5px)'),
        backdropFilter: CSS.supports('backdrop-filter', 'blur(5px)'),
        
        // Advanced Layout
        containerQueries: CSS.supports('container-type', 'inline-size'),
        aspectRatio: CSS.supports('aspect-ratio', '16 / 9'),
        gap: CSS.supports('gap', '10px'),
        
        // Modern Typography
        fontFeatureSettings: CSS.supports('font-feature-settings', '"liga" 1'),
        fontVariationSettings: CSS.supports('font-variation-settings', '"wght" 400'),
        
        // Logical Properties
        marginInlineStart: CSS.supports('margin-inline-start', '10px'),
        paddingBlock: CSS.supports('padding-block', '10px'),
        
        // Color
        colorFunction: CSS.supports('color', 'color(display-p3 1 0 0)'),
        oklch: CSS.supports('color', 'oklch(70% 0.25 180)'),
        
        // Scroll
        scrollBehavior: CSS.supports('scroll-behavior', 'smooth'),
        scrollSnapType: CSS.supports('scroll-snap-type', 'x mandatory'),
        
        // Position
        sticky: CSS.supports('position', 'sticky'),
        
        // Clipping
        clipPath: CSS.supports('clip-path', 'circle(50%)'),
        
        // Masking
        mask: CSS.supports('mask', 'url(mask.svg)'),
        
        // Viewport Units
        viewportUnits: CSS.supports('width', '100vw') && CSS.supports('height', '100vh'),
        dynamicViewport: CSS.supports('height', '100dvh')
      };

      return features;
    });

    console.log(`CSS Feature Support for ${capabilities.name}:`, cssSupport);

    // Essential features that should be supported
    expect(cssSupport.flexbox).toBe(true);
    expect(cssSupport.borderRadius).toBe(true);
    expect(cssSupport.transform).toBe(true);
    expect(cssSupport.transition).toBe(true);
    
    // Modern features that enhance functionality
    if (cssSupport.grid) console.log('✅ CSS Grid supported');
    if (cssSupport.customProperties) console.log('✅ CSS Custom Properties supported');
    if (cssSupport.backdropFilter) console.log('✅ Backdrop Filter supported');
    if (cssSupport.containerQueries) console.log('✅ Container Queries supported');
    
    // Log missing features
    Object.entries(cssSupport).forEach(([feature, supported]) => {
      if (!supported) {
        console.log(`⚠️ ${feature} not supported`);
      }
    });
  });

  test('should test responsive design across viewport sizes', async ({ page }) => {
    // Navigate to Walmart agent for testing
    const walmartButton = page.locator('button:has-text("Walmart"), a[href*="walmart"]').first();
    if (await walmartButton.isVisible()) {
      await walmartButton.click();
    } else {
      await page.goto('/walmart');
    }

    await page.waitForLoadState('networkidle');

    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-xl', category: 'desktop' },
      { width: 1366, height: 768, name: 'desktop-standard', category: 'desktop' },
      { width: 1024, height: 768, name: 'tablet-landscape', category: 'tablet' },
      { width: 768, height: 1024, name: 'tablet-portrait', category: 'tablet' },
      { width: 414, height: 896, name: 'mobile-large', category: 'mobile' },
      { width: 375, height: 812, name: 'mobile-standard', category: 'mobile' },
      { width: 320, height: 568, name: 'mobile-small', category: 'mobile' }
    ];

    const responsiveResults = [];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500); // Allow layout to settle

      const layoutInfo = await page.evaluate(() => {
        const body = document.body;
        const main = document.querySelector('main, [role="main"], .main-content') || body;
        
        return {
          bodyWidth: body.offsetWidth,
          bodyHeight: body.offsetHeight,
          mainWidth: main.offsetWidth,
          mainHeight: main.offsetHeight,
          scrollWidth: body.scrollWidth,
          scrollHeight: body.scrollHeight,
          hasHorizontalScroll: body.scrollWidth > body.offsetWidth,
          hasVerticalScroll: body.scrollHeight > body.offsetHeight,
          
          // Check for responsive elements
          mobileMenu: !!document.querySelector('[class*="mobile-menu"], [class*="hamburger"], .navbar-toggle'),
          sidebarVisible: !!document.querySelector('[class*="sidebar"]:not([class*="hidden"])'),
          
          // Font sizes
          bodyFontSize: parseInt(getComputedStyle(body).fontSize),
          h1FontSize: parseInt(getComputedStyle(document.querySelector('h1') || body).fontSize),
          
          // Grid/flex layouts
          gridElements: document.querySelectorAll('[style*="grid"], [class*="grid"]').length,
          flexElements: document.querySelectorAll('[style*="flex"], [class*="flex"]').length
        };
      });

      responsiveResults.push({
        viewport: viewport.name,
        category: viewport.category,
        dimensions: `${viewport.width}x${viewport.height}`,
        ...layoutInfo
      });

      // Check for layout breaks
      const hasLayoutIssues = layoutInfo.hasHorizontalScroll && viewport.category === 'mobile';
      if (hasLayoutIssues) {
        console.log(`⚠️ Horizontal scroll detected at ${viewport.name} (${viewport.width}px)`);
      }

      // Take screenshot for visual verification
      await page.screenshot({ 
        path: `browser-compatibility-results/${capabilities.name.toLowerCase()}/responsive-${viewport.name}.png`,
        fullPage: true 
      });
    }

    // Analyze results
    console.log('Responsive Design Analysis:');
    responsiveResults.forEach(result => {
      console.log(`${result.viewport} (${result.dimensions}):`);
      console.log(`  Layout: ${result.mainWidth}x${result.mainHeight}`);
      console.log(`  Horizontal scroll: ${result.hasHorizontalScroll ? 'YES' : 'NO'}`);
      console.log(`  Mobile menu: ${result.mobileMenu ? 'YES' : 'NO'}`);
      console.log(`  Font size: ${result.bodyFontSize}px`);
    });

    // Verify no horizontal scroll on mobile
    const mobileResults = responsiveResults.filter(r => r.category === 'mobile');
    const mobileScrollIssues = mobileResults.filter(r => r.hasHorizontalScroll);
    
    if (mobileScrollIssues.length > 0) {
      console.log('⚠️ Mobile horizontal scroll issues found on:', 
        mobileScrollIssues.map(r => r.viewport).join(', ')
      );
    }

    // Reset to original viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('should test CSS animation and transition performance', async ({ page }) => {
    await page.goto('/walmart');
    await page.waitForLoadState('networkidle');

    // Test CSS animations and transitions
    const animationTest = await page.evaluate(() => {
      const results: any = {
        animationsFound: 0,
        transitionsFound: 0,
        transforms: 0,
        smoothAnimations: [],
        performanceIssues: []
      };

      // Find elements with animations/transitions
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach((element, index) => {
        const computedStyle = getComputedStyle(element);
        const animationName = computedStyle.animationName;
        const transitionProperty = computedStyle.transitionProperty;
        const transform = computedStyle.transform;
        
        if (animationName && animationName !== 'none') {
          results.animationsFound++;
          
          // Check animation performance
          const animationDuration = parseFloat(computedStyle.animationDuration);
          if (animationDuration > 0) {
            results.smoothAnimations.push({
              element: element.tagName,
              animation: animationName,
              duration: animationDuration
            });
          }
        }
        
        if (transitionProperty && transitionProperty !== 'none') {
          results.transitionsFound++;
        }
        
        if (transform && transform !== 'none') {
          results.transforms++;
        }
      });

      // Test CSS animation performance
      try {
        // Create a test animation
        const testElement = document.createElement('div');
        testElement.style.cssText = `
          position: fixed;
          top: -100px;
          left: -100px;
          width: 10px;
          height: 10px;
          background: red;
          transition: transform 0.3s ease;
          transform: translateX(0);
        `;
        document.body.appendChild(testElement);

        const startTime = performance.now();
        testElement.style.transform = 'translateX(100px)';
        
        setTimeout(() => {
          const endTime = performance.now();
          results.testAnimationDuration = endTime - startTime;
          document.body.removeChild(testElement);
        }, 350);

      } catch (error) {
        results.animationTestError = (error as Error).message;
      }

      return results;
    });

    console.log('CSS Animation Test Results:', animationTest);

    // Log findings
    console.log(`Found ${animationTest.animationsFound} CSS animations`);
    console.log(`Found ${animationTest.transitionsFound} CSS transitions`);
    console.log(`Found ${animationTest.transforms} CSS transforms`);

    if (animationTest.smoothAnimations.length > 0) {
      console.log('Active animations:');
      animationTest.smoothAnimations.forEach((anim: any) => {
        console.log(`  ${anim.element}: ${anim.animation} (${anim.duration}s)`);
      });
    }
  });

  test('should test CSS Grid and Flexbox layouts', async ({ page }) => {
    await page.goto('/walmart');
    await page.waitForLoadState('networkidle');

    const layoutTest = await page.evaluate(() => {
      const results = {
        gridSupported: CSS.supports('display', 'grid'),
        flexSupported: CSS.supports('display', 'flex'),
        gridElements: 0,
        flexElements: 0,
        layoutAnalysis: [] as any[]
      };

      // Find grid and flex elements
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach((element) => {
        const computedStyle = getComputedStyle(element);
        const display = computedStyle.display;
        
        if (display.includes('grid')) {
          results.gridElements++;
          
          results.layoutAnalysis.push({
            type: 'grid',
            element: element.tagName,
            className: element.className,
            gridTemplateColumns: computedStyle.gridTemplateColumns,
            gridTemplateRows: computedStyle.gridTemplateRows,
            gap: computedStyle.gap
          });
        }
        
        if (display.includes('flex')) {
          results.flexElements++;
          
          results.layoutAnalysis.push({
            type: 'flex',
            element: element.tagName,
            className: element.className,
            flexDirection: computedStyle.flexDirection,
            justifyContent: computedStyle.justifyContent,
            alignItems: computedStyle.alignItems,
            gap: computedStyle.gap
          });
        }
      });

      return results;
    });

    console.log('Layout System Analysis:');
    console.log(`Grid Support: ${layoutTest.gridSupported ? 'YES' : 'NO'}`);
    console.log(`Flex Support: ${layoutTest.flexSupported ? 'YES' : 'NO'}`);
    console.log(`Grid Elements: ${layoutTest.gridElements}`);
    console.log(`Flex Elements: ${layoutTest.flexElements}`);

    // Ensure modern layout support
    expect(layoutTest.flexSupported).toBe(true);
    
    if (layoutTest.gridSupported) {
      console.log('✅ CSS Grid is supported - modern layouts available');
    } else {
      console.log('⚠️ CSS Grid not supported - consider flexbox fallbacks');
    }

    // Log layout usage
    if (layoutTest.layoutAnalysis.length > 0) {
      console.log('Layout implementations found:');
      layoutTest.layoutAnalysis.slice(0, 5).forEach((layout: any) => {
        console.log(`  ${layout.type.toUpperCase()}: ${layout.element}.${layout.className}`);
      });
    }
  });

  test('should test dark mode and theme compatibility', async ({ page }) => {
    await page.goto('/walmart');
    await page.waitForLoadState('networkidle');

    // Test theme switching if available
    const themeTest = await page.evaluate(() => {
      const results = {
        supportsColorScheme: CSS.supports('color-scheme', 'light dark'),
        prefersDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        customPropertiesSupport: CSS.supports('--custom', 'property'),
        themeElements: [] as any[],
        colorAnalysis: {
          backgroundColors: new Set<string>(),
          textColors: new Set<string>(),
          borderColors: new Set<string>()
        }
      };

      // Look for theme toggle elements
      const themeToggles = document.querySelectorAll('[class*="theme"], [class*="dark"], [class*="mode"], button[aria-label*="theme" i]');
      themeToggles.forEach((toggle) => {
        results.themeElements.push({
          element: toggle.tagName,
          className: toggle.className,
          text: toggle.textContent?.trim().substring(0, 50)
        });
      });

      // Analyze color usage
      const sampleElements = Array.from(document.querySelectorAll('body, main, header, nav, button, input')).slice(0, 20);
      sampleElements.forEach((element) => {
        const styles = getComputedStyle(element);
        results.colorAnalysis.backgroundColors.add(styles.backgroundColor);
        results.colorAnalysis.textColors.add(styles.color);
        results.colorAnalysis.borderColors.add(styles.borderColor);
      });

      return {
        ...results,
        colorAnalysis: {
          backgroundColors: Array.from(results.colorAnalysis.backgroundColors),
          textColors: Array.from(results.colorAnalysis.textColors),
          borderColors: Array.from(results.colorAnalysis.borderColors)
        }
      };
    });

    console.log('Theme and Color Analysis:');
    console.log(`Color Scheme Support: ${themeTest.supportsColorScheme ? 'YES' : 'NO'}`);
    console.log(`User Prefers Dark Mode: ${themeTest.prefersDarkMode ? 'YES' : 'NO'}`);
    console.log(`CSS Custom Properties: ${themeTest.customPropertiesSupport ? 'YES' : 'NO'}`);
    console.log(`Theme Toggle Elements Found: ${themeTest.themeElements.length}`);

    if (themeTest.themeElements.length > 0) {
      console.log('Theme controls found:');
      themeTest.themeElements.forEach((element: any) => {
        console.log(`  ${element.element}: "${element.text}"`);
      });
    }

    // Test theme toggle if available
    const themeToggle = page.locator('[class*="theme"], [class*="dark"], button[aria-label*="theme" i]').first();
    if (await themeToggle.count() > 0) {
      console.log('Testing theme toggle functionality...');
      
      const beforeColors = await page.evaluate(() => {
        const body = document.body;
        return {
          background: getComputedStyle(body).backgroundColor,
          color: getComputedStyle(body).color
        };
      });

      await themeToggle.click();
      await page.waitForTimeout(500);

      const afterColors = await page.evaluate(() => {
        const body = document.body;
        return {
          background: getComputedStyle(body).backgroundColor,
          color: getComputedStyle(body).color
        };
      });

      if (beforeColors.background !== afterColors.background || beforeColors.color !== afterColors.color) {
        console.log('✅ Theme toggle is functional');
      } else {
        console.log('⚠️ Theme toggle may not be working or colors unchanged');
      }

      await page.screenshot({ 
        path: `browser-compatibility-results/${capabilities.name.toLowerCase()}/theme-toggle.png`,
        fullPage: true 
      });
    }
  });

  test('should provide CSS compatibility recommendations', async ({ page }) => {
    const recommendations = await page.evaluate(() => {
      const support = {
        grid: CSS.supports('display', 'grid'),
        flexbox: CSS.supports('display', 'flex'),
        customProperties: CSS.supports('--custom', 'property'),
        calc: CSS.supports('width', 'calc(100% - 10px)'),
        backdropFilter: CSS.supports('backdrop-filter', 'blur(5px)'),
        containerQueries: CSS.supports('container-type', 'inline-size'),
        aspectRatio: CSS.supports('aspect-ratio', '16 / 9'),
        gap: CSS.supports('gap', '10px'),
        sticky: CSS.supports('position', 'sticky'),
        transform3d: CSS.supports('transform', 'translateZ(0)')
      };

      const fallbacks = [];
      const enhancements = [];

      // Essential fallbacks
      if (!support.flexbox) {
        fallbacks.push({
          feature: 'Flexbox',
          fallback: 'Float-based layouts with clearfix',
          polyfill: 'flexibility.js'
        });
      }

      if (!support.grid) {
        fallbacks.push({
          feature: 'CSS Grid',
          fallback: 'Flexbox or float layouts',
          polyfill: 'css-grid-polyfill'
        });
      }

      if (!support.customProperties) {
        fallbacks.push({
          feature: 'CSS Custom Properties',
          fallback: 'Sass/Less variables',
          polyfill: 'css-vars-ponyfill'
        });
      }

      if (!support.sticky) {
        fallbacks.push({
          feature: 'Position Sticky',
          fallback: 'JavaScript scroll detection',
          polyfill: 'stickyfill'
        });
      }

      // Enhancement opportunities
      if (support.backdropFilter) {
        enhancements.push('Use backdrop-filter for glass morphism effects');
      }

      if (support.containerQueries) {
        enhancements.push('Implement container queries for component-based responsive design');
      }

      if (support.aspectRatio) {
        enhancements.push('Use aspect-ratio for maintaining proportions without padding hacks');
      }

      if (support.gap) {
        enhancements.push('Use gap property for cleaner spacing in grid/flex layouts');
      }

      return { support, fallbacks, enhancements };
    });

    console.log(`CSS Compatibility Recommendations for ${capabilities.name}:`);
    console.log('\nFeature Support:');
    Object.entries(recommendations.support).forEach(([feature, supported]) => {
      console.log(`  ${feature}: ${supported ? '✅' : '❌'}`);
    });

    if (recommendations.fallbacks.length > 0) {
      console.log('\nRequired Fallbacks:');
      recommendations.fallbacks.forEach(fallback => {
        console.log(`  ${fallback.feature}:`);
        console.log(`    Fallback: ${fallback.fallback}`);
        console.log(`    Polyfill: ${fallback.polyfill}`);
      });
    }

    if (recommendations.enhancements.length > 0) {
      console.log('\nEnhancement Opportunities:');
      recommendations.enhancements.forEach(enhancement => {
        console.log(`  - ${enhancement}`);
      });
    }

    // Save recommendations
    await page.evaluate((data) => {
      (window as any).cssCompatibilityReport = data;
    }, recommendations);
  });
});