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

$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) { $cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node -or -not (Test-Path $cloudflared)) {
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
Log "Iniciando portal e túnel."

while ($true) {
  if (-not $tunnel -or $tunnel.HasExited) {
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
