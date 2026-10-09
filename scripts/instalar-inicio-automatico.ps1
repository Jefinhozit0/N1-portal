# Faz o portal e o túnel ligarem sozinhos quando você entra no Windows, e impede o notebook de
# suspender (ou desligar ao fechar a tampa) enquanto estiver na tomada.
# Rodar uma vez:  powershell -ExecutionPolicy Bypass -File scripts\instalar-inicio-automatico.ps1
# Para desfazer: scripts\remover-inicio-automatico.ps1

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "iniciar-portal.ps1"
$state = Join-Path $PSScriptRoot "energia-anterior.json"

# 1. Tarefa agendada: roda o iniciar-portal.ps1 escondido a cada logon deste usuário.
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName "N1 Portal" -Action $action -Trigger $trigger -Settings $settings -Description "Liga o portal N1 e o túnel do Cloudflare ao entrar no Windows." -Force | Out-Null
Write-Output "Tarefa 'N1 Portal' criada: o portal liga sozinho no próximo logon."

# 2. Energia (só na tomada): nunca suspender e não fazer nada ao fechar a tampa.
#    Guarda os valores atuais para o script de remoção conseguir voltar como estava.
function Read-AcValue($sub, $setting) {
  # powercfg prints the AC value and then the DC value as the last two "0x" lines, in any Windows language.
  $values = @(powercfg /query SCHEME_CURRENT $sub $setting | Select-String "0x[0-9a-fA-F]{8}\s*$")
  if ($values.Count -lt 2) { return $null }
  if ($values[$values.Count - 2].Line -match "0x([0-9a-fA-F]{8})") { return [Convert]::ToInt32($Matches[1], 16) }
  return $null
}
if (-not (Test-Path $state)) {
  @{ standbySeconds = Read-AcValue "SUB_SLEEP" "STANDBYIDLE"; lidAction = Read-AcValue "SUB_BUTTONS" "LIDACTION" } | ConvertTo-Json | Out-File -Encoding utf8 $state
}
powercfg /change standby-timeout-ac 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT
Write-Output "Energia na tomada: sem suspensão e sem ação ao fechar a tampa."
