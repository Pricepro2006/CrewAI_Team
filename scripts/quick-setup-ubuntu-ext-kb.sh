#!/bin/bash
# Quick Setup for Ubuntu_EXT Knowledge Base Access
# Simplified version that skips checks and just sets up the mount

set -e

echo "🚀 Quick Setup: Ubuntu_EXT Knowledge Base Access"
echo "=============================================="
echo ""

# Configuration
MOUNT_POINT="/mnt/ubuntu_ext"
LOCAL_LINK="$HOME/master_knowledge_base"
REMOTE_KB_PATH="/home/pricepro2006/master_knowledge_base"

echo "📋 Setup Steps:"
echo "1. Create mount point: $MOUNT_POINT"
echo "2. Mount Ubuntu_EXT filesystem"
echo "3. Create symlink: $LOCAL_LINK"
echo ""

# Step 1: Create mount point (requires sudo)
echo "🔐 Creating mount point (requires sudo password)..."
sudo mkdir -p "$MOUNT_POINT"

# Step 2: Mount Ubuntu_EXT
echo "🔗 Mounting Ubuntu_EXT filesystem..."
if sudo mount -t drvfs '\\wsl$\Ubuntu_EXT' "$MOUNT_POINT" 2>/dev/null; then
    echo "✅ Successfully mounted Ubuntu_EXT"
else
    echo "⚠️  Mount failed. Trying alternative method..."
    
    # Alternative: Try with different syntax
    if sudo mount -t drvfs '\\wsl.localhost\Ubuntu_EXT' "$MOUNT_POINT" 2>/dev/null; then
        echo "✅ Successfully mounted Ubuntu_EXT (using wsl.localhost)"
    else
        echo "❌ Failed to mount Ubuntu_EXT"
        echo ""
        echo "📝 Manual mount instructions:"
        echo "   1. From Windows Explorer, verify you can access: \\\\wsl$\\Ubuntu_EXT"
        echo "   2. If not, make sure Ubuntu_EXT is running: wsl -d Ubuntu_EXT"
        echo "   3. Try mounting manually:"
        echo "      sudo mount -t drvfs '\\\\wsl\$\\Ubuntu_EXT' /mnt/ubuntu_ext"
        exit 1
    fi
fi

# Step 3: Create symlink
echo "🔗 Creating symlink to master knowledge base..."

# Remove existing symlink/directory if it exists
if [ -e "$LOCAL_LINK" ]; then
    echo "   Removing existing link/directory..."
    rm -rf "$LOCAL_LINK"
fi

# Create symlink
if ln -s "${MOUNT_POINT}${REMOTE_KB_PATH}" "$LOCAL_LINK"; then
    echo "✅ Symlink created successfully"
else
    echo "❌ Failed to create symlink"
    exit 1
fi

# Step 4: Test access
echo ""
echo "🧪 Testing access..."
if [ -d "$LOCAL_LINK" ]; then
    echo "✅ Successfully accessed master knowledge base"
    
    # Create the directory on Ubuntu_EXT if it doesn't exist
    if [ ! -d "$LOCAL_LINK" ]; then
        echo "📁 Creating master_knowledge_base on Ubuntu_EXT..."
        mkdir -p "$LOCAL_LINK"
    fi
    
    # Show current contents
    echo ""
    echo "📂 Current contents:"
    ls -la "$LOCAL_LINK" 2>/dev/null | head -5 || echo "   (empty)"
    
    # Create a test file
    echo ""
    echo "📝 Creating test file..."
    echo "Test from Ubuntu at $(date)" > "$LOCAL_LINK/test_from_ubuntu.txt"
    if [ -f "$LOCAL_LINK/test_from_ubuntu.txt" ]; then
        echo "✅ Write test successful"
    else
        echo "❌ Write test failed"
    fi
else
    echo "❌ Cannot access master knowledge base"
    echo "   The mount may have failed or permissions are incorrect"
    exit 1
fi

# Step 5: Update CrewAI scripts
echo ""
echo "📝 Updating CrewAI scripts to use unified path..."
for script in /home/pricepro2006/CrewAI_Team/scripts/*.sh; do
    if [ -f "$script" ] && grep -q "MASTER_KB=" "$script"; then
        cp "$script" "$script.bak"
        sed -i 's|MASTER_KB="$HOME/master_knowledge_base"|MASTER_KB="$HOME/master_knowledge_base"|' "$script"
        echo "   Updated: $(basename "$script")"
    fi
done

# Step 6: Create mount persistence script
echo ""
echo "📋 Creating mount persistence script..."
cat > "$HOME/mount-ubuntu-ext.sh" << 'EOF'
#!/bin/bash
# Mount Ubuntu_EXT filesystem
sudo mount -t drvfs '\\wsl$\Ubuntu_EXT' /mnt/ubuntu_ext 2>/dev/null || \
sudo mount -t drvfs '\\wsl.localhost\Ubuntu_EXT' /mnt/ubuntu_ext 2>/dev/null || \
echo "Failed to mount Ubuntu_EXT"
EOF
chmod +x "$HOME/mount-ubuntu-ext.sh"

# Summary
echo ""
echo "✅ Quick Setup Complete!"
echo "======================="
echo ""
echo "📚 Master knowledge base is now accessible at:"
echo "   $LOCAL_LINK"
echo ""
echo "🔄 To remount after reboot:"
echo "   ~/mount-ubuntu-ext.sh"
echo ""
echo "📝 Next steps:"
echo "   1. Run the migration script to move existing knowledge:"
echo "      ./scripts/migrate-to-ubuntu-ext-kb.sh"
echo "   2. Remove local copies after migration:"
echo "      ~/cleanup-local-kb.sh"
echo ""
echo "💡 Tip: Add ~/mount-ubuntu-ext.sh to your .bashrc for automatic mounting"

# Make this script executable
chmod +x "$0"