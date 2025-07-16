from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    # Launch browser in headless mode
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    try:
        # Navigate to localhost:5173
        print('Navigating to http://localhost:5173...')
        response = page.goto('http://localhost:5173', wait_until='domcontentloaded', timeout=15000)
        
        print(f'Response status: {response.status if response else "No response"}')
        
        # Wait for React app to fully load
        print('Waiting for React app to initialize...')
        page.wait_for_timeout(5000)
        
        # Take initial screenshot
        page.screenshot(path='working_screenshot.png', full_page=True)
        print('Screenshot saved as working_screenshot.png')
        
        # Get page title
        print(f'Page title: {page.title()}')
        
        # Try to navigate to chat page directly
        print('\nNavigating to /chat route...')
        page.goto('http://localhost:5173/chat', wait_until='domcontentloaded')
        page.wait_for_timeout(2000)
        
        # Take screenshot of chat page
        page.screenshot(path='chat_page_screenshot.png', full_page=True)
        print('Chat page screenshot saved as chat_page_screenshot.png')
        
        # Look for input elements
        print('\nSearching for chat input elements...')
        
        # Try various selectors
        selectors = [
            'textarea',
            'input[type="text"]',
            '[placeholder*="message" i]',
            '[placeholder*="type" i]',
            '[placeholder*="send" i]',
            '[placeholder*="chat" i]',
            '.input-textarea',
            '#message-input',
            '[data-testid="chat-input"]'
        ]
        
        found_input = False
        for selector in selectors:
            elements = page.query_selector_all(selector)
            for elem in elements:
                if elem.is_visible():
                    print(f'Found visible element with selector: {selector}')
                    
                    # Get element details
                    tag = elem.evaluate('el => el.tagName')
                    placeholder = elem.get_attribute('placeholder') or ''
                    class_name = elem.get_attribute('class') or ''
                    
                    print(f'  Tag: {tag}')
                    print(f'  Placeholder: {placeholder}')
                    print(f'  Class: {class_name}')
                    
                    try:
                        # Click and type
                        elem.click()
                        print('  Clicked on element')
                        
                        message = 'Research the latest trends in AI agent architectures and create a summary report'
                        elem.fill(message)
                        print(f'  Typed message: {message[:50]}...')
                        
                        # Look for send button
                        send_buttons = page.query_selector_all('button')
                        for btn in send_buttons:
                            btn_text = btn.text_content() or ''
                            if 'send' in btn_text.lower() or btn.query_selector('.send-icon'):
                                btn.click()
                                print('  Clicked send button')
                                break
                        else:
                            # Try Enter key
                            page.keyboard.press('Enter')
                            print('  Pressed Enter key')
                        
                        # Wait for response
                        print('  Waiting for response...')
                        page.wait_for_timeout(5000)
                        
                        # Take final screenshot
                        page.screenshot(path='after_message_screenshot.png', full_page=True)
                        print('  Screenshot saved as after_message_screenshot.png')
                        
                        found_input = True
                        break
                    except Exception as e:
                        print(f'  Error: {e}')
            
            if found_input:
                break
        
        if not found_input:
            print('\nNo chat input found. Listing all visible elements...')
            
            # Get all visible text elements
            visible_elements = page.evaluate('''
                () => {
                    const elements = [];
                    document.querySelectorAll('*').forEach(el => {
                        if (el.offsetWidth > 0 && el.offsetHeight > 0 && el.textContent.trim()) {
                            elements.push({
                                tag: el.tagName,
                                text: el.textContent.trim().substring(0, 100),
                                class: el.className
                            });
                        }
                    });
                    return elements.slice(0, 20); // First 20 visible elements
                }
            ''')
            
            for elem in visible_elements:
                print(f'  {elem["tag"]}.{elem["class"]}: {elem["text"][:50]}...')
    
    except Exception as e:
        print(f'\nError: {e}')
        import traceback
        traceback.print_exc()
        
        # Take error screenshot
        try:
            page.screenshot(path='error_final_screenshot.png', full_page=True)
            print('Error screenshot saved')
        except:
            pass
    
    finally:
        browser.close()
        print('\nBrowser closed')