with open("./client/src/pages/login.tsx") as f:
    content = f.read()

assert content.count('placeholder="you@example.com"') == 1, "email anchor not unique"
assert content.count('placeholder="••••••••"') == 1, "password anchor not unique"
assert content.count('type="submit"\n      disabled={isLoading || isSuccess}') == 1, "submit anchor not unique"

content = content.replace(
    'placeholder="you@example.com"',
    'placeholder="you@example.com"\n              data-test="email"'
)

content = content.replace(
    'placeholder="••••••••"',
    'placeholder="••••••••"\n                data-test="password"'
)

content = content.replace(
    'type="submit"\n      disabled={isLoading || isSuccess}',
    'type="submit"\n      data-test="submit"\n      disabled={isLoading || isSuccess}'
)

with open("./client/src/pages/login.tsx", "w") as f:
    f.write(content)

print("[OK] login.tsx patched — data-test on email, password, submit")
