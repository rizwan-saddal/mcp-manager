import subprocess
import shutil
import sys

# Check for npx
npx_path = shutil.which("npx")
print(f"npx found at: {npx_path}")

try:
    # Try running it
    cmd = [npx_path, "--version"] if npx_path else ["npx", "--version"]
    # On windows shutil.which might return the shell script, but Popen needs the .cmd if not using shell=True?
    # Actually shutil.which returns the executable usually.
    
    print(f"Running: {cmd}")
    subprocess.run(cmd, check=True, shell=True if not npx_path else False)
    print("Success")
except Exception as e:
    print(f"Error: {e}")
