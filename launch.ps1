$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $projectRoot 'config.json'

if (-not (Test-Path -LiteralPath $configPath)) {
    Write-Host 'First run setup'
    $accountsFile = Read-Host 'Path to the Markdown account list'
    if ([string]::IsNullOrWhiteSpace($accountsFile) -or -not (Test-Path -LiteralPath $accountsFile)) {
        throw 'The account list path does not exist.'
    }

    $countText = Read-Host 'Number of browser windows [2]'
    $count = 2
    if (-not [string]::IsNullOrWhiteSpace($countText)) {
        $count = [int]$countText
    }

    $startText = Read-Host 'Starting account index, zero-based [0]'
    $start = 0
    if (-not [string]::IsNullOrWhiteSpace($startText)) {
        $start = [int]$startText
    }

    $profileRoot = Join-Path $env:LOCALAPPDATA 'XiaolvshuMultiLogin\profiles'
    $profileInput = Read-Host "Profile directory [$profileRoot]"
    if (-not [string]::IsNullOrWhiteSpace($profileInput)) {
        $profileRoot = $profileInput
    }

    $config = [ordered]@{
        accountsFile = $accountsFile
        count = $count
        start = $start
        siteUrl = 'https://xiaolvshu.app/login'
        profileRoot = $profileRoot
        chromePath = ''
    }
    $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    Write-Host "Saved local settings to $configPath"
}

$secureSmsCode = Read-Host 'Shared SMS verification code (leave blank to reuse existing sessions)' -AsSecureString
$smsCodePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSmsCode)
try {
    $smsCode = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($smsCodePointer)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($smsCodePointer)
}
if ([string]::IsNullOrWhiteSpace($smsCode)) {
    Remove-Item Env:XIAOLVSHU_SMS_CODE -ErrorAction SilentlyContinue
}
else {
    $env:XIAOLVSHU_SMS_CODE = $smsCode
}

$exitCode = 0
try {
    & node (Join-Path $projectRoot 'src\index.mjs') --config $configPath
    $exitCode = $LASTEXITCODE
}
finally {
    Remove-Item Env:XIAOLVSHU_SMS_CODE -ErrorAction SilentlyContinue
}

exit $exitCode
