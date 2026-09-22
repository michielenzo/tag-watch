param([string]$NodePath = (Get-Command node -ErrorAction Stop).Source)
$ErrorActionPreference = 'Stop'
$appDirectory = Split-Path $PSScriptRoot -Parent
$nodeMajor = [int]((& $NodePath -p 'process.versions.node.split(".")[0]') | Select-Object -Last 1)
if ($nodeMajor -lt 22) { throw 'Development requires Node 22 or newer. Pass -NodePath to select it.' }
$env:PATH = (Split-Path $NodePath -Parent) + ';' + $env:PATH
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$msbuild = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1
if (!$msbuild) { throw 'Visual Studio MSBuild was not found.' }
$windowsDirectory = Join-Path $appDirectory 'windows'
$outputDirectory = Join-Path $windowsDirectory 'x64\Debug'
Push-Location $windowsDirectory
try {
  # Build the application target only. Never invoke Deploy or the package target.
  & $msbuild TagWatch.sln /t:TagWatch /p:Configuration=Debug /p:Platform=x64 /p:AppxPackage=false /p:WindowsPackageType=None /m /v:minimal /nologo
  if ($LASTEXITCODE -ne 0) { throw 'The development build failed.' }
} finally { Pop-Location }
try { $metro = Invoke-WebRequest 'http://localhost:8081/status' -UseBasicParsing -TimeoutSec 2 } catch { $metro = $null }
if (!$metro -or $metro.StatusCode -ne 200) {
  $cli = Join-Path $appDirectory 'node_modules\react-native\cli.js'
  Start-Process -FilePath $NodePath -ArgumentList @(('"' + $cli + '"'), 'start', '--no-interactive') -WorkingDirectory $appDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $outputDirectory 'metro.log') -RedirectStandardError (Join-Path $outputDirectory 'metro-error.log')
  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 500
    try { $metro = Invoke-WebRequest 'http://localhost:8081/status' -UseBasicParsing -TimeoutSec 2 } catch { $metro = $null }
  } until (($metro -and $metro.StatusCode -eq 200) -or (Get-Date) -gt $deadline)
  if (!$metro -or $metro.StatusCode -ne 200) { throw 'Metro did not become ready. Check the development build logs.' }
}
Start-Process -FilePath (Join-Path $outputDirectory 'TagWatch.exe') -WorkingDirectory $outputDirectory
