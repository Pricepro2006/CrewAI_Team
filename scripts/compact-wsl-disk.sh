#!/bin/bash
# Compact WSL disk to reclaim space on Windows C: drive

echo "🔍 WSL Disk Space Reclamation Guide"
echo "===================================="
echo ""
echo "⚠️  IMPORTANT: WSL2 stores its filesystem in VHDX files on Windows."
echo "   Deleting files in WSL doesn't automatically free Windows disk space!"
echo ""

# Show current WSL disk usage
echo "📊 Current WSL Disk Usage:"
df -h / | grep -E "Filesystem|/"
echo ""

echo "🛠️  To reclaim space on C: drive, follow these steps:"
echo ""
echo "1️⃣ OPTIMIZE FROM WITHIN WSL (Run these now):"
echo "   # Clear package cache"
echo "   sudo apt-get clean"
echo "   sudo apt-get autoclean"
echo "   sudo apt-get autoremove"
echo ""
echo "   # Clear bash history if large"
echo "   history -c"
echo "   > ~/.bash_history"
echo ""
echo "   # Find and remove large unnecessary files"
echo "   du -h ~ | sort -rh | head -20"
echo ""

echo "2️⃣ SHUT DOWN WSL (Run from PowerShell as Admin):"
echo "   wsl --shutdown"
echo ""

echo "3️⃣ COMPACT THE VHDX FILE (Run from PowerShell as Admin):"
echo ""
echo "   # For Ubuntu (default distro):"
echo '   cd "$env:LOCALAPPDATA\Packages\CanonicalGroupLimited.Ubuntu_79rhkp1fndgsc\LocalState"'
echo "   optimize-vhd -Path .\ext4.vhdx -Mode Full"
echo ""
echo "   # OR use diskpart method:"
echo "   diskpart"
echo "   select vdisk file=\"C:\Users\YOUR_USERNAME\AppData\Local\Packages\...\ext4.vhdx\""
echo "   attach vdisk readonly"
echo "   compact vdisk"
echo "   detach vdisk"
echo "   exit"
echo ""

echo "4️⃣ MOVE UBUNTU_EXT TO ANOTHER DRIVE (Optional but recommended):"
echo "   # Export Ubuntu_EXT"
echo "   wsl --export Ubuntu_EXT D:\\WSL-Backups\\Ubuntu_EXT.tar"
echo ""
echo "   # Unregister it"
echo "   wsl --unregister Ubuntu_EXT"
echo ""
echo "   # Import to new location on D: drive"
echo "   wsl --import Ubuntu_EXT D:\\WSL\\Ubuntu_EXT D:\\WSL-Backups\\Ubuntu_EXT.tar"
echo ""
echo "   # Set as default if needed"
echo "   wsl --set-default Ubuntu_EXT"
echo ""

echo "📈 SPACE SAVINGS ESTIMATE:"
echo "   - Compacting VHDX: Can recover 10-50% of allocated space"
echo "   - Moving Ubuntu_EXT to D: drive: Frees all its space from C:"
echo "   - Your Ubuntu uses ~219GB, so potential savings are significant!"
echo ""

echo "🎯 QUICK ACTIONS YOU CAN DO NOW:"
echo ""

# Clean apt cache
echo "Cleaning apt cache..."
sudo apt-get clean
SAVED=$(du -sh /var/cache/apt 2>/dev/null | cut -f1)
echo "✅ Cleared apt cache (was using ~$SAVED)"

# Clear temp files
echo ""
echo "Clearing temp files..."
find /tmp -type f -atime +7 -delete 2>/dev/null
echo "✅ Cleared old temp files"

# Show large directories
echo ""
echo "📁 Largest directories in home:"
du -h ~ 2>/dev/null | sort -rh | head -10

echo ""
echo "💡 After running the PowerShell commands above, you should see"
echo "   free space increase on your C: drive!"
echo ""
echo "🚀 For maximum space savings, consider moving Ubuntu_EXT to D: drive!"