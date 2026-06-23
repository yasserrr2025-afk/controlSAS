import sys

def fix_encoding(filepath, outpath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if content.startswith('\ufeff'):
        content = content[1:]
        
    try:
        raw_bytes = content.encode('windows-1256', errors='ignore')
        fixed_content = raw_bytes.decode('utf-8', errors='ignore')
        
        with open(outpath, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print("Success")
    except Exception as e:
        print("Failed:", e)

fix_encoding('screens/control/EnvelopeOpeningView.tsx', 'screens/control/EnvelopeOpeningView.tsx')
