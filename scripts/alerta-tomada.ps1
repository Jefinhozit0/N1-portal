# Aviso em tela cheia quando o notebook do portal sai da tomada. Aberto pelo iniciar-portal.ps1.
# Fecha sozinho quando o carregador volta. Enquanto está aberto, impede o Windows de dormir
# (com a tampa aberta), para o portal continuar no ar até a bateria ficar baixa.
# Para ver como fica sem tirar da tomada:  powershell -ExecutionPolicy Bypass -File scripts\alerta-tomada.ps1 -Teste

param([switch]$Teste)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -Namespace N1 -Name Power -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
'@
$ES_CONTINUOUS = [uint32]"0x80000000"
$ES_SYSTEM_REQUIRED = [uint32]"0x00000001"
# Abaixo disto, deixa o Windows dormir normalmente: melhor dormir do que a bateria acabar com tudo ligado.
$MIN_BATTERY_TO_STAY_AWAKE = 15

function PowerState {
  $online = $true
  try { $online = [bool](Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus -ErrorAction Stop | Select-Object -First 1).PowerOnline } catch {}
  $battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
  $minutes = if ($battery -and $battery.EstimatedRunTime -and $battery.EstimatedRunTime -lt 6000) { [int]$battery.EstimatedRunTime } else { $null }
  [pscustomobject]@{ Online = $online; Percent = if ($battery) { [int]$battery.EstimatedChargeRemaining } else { $null }; Minutes = $minutes }
}

if ((PowerState).Online -and -not $Teste) { exit 0 }
# No teste, o aviso fecha sozinho em 15 segundos.
$testEndsAt = (Get-Date).AddSeconds(15)

$form = New-Object Windows.Forms.Form
$form.Text = "N1 Portal - notebook fora da tomada"
$form.FormBorderStyle = "None"
$form.WindowState = "Maximized"
$form.TopMost = $true
$form.ShowInTaskbar = $true
$form.BackColor = [Drawing.Color]::FromArgb(122, 20, 20)
$form.ForeColor = [Drawing.Color]::White

$layout = New-Object Windows.Forms.TableLayoutPanel
$layout.Dock = "Fill"
$layout.ColumnCount = 1
$layout.RowCount = 6
foreach ($style in @(30, 0, 0, 0, 0, 30)) {
  if ($style) { [void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle([Windows.Forms.SizeType]::Percent, $style))) }
  else { [void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle([Windows.Forms.SizeType]::AutoSize))) }
}
$form.Controls.Add($layout)

function Label($text, $size, $bold) {
  $label = New-Object Windows.Forms.Label
  $label.Text = $text
  $label.AutoSize = $false
  $label.Dock = "Fill"
  $label.TextAlign = "MiddleCenter"
  $label.Font = New-Object Drawing.Font("Segoe UI", $size, $(if ($bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }))
  $label.Height = [int]($size * 2.6)
  $label
}

$title = Label "⚠  O notebook do portal saiu da tomada" 34 $true
$text = Label "Ligue o carregador de volta. Sem tomada, o portal N1 sai do ar para a equipe e para os clientes." 17 $false
$status = Label "" 22 $true
$hint = Label "Este aviso fecha sozinho assim que o carregador for ligado." 13 $false
$hint.ForeColor = [Drawing.Color]::FromArgb(255, 214, 214)

$button = New-Object Windows.Forms.Button
$button.Text = "Esconder por 5 minutos"
$button.Font = New-Object Drawing.Font("Segoe UI", 12)
$button.AutoSize = $true
$button.Padding = New-Object Windows.Forms.Padding(14, 6, 14, 6)
$button.FlatStyle = "Flat"
$button.BackColor = [Drawing.Color]::FromArgb(150, 40, 40)
$button.Anchor = "Top"

[void]$layout.Controls.Add((New-Object Windows.Forms.Label), 0, 0)
[void]$layout.Controls.Add($title, 0, 1)
[void]$layout.Controls.Add($text, 0, 2)
[void]$layout.Controls.Add($status, 0, 3)
$bottom = New-Object Windows.Forms.FlowLayoutPanel
$bottom.FlowDirection = "TopDown"
$bottom.AutoSize = $true
$bottom.Anchor = "Top"
$bottom.WrapContents = $false
[void]$bottom.Controls.Add($hint)
[void]$bottom.Controls.Add($button)
$hint.Width = 900
$hint.Anchor = "Top"
[void]$layout.Controls.Add($bottom, 0, 4)

$script:hiddenUntil = $null
$button.Add_Click({ $script:hiddenUntil = (Get-Date).AddMinutes(5); $form.Hide() })

$timer = New-Object Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({
  $state = PowerState
  if ($Teste) { $state.Online = (Get-Date) -ge $testEndsAt }
  if ($state.Online) {
    [void][N1.Power]::SetThreadExecutionState($ES_CONTINUOUS)
    $timer.Stop()
    $form.Close()
    return
  }
  $awake = $state.Percent -eq $null -or $state.Percent -gt $MIN_BATTERY_TO_STAY_AWAKE
  [void][N1.Power]::SetThreadExecutionState($(if ($awake) { $ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED } else { $ES_CONTINUOUS }))
  $parts = @()
  if ($state.Percent -ne $null) { $parts += "Bateria em $($state.Percent)%" }
  if ($state.Minutes) { $parts += "cerca de $($state.Minutes) min restantes" }
  if (-not $awake) { $parts += "o notebook vai dormir e o portal vai cair" }
  $status.Text = $parts -join "  ·  "
  if ($script:hiddenUntil -and (Get-Date) -ge $script:hiddenUntil) {
    $script:hiddenUntil = $null
    $form.Show()
    $form.WindowState = "Maximized"
    $form.Activate()
  }
})
$form.Add_Shown({ $timer.Start(); $form.Activate() })
# Fechar com Alt+F4 equivale a esconder: o aviso volta em 5 minutos se ainda estiver na bateria.
$form.Add_FormClosing({ param($sender, $e) if (-not $Teste -and -not (PowerState).Online -and $e.CloseReason -eq "UserClosing") { $e.Cancel = $true; $script:hiddenUntil = (Get-Date).AddMinutes(5); $form.Hide() } })

[void][N1.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
[Windows.Forms.Application]::Run($form)
[void][N1.Power]::SetThreadExecutionState($ES_CONTINUOUS)
