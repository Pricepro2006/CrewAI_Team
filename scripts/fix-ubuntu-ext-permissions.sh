#!/bin/bash
# Fix permissions for Ubuntu_EXT mount
# This resolves permission issues when accessing files across WSL distros

echo "🔧 Fixing Ubuntu_EXT Mount Permissions"
echo "====================================="
echo ""

# Get current user info
USER_ID=$(id -u)
GROUP_ID=$(id -g)
MOUNT_POINT="/mnt/ubuntu_ext"

echo "📋 Current Configuration:"
echo "   User ID: $USER_ID"
echo "   Group ID: $GROUP_ID"
echo "   Mount Point: $MOUNT_POINT"
echo ""

# Step 1: Unmount if currently mounted
echo "1️⃣ Unmounting current mount (if exists)..."
if mountpoint -q "$MOUNT_POINT"; then
    sudo umount "$MOUNT_POINT"
    echo "   ✅ Unmounted existing mount"
else
    echo "   ℹ️  Not currently mounted"
fi

# Step 2: Remount with proper permissions
echo ""
echo "2️⃣ Remounting with correct permissions..."
sudo mount -t drvfs -o metadata,uid=$USER_ID,gid=$GROUP_ID,umask=002 '\\wsl$\Ubuntu_EXT' "$MOUNT_POINT"

if [ $? -eq 0 ]; then
    echo "   ✅ Successfully mounted with correct permissions"
else
    echo "   ❌ Mount failed. Trying alternative syntax..."
    sudo mount -t drvfs -o metadata,uid=$USER_ID,gid=$GROUP_ID,umask=002 '\\wsl.localhost\Ubuntu_EXT' "$MOUNT_POINT"
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Successfully mounted with wsl.localhost syntax"
    else
        echo "   ❌ Failed to mount Ubuntu_EXT"
        exit 1
    fi
fi

# Step 3: Test permissions
echo ""
echo "3️⃣ Testing permissions..."
TEST_FILE="$MOUNT_POINT/home/pricepro2006/test_permissions_$(date +%s).txt"

# Try to create a test file
if echo "Permission test from Ubuntu at $(date)" > "$TEST_FILE" 2>/dev/null; then
    echo "   ✅ Write permissions: OK"
    rm "$TEST_FILE"
else
    echo "   ❌ Write permissions: FAILED"
    echo "   Attempting to fix..."
    
    # Try creating the user directory on Ubuntu_EXT
    REMOTE_USER_DIR="$MOUNT_POINT/home/pricepro2006"
    if [ ! -d "$REMOTE_USER_DIR" ]; then
        echo "   Creating user directory on Ubuntu_EXT..."
        sudo mkdir -p "$REMOTE_USER_DIR"
        sudo chown $USER_ID:$GROUP_ID "$REMOTE_USER_DIR"
    fi
fi

# Step 4: Test master_knowledge_base access
echo ""
echo "4️⃣ Testing master_knowledge_base access..."
KB_PATH="$MOUNT_POINT/home/pricepro2006/master_knowledge_base"

if [ -d "$KB_PATH" ]; then
    echo "   ✅ master_knowledge_base exists"
    
    # Test write permissions
    TEST_KB_FILE="$KB_PATH/test_from_ubuntu_$(date +%s).txt"
    if echo "Test write from Ubuntu" > "$TEST_KB_FILE" 2>/dev/null; then
        echo "   ✅ Can write to master_knowledge_base"
        rm "$TEST_KB_FILE"
    else
        echo "   ⚠️  Cannot write to master_knowledge_base"
        echo "   You may need to create it from Ubuntu_EXT first"
    fi
else
    echo "   📁 Creating master_knowledge_base..."
    mkdir -p "$KB_PATH" 2>/dev/null || {
        echo "   ❌ Cannot create master_knowledge_base"
        echo "   Please create it from Ubuntu_EXT:"
        echo "      wsl -d Ubuntu_EXT mkdir -p ~/master_knowledge_base"
    }
fi

# Step 5: Update mount script with correct options
echo ""
echo "5️⃣ Updating mount script with correct options..."
cat > "$HOME/mount-ubuntu-ext.sh" << EOF
#!/bin/bash
# Mount Ubuntu_EXT with correct permissions
sudo mount -t drvfs -o metadata,uid=$USER_ID,gid=$GROUP_ID,umask=002 '\\\\wsl\$\\Ubuntu_EXT' /mnt/ubuntu_ext || \\
sudo mount -t drvfs -o metadata,uid=$USER_ID,gid=$GROUP_ID,umask=002 '\\\\wsl.localhost\\Ubuntu_EXT' /mnt/ubuntu_ext || \\
echo "Failed to mount Ubuntu_EXT"
EOF
chmod +x "$HOME/mount-ubuntu-ext.sh"

# Step 6: Create alternate sync method using SSH
echo ""
echo "6️⃣ Creating alternate sync method (SSH-based)..."
cat > "$HOME/sync-to-ubuntu-ext-ssh.sh" << 'EOF'
#!/bin/bash
# Alternative sync method using direct WSL commands
# This bypasses mount permission issues

SOURCE="${1:-.}"
DEST_PATH="${2:-master_knowledge_base}"

echo "📤 Syncing to Ubuntu_EXT via WSL interop..."
echo "   Source: $SOURCE"
echo "   Destination: ~/$DEST_PATH on Ubuntu_EXT"

# Use tar to transfer files between distros
tar -cf - "$SOURCE" | wsl.exe -d Ubuntu_EXT tar -xf - -C "\$HOME/$DEST_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Sync completed successfully"
else
    echo "❌ Sync failed"
fi
EOF
chmod +x "$HOME/sync-to-ubuntu-ext-ssh.sh"

# Summary
echo ""
echo "✅ Permission Fix Complete!"
echo "========================="
echo ""
echo "📊 Mount Status:"
mount | grep ubuntu_ext
echo ""
echo "🔑 Key Points:"
echo "   - Mount now uses your user ID ($USER_ID) and group ID ($GROUP_ID)"
echo "   - Files will be accessible with proper permissions"
echo "   - Created ~/mount-ubuntu-ext.sh for easy remounting"
echo ""
echo "📝 Next Steps:"
echo "   1. Try the migration again:"
echo "      ./scripts/migrate-to-ubuntu-ext-kb.sh"
echo ""
echo "   2. If permissions still fail, use the SSH-based sync:"
echo "      ~/sync-to-ubuntu-ext-ssh.sh /path/to/source destination_path"
echo ""
echo "💡 Tip: Add to .bashrc for auto-mount on login:"
echo "   echo '~/mount-ubuntu-ext.sh 2>/dev/null' >> ~/.bashrc"

# Make this script executable
chmod +x "$0"