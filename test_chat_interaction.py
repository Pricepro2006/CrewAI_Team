from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    # Launch browser in headless mode
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    try:
        # Navigate to localhost:5173
        print('Navigating to http://localhost:5173...')
        page.goto('http://localhost:5173', wait_until='networkidle', timeout=15000)
        
        # Wait for React app to load
        page.wait_for_timeout(3000)
        
        # Take initial screenshot
        page.screenshot(path='chat_loaded.png', full_page=True)
        print('Initial screenshot saved as chat_loaded.png')
        
        # Find the chat input field
        print('\nLooking for chat input field...')
        
        # Try to find the input by placeholder or textarea
        input_field = page.query_selector('textarea, [placeholder*="Type your message"]')
        
        if input_field and input_field.is_visible():
            print('Found chat input field!')
            
            # Click on the input field
            input_field.click()
            print('Clicked on input field')
            
            # Type the message
            message = 'Research the latest trends in AI agent architectures and create a summary report'
            input_field.fill(message)
            print(f'Typed message: "{message}"')
            
            # Take screenshot after typing
            page.screenshot(path='message_typed.png', full_page=True)
            print('Screenshot after typing saved as message_typed.png')
            
            # Find and click the send button
            send_button = page.query_selector('button:has(.send-icon), button:has(svg), button[title*="Send"], button >> text=/send/i')
            if not send_button:
                # Try to find any button near the input
                buttons = page.query_selector_all('button')
                if buttons:
                    send_button = buttons[-1]  # Get the last button
            
            if send_button:
                send_button.click()
                print('Clicked send button')
            else:
                # Try pressing Enter
                page.keyboard.press('Enter')
                print('Pressed Enter key')
            
            # Wait for potential response
            print('\nWaiting for response...')
            page.wait_for_timeout(5000)
            
            # Take final screenshot
            page.screenshot(path='final_result.png', full_page=True)
            print('Final screenshot saved as final_result.png')
            
            # Check if there are any messages in the chat
            messages = page.query_selector_all('.message, [class*="message"]')
            print(f'\nFound {len(messages)} message elements')
            
            for i, msg in enumerate(messages[:5]):  # Show first 5 messages
                text = msg.text_content()
                if text:
                    print(f'Message {i+1}: {text[:100]}...')
            
            # Check for any error messages
            errors = page.query_selector_all('.error, [class*="error"]')
            if errors:
                print(f'\nFound {len(errors)} error elements')
                for error in errors:
                    error_text = error.text_content()
                    if error_text:
                        print(f'Error: {error_text}')
        else:
            print('Could not find chat input field!')
            
            # List all input elements for debugging
            all_inputs = page.query_selector_all('input, textarea')
            print(f'\nFound {len(all_inputs)} input elements:')
            for inp in all_inputs:
                if inp.is_visible():
                    placeholder = inp.get_attribute('placeholder') or 'No placeholder'
                    print(f'  - {inp.evaluate("el => el.tagName")}: {placeholder}')
    
    except Exception as e:
        print(f'\nError: {e}')
        import traceback
        traceback.print_exc()
    
    finally:
        browser.close()
        print('\nBrowser closed')