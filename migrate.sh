#!/bin/bash
# Wrapper to run the python migration script
if command -v python3 &> /dev/null; then
    python3 migrate.py
elif command -v python &> /dev/null; then
    python migrate.py
else
    echo "Python not found. Please run migrate.py manually."
fi
