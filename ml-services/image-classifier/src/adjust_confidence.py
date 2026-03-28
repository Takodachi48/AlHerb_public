#!/usr/bin/env python3
"""
Adjust model confidence temperature setting
Temperature > 1.0 = less confident (more conservative)
Temperature < 1.0 = more confident (more aggressive)
Temperature = 1.0 = normal confidence
"""

import os
import sys

def update_temperature(temperature):
    """Update INFERENCE_TEMPERATURE in .env file"""
    env_file = '.env'
    
    # Read current .env content
    lines = []
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            lines = f.readlines()
    
    # Update or add INFERENCE_TEMPERATURE
    updated = False
    for i, line in enumerate(lines):
        if line.startswith('INFERENCE_TEMPERATURE='):
            lines[i] = f'INFERENCE_TEMPERATURE={temperature}\n'
            updated = True
            break
    
    if not updated:
        lines.append(f'INFERENCE_TEMPERATURE={temperature}\n')
    
    # Write back to .env
    with open(env_file, 'w') as f:
        f.writelines(lines)
    
    print(f"✅ Updated INFERENCE_TEMPERATURE to {temperature}")
    print(f"📊 Confidence Level: {'Conservative' if temperature > 1.0 else 'Aggressive' if temperature < 1.0 else 'Normal'}")
    print("🔄 Restart ML service to apply changes")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python adjust_confidence.py <temperature>")
        print("Examples:")
        print("  python adjust_confidence.py 2.0  # Conservative (less confident)")
        print("  python adjust_confidence.py 1.0  # Normal (default)")
        print("  python adjust_confidence.py 0.5  # Aggressive (more confident)")
        sys.exit(1)
    
    try:
        temp = float(sys.argv[1])
        if temp <= 0:
            print("❌ Temperature must be positive")
            sys.exit(1)
        
        update_temperature(temp)
    except ValueError:
        print("❌ Invalid temperature value")
        sys.exit(1)
