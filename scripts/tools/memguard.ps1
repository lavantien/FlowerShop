# Single-pass memory guard for FlowerShop project processes.
# Cron-driven via `make memguard`. Exits 1 when the aggregated commit demand
# of project processes exceeds the cap; the largest offender's process tree
# is killed and verified gone before exiting.

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$logDir = Join-Path $repo '.tools'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'memguard.log'

$cfg = (Get-Content (Join-Path $PSScriptRoot 'qa.json') -Raw | ConvertFrom-Json).memguard
$cap = [long]$cfg.capBytes
$include = ($cfg.includePatterns -join '|')
$exclude = ($cfg.excludePatterns -join '|')
$nameFilter = ($cfg.processNames | ForEach-Object { "Name='$_'" }) -join ' OR '

$all = Get-CimInstance Win32_Process -Filter $nameFilter
$mine = $all | Where-Object {
	$_.CommandLine -and $_.CommandLine -match $include -and $_.CommandLine -notmatch $exclude
}

$procs = foreach ($p in $mine) {
	$gp = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
	if ($gp) { [pscustomobject]@{ Pid = $p.ProcessId; Name = $p.Name; Parent = $p.ParentProcessId; Commit = $gp.PagedMemorySize64; WS = $gp.WorkingSet64 } }
}
$commit = if ($procs) { ($procs | Measure-Object Commit -Sum).Sum } else { 0 }
$ws = if ($procs) { ($procs | Measure-Object WS -Sum).Sum } else { 0 }

function Test-Gone($id) { -not (Get-Process -Id $id -ErrorAction SilentlyContinue) }

if ($commit -gt $cap) {
	$offender = $procs | Sort-Object Commit -Descending | Select-Object -First 1
	$children = @()
	$frontier = @($offender.Pid)
	while ($frontier.Count -gt 0) {
		$next = @($all | Where-Object { $frontier -contains $_.ParentProcessId } | ForEach-Object { $_.ProcessId })
		$children += $next
		$frontier = $next
	}
	$tree = (@($offender.Pid) + $children) | Select-Object -Unique
	foreach ($id in ($tree | Sort-Object -Descending)) {
		try { Stop-Process -Id $id -Force -ErrorAction Stop } catch { }
	}
	Start-Sleep 2
	$verified = ($tree | ForEach-Object { Test-Gone $_ }) -notcontains $false
	$msg = "BREACH commit=$([math]::Round($commit/1MB))MB ws=$([math]::Round($ws/1MB))MB cap=$([math]::Round($cap/1MB))MB killed pid=$($offender.Pid) name=$($offender.Name) tree=$($tree -join ',') verified=$verified"
	$msg | Out-File $log -Append
	Write-Output $msg
	if (-not $verified) { exit 2 }
	exit 1
}

$line = "ok commit=$([math]::Round($commit/1MB))MB ws=$([math]::Round($ws/1MB))MB cap=$([math]::Round($cap/1MB))MB procs=$(($procs | Measure-Object).Count)"
$line | Out-File $log -Append
Write-Output $line
exit 0
