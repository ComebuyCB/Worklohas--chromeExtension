# 切換為開發模式（base + dev patch → manifest.json）

node "$PSScriptRoot\merge-manifest.js" dev
Write-Host "🔧 已切換為開發模式"
Write-Host "   記得在 chrome://extensions/ 重新載入擴充功能"
