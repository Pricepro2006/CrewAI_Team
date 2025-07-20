#!/bin/bash
# Setup Cross-Distro Knowledge Base Access
# This script configures Ubuntu to access master_knowledge_base on Ubuntu_EXT

set -e

echo "🔧 Setting up Cross-Distro Knowledge Base Access"
echo "================================================"
echo ""

# Configuration
MOUNT_POINT="/mnt/ubuntu_ext"
UBUNTU_EXT_PATH="\\\\wsl\$\\Ubuntu_EXT"
LOCAL_LINK="$HOME/master_knowledge_base"
REMOTE_KB_PATH="/home/pricepro2006/master_knowledge_base"

# Function to check if Ubuntu_EXT is running
check_ubuntu_ext() {
    echo "📍 Checking if Ubuntu_EXT is running..."
    # Convert Windows UTF-16 output to UTF-8 and check for Ubuntu_EXT
    if powershell.exe -Command "wsl -l --running" 2>/dev/null | iconv -f UTF-16LE -t UTF-8 2>/dev/null | grep -q "Ubuntu_EXT"; then
        echo "✅ Ubuntu_EXT is running"
        return 0
    else
        echo "❌ Ubuntu_EXT is not running"
        echo "   Please start Ubuntu_EXT with: wsl -d Ubuntu_EXT"
        return 1
    fi
}

# Function to create mount point
create_mount() {
    echo "📁 Creating mount point at $MOUNT_POINT..."
    sudo mkdir -p "$MOUNT_POINT"
    
    # Try to mount Ubuntu_EXT
    echo "🔗 Mounting Ubuntu_EXT filesystem..."
    if sudo mount -t drvfs "$UBUNTU_EXT_PATH" "$MOUNT_POINT" 2>/dev/null; then
        echo "✅ Successfully mounted Ubuntu_EXT"
        return 0
    else
        echo "❌ Failed to mount Ubuntu_EXT"
        echo "   Trying alternative method..."
        
        # Alternative: Use Windows path directly
        WIN_PATH="/mnt/c/Windows/System32/wsl.exe"
        if [ -f "$WIN_PATH" ]; then
            # Get the actual path to Ubuntu_EXT
            UBUNTU_EXT_LOCATION=$($WIN_PATH --list --verbose | grep Ubuntu_EXT | awk '{print $NF}')
            echo "   Ubuntu_EXT location: $UBUNTU_EXT_LOCATION"
        fi
        return 1
    fi
}

# Function to create symlink
create_symlink() {
    echo "🔗 Creating symlink to master knowledge base..."
    
    # Remove existing symlink if it exists
    if [ -L "$LOCAL_LINK" ]; then
        echo "   Removing existing symlink..."
        rm "$LOCAL_LINK"
    fi
    
    # Create new symlink
    if ln -s "${MOUNT_POINT}${REMOTE_KB_PATH}" "$LOCAL_LINK"; then
        echo "✅ Symlink created: $LOCAL_LINK -> ${MOUNT_POINT}${REMOTE_KB_PATH}"
        return 0
    else
        echo "❌ Failed to create symlink"
        return 1
    fi
}

# Function to setup automatic mounting
setup_automount() {
    echo "🔧 Setting up automatic mounting..."
    
    # Create systemd mount unit
    MOUNT_UNIT="/etc/systemd/system/mnt-ubuntu_ext.mount"
    
    cat << EOF | sudo tee "$MOUNT_UNIT" > /dev/null
[Unit]
Description=Mount Ubuntu_EXT filesystem
After=network.target

[Mount]
What=\\\\wsl\$\\Ubuntu_EXT
Where=/mnt/ubuntu_ext
Type=drvfs
Options=defaults,metadata,uid=$(id -u),gid=$(id -g)

[Install]
WantedBy=multi-user.target
EOF

    # Create automount unit
    AUTOMOUNT_UNIT="/etc/systemd/system/mnt-ubuntu_ext.automount"
    
    cat << EOF | sudo tee "$AUTOMOUNT_UNIT" > /dev/null
[Unit]
Description=Automount Ubuntu_EXT filesystem
After=network.target

[Automount]
Where=/mnt/ubuntu_ext
TimeoutIdleSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Enable automount
    sudo systemctl daemon-reload
    sudo systemctl enable mnt-ubuntu_ext.automount
    echo "✅ Automount configured (will activate on next boot)"
}

# Function to create convenience scripts
create_convenience_scripts() {
    echo "📝 Creating convenience scripts..."
    
    # Create sync script
    cat << 'EOF' > "$HOME/sync-to-master-kb.sh"
#!/bin/bash
# Sync local knowledge to master knowledge base on Ubuntu_EXT

SOURCE="${1:-./master_knowledge_base}"
DEST="$HOME/master_knowledge_base"

if [ ! -L "$DEST" ]; then
    echo "❌ Master knowledge base link not found at $DEST"
    echo "   Run setup-cross-distro-knowledge-base.sh first"
    exit 1
fi

echo "📤 Syncing $SOURCE to master knowledge base..."
rsync -av --progress "$SOURCE/" "$DEST/"
echo "✅ Sync complete"
EOF
    chmod +x "$HOME/sync-to-master-kb.sh"
    
    # Create backup script
    cat << 'EOF' > "$HOME/backup-master-kb.sh"
#!/bin/bash
# Backup master knowledge base from Ubuntu_EXT

SOURCE="$HOME/master_knowledge_base"
DEST="${1:-./kb_backup_$(date +%Y%m%d_%H%M%S)}"

if [ ! -L "$SOURCE" ]; then
    echo "❌ Master knowledge base link not found at $SOURCE"
    echo "   Run setup-cross-distro-knowledge-base.sh first"
    exit 1
fi

echo "📥 Backing up master knowledge base to $DEST..."
rsync -av --progress "$SOURCE/" "$DEST/"
echo "✅ Backup complete"
EOF
    chmod +x "$HOME/backup-master-kb.sh"
    
    echo "✅ Created convenience scripts:"
    echo "   - ~/sync-to-master-kb.sh : Sync local content to master KB"
    echo "   - ~/backup-master-kb.sh : Backup master KB locally"
}

# Main execution
main() {
    echo "🚀 Starting setup process..."
    echo ""
    
    # Check if Ubuntu_EXT is running
    if ! check_ubuntu_ext; then
        echo ""
        echo "⚠️  Please start Ubuntu_EXT and run this script again"
        exit 1
    fi
    
    # Create mount
    if create_mount; then
        # Create symlink
        if create_symlink; then
            # Test access
            echo ""
            echo "🧪 Testing access..."
            if ls -la "$LOCAL_LINK" >/dev/null 2>&1; then
                echo "✅ Successfully accessed master knowledge base"
                
                # Show contents
                echo ""
                echo "📂 Master knowledge base contents:"
                ls -la "$LOCAL_LINK" 2>/dev/null | head -10 || echo "   (empty or not accessible)"
                
                # Setup automount
                echo ""
                read -p "Would you like to setup automatic mounting on boot? (y/n) " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    setup_automount
                fi
                
                # Create convenience scripts
                echo ""
                create_convenience_scripts
                
                # Update CrewAI scripts
                echo ""
                echo "📝 Updating CrewAI scripts to use unified knowledge base..."
                for script in /home/pricepro2006/CrewAI_Team/scripts/*.sh; do
                    if grep -q "MASTER_KB=" "$script"; then
                        sed -i.bak 's|MASTER_KB=.*|MASTER_KB="$HOME/master_knowledge_base"|' "$script"
                        echo "   Updated: $(basename "$script")"
                    fi
                done
                
                echo ""
                echo "✨ Setup complete!"
                echo ""
                echo "📚 You can now access the master knowledge base at:"
                echo "   $LOCAL_LINK"
                echo ""
                echo "🔄 To sync local content to master KB:"
                echo "   ~/sync-to-master-kb.sh /path/to/local/content"
                echo ""
                echo "💾 To backup master KB:"
                echo "   ~/backup-master-kb.sh /path/to/backup/location"
                
            else
                echo "❌ Failed to access master knowledge base"
                echo "   Please check Ubuntu_EXT permissions"
            fi
        fi
    else
        echo ""
        echo "❌ Setup failed. Please ensure:"
        echo "   1. Ubuntu_EXT is running"
        echo "   2. You have sudo permissions"
        echo "   3. WSL interop is enabled"
    fi
}

# Run main function
main

# Make this script executable
chmod +x "$0"