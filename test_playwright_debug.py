from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    # Launch browser with console logging
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Capture console messages
    console_messages = []
    page.on("console", lambda msg: console_messages.append({
        "type": msg.type,
        "text": msg.text,
        "location": msg.location
    }))
    
    # Capture page errors
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    
    try:
        # Navigate to localhost:5173
        print('Navigating to http://localhost:5173...')
        response = page.goto('http://localhost:5173', wait_until='networkidle', timeout=15000)
        
        print(f'Response status: {response.status if response else "No response"}')
        
        # Wait a bit
        page.wait_for_timeout(3000)
        
        # Print console messages
        print('\nConsole messages:')
        for msg in console_messages:
            print(f"  [{msg['type']}] {msg['text']}")
        
        # Print page errors
        if page_errors:
            print('\nPage errors:')
            for error in page_errors:
                print(f"  {error}")
        
        # Get page content
        print('\nPage content:')
        body_content = page.evaluate('() => document.body.innerHTML')
        print(f"  Body HTML length: {len(body_content)} chars")
        print(f"  First 500 chars: {body_content[:500]}")
        
        # Check if React root exists
        react_root = page.query_selector('#root')
        if react_root:
            root_content = react_root.inner_html()
            print(f"\n#root content length: {len(root_content)} chars")
            print(f"  First 200 chars: {root_content[:200]}")
        
        # Check for any rendered components
        print('\nChecking for rendered components...')
        components = page.evaluate('''
            () => {
                const checks = {
                    header: !!document.querySelector('.app-header, header'),
                    sidebar: !!document.querySelector('.sidebar, nav'),
                    main: !!document.querySelector('main, .main-content'),
                    chat: !!document.querySelector('.chat-interface, .chat'),
                    router: !!document.querySelector('[class*="router"], [id*="router"]')
                };
                return checks;
            }
        ''')
        print(f"  Component checks: {json.dumps(components, indent=2)}")
        
        # Take screenshot
        page.screenshot(path='debug_screenshot.png', full_page=True)
        print('\nDebug screenshot saved as debug_screenshot.png')
        
    except Exception as e:
        print(f'\nError: {e}')
        import traceback
        traceback.print_exc()
    
    finally:
        browser.close()
        print('\nBrowser closed')