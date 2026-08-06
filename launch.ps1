$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $projectRoot 'config.json'

if (-not (Test-Path -LiteralPath $configPath)) {
    Write-Host 'First run setup'
    $accountsFile = Read-Host 'Path to the Markdown account list'
    if ([string]::IsNullOrWhiteSpace($accountsFile) -or -not (Test-Path -LiteralPath $accountsFile)) {
        throw 'The account list path does not exist.'
    }

    $profileRoot = Join-Path $env:LOCALAPPDATA 'XiaolvshuMultiLogin\profiles'
    $profileInput = Read-Host "Profile directory [$profileRoot]"
    if (-not [string]::IsNullOrWhiteSpace($profileInput)) {
        $profileRoot = $profileInput
    }

    $config = [ordered]@{
        accountsFile = $accountsFile
        count = 2
        start = 0
        siteUrl = 'https://xiaolvshu.app/login'
        profileRoot = $profileRoot
        chromePath = ''
        smsCode = ''
    }
    $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    Write-Host "Saved local settings to $configPath"
}

$storedConfig = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$smsCode = $env:XIAOLVSHU_SMS_CODE
if ([string]::IsNullOrWhiteSpace($smsCode)) {
    $smsCode = [string]$storedConfig.smsCode
}
if ([string]::IsNullOrWhiteSpace($smsCode)) {
    throw 'Set smsCode in the local ignored config.json before launching.'
}
$env:XIAOLVSHU_SMS_CODE = $smsCode

$exitCode = 0
try {
    & node (Join-Path $projectRoot 'src\index.mjs') --config $configPath
    $exitCode = $LASTEXITCODE
}
finally {
    Remove-Item Env:XIAOLVSHU_SMS_CODE -ErrorAction SilentlyContinue
}

exit $exitCode
