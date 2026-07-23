$ErrorActionPreference = 'Stop'

$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repositoryRoot

try {
    $dirty = git status --porcelain
    if ($dirty) {
        throw 'The working tree must be clean before creating a Mac handoff bundle.'
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $handoffDirectory = Join-Path $repositoryRoot 'out\handoff'
    New-Item -ItemType Directory -Force -Path $handoffDirectory | Out-Null

    $bundlePath = Join-Path $handoffDirectory "ATIRA-$stamp.bundle"
    $checksumPath = "$bundlePath.sha256"
    $manifestPath = Join-Path $handoffDirectory "ATIRA-$stamp.txt"

    git bundle create $bundlePath --all
    git bundle verify $bundlePath

    $checksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundlePath).Hash.ToLowerInvariant()
    "$checksum  $([System.IO.Path]::GetFileName($bundlePath))" | Set-Content -Encoding ascii -LiteralPath $checksumPath

    @(
        "commit=$(git rev-parse HEAD)"
        "branch=$(git branch --show-current)"
        "createdUtc=$([DateTime]::UtcNow.ToString('o'))"
        "bundle=$([System.IO.Path]::GetFileName($bundlePath))"
        "sha256=$checksum"
    ) | Set-Content -Encoding utf8 -LiteralPath $manifestPath

    Write-Host "Created verified fallback handoff:"
    Write-Host "  $bundlePath"
    Write-Host "  $checksumPath"
    Write-Host "  $manifestPath"
}
finally {
    Pop-Location
}
