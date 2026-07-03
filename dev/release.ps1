# 切換為正式模式 + 打包 zip（base + prod patch → manifest.json）

$dev  = $PSScriptRoot
$root = Resolve-Path "$dev\.."

node "$dev\merge-manifest.js" prod
Write-Host "🚀 已切換為正式模式"

$version = (Get-Content "$root\manifest.json" -Raw | ConvertFrom-Json).version
$output  = "$root\dist\worklohas-extension-v$version.zip"
New-Item -ItemType Directory -Force "$root\dist" | Out-Null

try {
  if (Test-Path $output) { Remove-Item $output -Force }
  $exclude = @("dist", ".git", ".vscode", ".claude", "dev", "*.bak")
  $items   = Get-ChildItem $root -Exclude $exclude | Select-Object -ExpandProperty FullName
  Compress-Archive -Path $items -DestinationPath $output
  Write-Host "✅ 打包完成：$output"
} catch {
  Write-Host "❌ 打包失敗：$_"
}
