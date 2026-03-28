#!/usr/bin/env python3
"""
Script to change the number of classes in the ML service.
This is the ONLY script you need to run to change class size.

Usage: python src/change_classes.py <num_classes>

Example: python src/change_classes.py 40
"""

import os
import sys
from pathlib import Path


def update_num_classes(num_classes: int):
    """Update NUM_CLASSES in .env file and regenerate labels."""
    if not 1 <= num_classes <= 40:
        print("Error: Number of classes must be between 1 and 40")
        return False

    env_file = ".env"
    env_content = []

    with open(env_file, "r", encoding="utf-8") as file:
        for line in file:
            if line.startswith("NUM_CLASSES="):
                env_content.append(f"NUM_CLASSES={num_classes}\n")
            else:
                env_content.append(line)

    with open(env_file, "w", encoding="utf-8") as file:
        file.writelines(env_content)

    print(f"Updated NUM_CLASSES to {num_classes} in .env")

    generate_script = Path(__file__).resolve().with_name("generate_labels.py")
    os.system(f'python "{generate_script}"')

    print(f"\nSuccessfully configured for {num_classes} classes!")
    print(f"Labels file: src/models/herb_labels_{num_classes}_classes.json")
    print("Restart the ML service: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000")
    return True


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python src/change_classes.py <num_classes>")
        print("Example: python src/change_classes.py 40")
        sys.exit(1)

    try:
        update_num_classes(int(sys.argv[1]))
    except ValueError:
        print("Error: Please provide a valid integer")
        sys.exit(1)
