$runtimePath = 'C:\Users\122305\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $runtimePath)) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) { $runtimePath = $nodeCommand.Source }
    else { Write-Host '需要安装 Node.js 才能启动本地预览。'; Read-Host '按回车退出'; exit 1 }
}
Write-Host '本地预览：http://127.0.0.1:4173'
Write-Host '请保持此窗口打开；按 Ctrl+C 停止预览。'
& $runtimePath (Join-Path $PSScriptRoot 'preview-server.cjs')
