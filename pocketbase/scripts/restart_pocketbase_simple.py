#!/usr/bin/env python3
"""
Simple PocketBase Restart Script

Stops any running PocketBase instance and starts a new one
to apply schema changes from pb_schema.json

No external dependencies required.
"""

import os
import sys
import time
import subprocess
import signal

def find_and_kill_pocketbase():
    """Find and kill PocketBase process using tasklist/taskkill on Windows"""
    print("🔍 Looking for running PocketBase instance...")

    try:
        # Check if pocketbase.exe is running
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq pocketbase.exe'],
            capture_output=True,
            text=True,
            check=False
        )

        if 'pocketbase.exe' in result.stdout:
            print("✋ Found PocketBase, stopping...")

            # Kill the process
            kill_result = subprocess.run(
                ['taskkill', '/F', '/IM', 'pocketbase.exe'],
                capture_output=True,
                text=True,
                check=False
            )

            if kill_result.returncode == 0:
                print("✅ PocketBase stopped")
                time.sleep(2)  # Wait for port to be released
                return True
            else:
                print(f"⚠️  Failed to stop PocketBase: {kill_result.stderr}")
                return False
        else:
            print("ℹ️  No running PocketBase instance found")
            return True

    except Exception as e:
        print(f"❌ Error while stopping PocketBase: {e}")
        return False

def start_pocketbase():
    """Start PocketBase server in background"""
    print("\n🚀 Starting PocketBase...")

    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pb_dir = os.path.dirname(script_dir)
    pb_exe = os.path.join(pb_dir, 'pocketbase.exe')

    if not os.path.exists(pb_exe):
        print(f"❌ pocketbase.exe not found at {pb_exe}")
        return False

    try:
        # Start PocketBase in background
        # Using CREATE_NEW_PROCESS_GROUP to run it independently
        DETACHED_PROCESS = 0x00000008
        subprocess.Popen(
            [pb_exe, 'serve', '--http=127.0.0.1:8090'],
            cwd=pb_dir,
            creationflags=DETACHED_PROCESS,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        print("⏳ Waiting for startup...")
        time.sleep(4)

        # Verify it started by checking if the process exists
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq pocketbase.exe'],
            capture_output=True,
            text=True,
            check=False
        )

        if 'pocketbase.exe' in result.stdout:
            print("✅ PocketBase started successfully")
            print("📡 Server running at http://127.0.0.1:8090")
            print("🔐 Admin UI: http://127.0.0.1:8090/_/")
            return True
        else:
            print("❌ PocketBase failed to start")
            return False

    except Exception as e:
        print(f"❌ Error starting PocketBase: {e}")
        return False

def main():
    print("=" * 60)
    print("PocketBase Restart Script")
    print("=" * 60)
    print()

    try:
        # Step 1: Stop running instance
        if not find_and_kill_pocketbase():
            print("\n❌ Failed to stop PocketBase")
            sys.exit(1)

        # Step 2: Start new instance
        if not start_pocketbase():
            print("\n❌ Failed to start PocketBase")
            sys.exit(1)

        print("\n" + "=" * 60)
        print("✅ PocketBase restarted successfully")
        print("=" * 60)
        print("\nSchema changes from pb_schema.json should now be applied.")
        print("You can now verify the collections were created.")

        sys.exit(0)

    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
