import os

env_path = os.path.expanduser('~/cirebon-scanner/.env')
with open(env_path, 'r') as f:
    content = f.read()

# Replace any malformed WEB_ORIGIN line with correct one
lines = content.split('\n')
new_lines = []
for line in lines:
    if line.startswith('WEB_ORIGIN='):
        new_lines.append('WEB_ORIGIN=https://cpj.supertix.co.id')
    else:
        new_lines.append(line)

with open(env_path, 'w') as f:
    f.write('\n'.join(new_lines))

# Verify
with open(env_path, 'r') as f:
    for line in f:
        if line.startswith('WEB_ORIGIN='):
            print(line.strip())
