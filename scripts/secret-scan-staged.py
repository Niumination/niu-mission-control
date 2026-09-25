#!/usr/bin/env python3
"""
Secret scan staged files — DOX v4.0 gate
"""
import subprocess, re, sys
SECRET_PATTERNS = [r'PI_API_KEY\s*=\s*.+', r'MC_PASSWORD_HASH\s*=\s*\$scrypt\$.+', r'MC_API_KEY\s*=\s*mc_.+', r'MC_SESSION_SECRET\s*=\s*.{20,}', r'-----BEGIN (RSA )?PRIVATE KEY-----', r'sk-(proj-)?[a-zA-Z0-9]{20,}', r'ghp_[a-zA-Z0-9]{36}']
FORBIDDEN_FILES = [r'\.env$', r'\.env\.local$', r'vault/', r'\.key$', r'\.pem$', r'data/.*\.db$']
def get_staged_files():
    result = subprocess.run(['git', 'diff', '--cached', '--name-only'], capture_output=True, text=True)
    return result.stdout.strip().split('\n') if result.stdout.strip() else []
def get_staged_content(fp):
    result = subprocess.run(['git', 'show', f':{fp}'], capture_output=True, text=True)
    return result.stdout
def main():
    staged = get_staged_files()
    if not staged or staged == ['']: return 0
    found=False
    for f in staged:
        for pat in FORBIDDEN_FILES:
            if re.search(pat, f) and not f.endswith('.env.example'):
                print(f"❌ Forbidden file staged: {f} (matches {pat})"); found=True
        try:
            content=get_staged_content(f)
            for pat in SECRET_PATTERNS:
                if re.search(pat, content): print(f"❌ Secret pattern in {f}: {pat}"); found=True
        except: pass
    if found: print("\nGate: secrets detected — commit blocked"); return 1
    return 0
if __name__=='__main__': sys.exit(main())
