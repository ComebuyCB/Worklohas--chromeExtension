# 切換為正式模式（base + prod patch → manifest.json）

node "$PSScriptRoot\merge-manifest.js" prod
Write-Host "🚀 已切換為正式模式"
Write-Host "   記得在 chrome://extensions/ 重新載入擴充功能"
