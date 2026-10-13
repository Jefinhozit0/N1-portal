# Liga o portal e o túnel do Cloudflare e mantém os dois rodando: se um cair, volta sozinho em até 15 s.
# Roda escondido quando o Windows inicia (veja instalar-inicio-automatico.ps1), mas também pode ser
# usado à mão:  powershell -ExecutionPolicy Bypass -File scripts\iniciar-portal.ps1
# Os registros ficam na pasta logs\ do projeto.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force $logs | Out-Null
function Log($text) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $text" | Out-File -Append -Encoding utf8 (Join-Path $logs "inicio.log") }

# Já está rodando (por exemplo, aberto à mão)? Então não faz nada: duas cópias brigariam pela sessão do WhatsApp.
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  Log "Portal já estava rodando na porta 3000. Nada a fazer."
  exit 0
}

# Com o Tailscale Funnel ligado na porta 3000 (endereço fixo, mantido pelo próprio serviço do Tailscale),
# o túnel do Cloudflare não é usado. Sem ele, volta para o túnel temporário do Cloudflare.
$tailscale = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $tailscale) { $tailscale = "C:\Program Files\Tailscale\tailscale.exe" }
$useTailscale = $false
if (Test-Path $tailscale) {
  $funnel = & $tailscale funnel status 2>$null | Out-String
  $useTailscale = $funnel -match "Funnel on" -and $funnel -match ":3000"
}

$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) { $cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node -or (-not $useTailscale -and -not (Test-Path $cloudflared))) {
  Log "Node ou cloudflared não encontrado. Instale os dois e tente de novo."
  exit 1
}

if (-not (Test-Path (Join-Path $root "dist\index.js"))) {
  Log "Gerando o build de produção..."
  & pnpm build *>> (Join-Path $logs "build.log")
}

$env:NODE_ENV = "production"
$env:PORT = "3000"
$tunnel = $null
$portal = $null
$tunnelDownSince = $null
Log $(if ($useTailscale) { "Iniciando portal (endereço fixo pelo Tailscale Funnel)." } else { "Iniciando portal e túnel." })

# O cloudflared avisa em /ready se está ligado ao Cloudflare (200) ou não (503).
function TunnelReady {
  try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://127.0.0.1:20241/ready").StatusCode -eq 200 } catch { $false }
}

while ($true) {
  # O túnel temporário pode sumir do lado do Cloudflare ("Tunnel not found"): o cloudflared continua
  # aberto tentando para sempre e o endereço deixa de existir. Sem conexão por 2 minutos: religa.
  if ($tunnel -and -not $tunnel.HasExited -and ((Get-Date) - $tunnel.StartTime).TotalSeconds -gt 60) {
    if (TunnelReady) {
      $tunnelDownSince = $null
    } elseif (-not $tunnelDownSince) {
      $tunnelDownSince = Get-Date
    } elseif (((Get-Date) - $tunnelDownSince).TotalSeconds -ge 120) {
      Log "Túnel sem conexão há 2 minutos. Religando (o endereço vai mudar)."
      Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
      $tunnel.WaitForExit(10000) | Out-Null
      $tunnel = $null
      $tunnelDownSince = $null
    }
  }
  if (-not $useTailscale -and (-not $tunnel -or $tunnel.HasExited)) {
    if ($tunnel) { Log "Túnel caiu (código $($tunnel.ExitCode)). Religando." }
    # --metrics fixo: é por ele que o portal descobre o endereço atual do túnel (APP_URL=auto).
    $tunnel = Start-Process -FilePath $cloudflared -ArgumentList @("tunnel", "--url", "http://localhost:3000", "--metrics", "127.0.0.1:20241", "--logfile", (Join-Path $logs "cloudflared.log")) -WindowStyle Hidden -PassThru
  }
  if (-not $portal -or $portal.HasExited) {
    if ($portal) { Log "Portal caiu (código $($portal.ExitCode)). Religando." }
    $out = Join-Path $logs "portal.log"
    $err = Join-Path $logs "portal-erros.log"
    # Guarda o registro da execução anterior antes de começar um novo.
    if (Test-Path $out) { Move-Item -Force $out (Join-Path $logs "portal-anterior.log") }
    if (Test-Path $err) { Move-Item -Force $err (Join-Path $logs "portal-erros-anterior.log") }
    $portal = Start-Process -FilePath $node -ArgumentList "dist/index.js" -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
  }
  Start-Sleep -Seconds 15
}
