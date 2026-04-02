#!/bin/bash
# Install git hooks from .githooks directory

echo "🔧 Installing git hooks..."

# Get the root directory of the git repository
ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$ROOT_DIR" ]; then
    echo "❌ Not a git repository. Please run this from within the git repo."
    exit 1
fi

# Copy hooks to .git/hooks/
cp "$ROOT_DIR/.githooks/pre-commit" "$ROOT_DIR/.git/hooks/pre-commit"

# Make hooks executable
chmod +x "$ROOT_DIR/.git/hooks/pre-commit"

echo "✅ Git hooks installed successfully!"
echo ""
echo "The following hooks are now active:"
echo "  - pre-commit: Checks build before committing"
echo ""
echo "To bypass the hook in an emergency, use: git commit --no-verify"
