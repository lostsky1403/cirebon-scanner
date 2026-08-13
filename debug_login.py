from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    
    # Enable network logging
    page = context.new_page()
    page.on("request", lambda req: print(f"REQ: {req.method} {req.url}"))
    page.on("response", lambda res: print(f"RES: {res.status} {res.url}"))
    
    print("=== Navigate to login page ===")
    page.goto("https://cpj.supertix.co.id/login")
    page.wait_for_load_state("networkidle")
    
    print("\n=== Page content ===")
    print(page.content()[:2000])
    
    # Fill login form
    print("\n=== Filling form ===")
    page.fill('input[name="username"]', "admin")
    page.fill('input[name="password"]', "a7f78e6a991964d9f92537d9c2936cac")
    
    # Click login and capture response
    print("\n=== Clicking login ===")
    with page.expect_response("**/api/auth/login") as response_info:
        page.click('button[type="submit"]')
    
    response = response_info.value
    print(f"\nLogin response status: {response.status}")
    body = response.text()
    print(f"Login response body: {body}")
    print(f"Login response headers: {dict(response.headers)}")
    
    # Check cookies
    cookies = context.cookies()
    print(f"\nCookies after login: {cookies}")
    
    # Try to navigate to admin
    print("\n=== Navigate to admin ===")
    page.goto("https://cpj.supertix.co.id/admin")
    page.wait_for_load_state("networkidle")
    print(f"Current URL: {page.url}")
    print(f"Page title: {page.title()}")
    
    browser.close()
