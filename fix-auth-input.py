import re

with open("./client/src/pages/AuthPage.tsx") as f:
    content = f.read()

# Add 'data-test': dataTest to destructuring
content = re.sub(
    r"label, type = 'text', value, onChange, error, autoFocus = false, placeholder,",
    "label, type = 'text', value, onChange, error, autoFocus = false, placeholder, 'data-test': dataTest,",
    content
)

# Add 'data-test'?: string; to type def
content = re.sub(
    r"autoFocus\?\: boolean; placeholder\?\: string;",
    "autoFocus?: boolean; placeholder?: string; 'data-test'?: string;",
    content
)

# Add data-test={dataTest} to input
content = re.sub(
    r'placeholder={placeholder}\n        onChange',
    'placeholder={placeholder}\n        data-test={dataTest}\n        onChange',
    content
)

with open("./client/src/pages/AuthPage.tsx", "w") as f:
    f.write(content)

print("[OK] AuthInput patched")
