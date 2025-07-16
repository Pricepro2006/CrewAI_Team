import asyncio
from playwright.async_api import async_playwright
import json

async def debug_crewai_chat():
    async with async_playwright() as p:
        # Launch browser with console logging
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Capture console messages
        console_messages = []
        page.on('console', lambda msg: console_messages.append(f'{msg.type}: {msg.text}'))
        
        # Capture network requests
        network_logs = []
        page.on('request', lambda req: network_logs.append(f'REQUEST: {req.method} {req.url}'))
        page.on('response', lambda res: network_logs.append(f'RESPONSE: {res.status} {res.url}'))
        
        print('🔍 Debug Mode: CrewAI Chat Interface')
        print('=' * 60)
        
        try:
            # Navigate
            print('\nNavigating to application...')
            await page.goto('http://localhost:5173', wait_until='networkidle')
            await page.wait_for_timeout(2000)
            
            # Check initial state
            print('\n📋 Initial page state:')
            url = page.url
            print(f'   URL: {url}')
            
            # Find textarea
            textarea = await page.query_selector('textarea')
            if textarea:
                print('   ✅ Textarea found')
                
                # Type message
                await textarea.click()
                await textarea.fill('Research the latest trends in AI agent architectures')
                
                # Find send button
                send_button = await page.query_selector('button:has(svg)')
                if send_button:
                    print('   ✅ Send button found')
                    
                    # Click and wait
                    await send_button.click()
                    print('\n⏳ Waiting for response...')
                    await page.wait_for_timeout(5000)
                    
                    # Check final state
                    print('\n📋 Final page state:')
                    final_url = page.url
                    print(f'   URL: {final_url}')
                    
                    if final_url != url:
                        print('   ⚠️  URL changed! Possible redirect')
                        print(f'   From: {url}')
                        print(f'   To: {final_url}')
                    
                    # Check for visible elements
                    visible_text = await page.inner_text('body')
                    if len(visible_text.strip()) < 50:
                        print('   ⚠️  Page appears empty')
                    else:
                        print(f'   ✅ Page has content ({len(visible_text)} chars)')
                        
                        # Check for specific content
                        if 'research' in visible_text.lower():
                            print('   ✅ User message visible')
                        if 'multi-agent' in visible_text.lower():
                            print('   ✅ Agent response visible')
                        if 'error' in visible_text.lower():
                            print('   ⚠️  Error message detected')
                    
                    # Take screenshot
                    await page.screenshot(path='/tmp/crewai_debug_final.png', full_page=True)
                    print('\n📸 Screenshot saved: /tmp/crewai_debug_final.png')
            
            # Print console messages
            if console_messages:
                print('\n🖥️  Console messages:')
                for msg in console_messages[-10:]:  # Last 10 messages
                    print(f'   {msg}')
            else:
                print('\n🖥️  No console messages captured')
            
            # Print network activity
            print('\n🌐 Network activity (last 15):')
            for log in network_logs[-15:]:
                print(f'   {log}')
                
        except Exception as e:
            print(f'\n❌ Error: {e}')
            import traceback
            traceback.print_exc()
            
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(debug_crewai_chat())