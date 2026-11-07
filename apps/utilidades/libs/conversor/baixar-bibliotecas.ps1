# Utilidades - baixa FFmpeg e ImageMagick (WebAssembly) para esta pasta, uma unica vez.
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$cdn = 'https://cdn.jsdelivr.net/npm'
$itens = @(
  @("$cdn/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js", 'ffmpeg\ffmpeg-core.js'),
  @("$cdn/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm", 'ffmpeg\ffmpeg-core.wasm'),
  @("$cdn/@imagemagick/magick-wasm@0.0.45/dist/index.umd.cjs", 'magick\magick.umd.js'),
  @("$cdn/@imagemagick/magick-wasm@0.0.45/dist/x86/magick.wasm", 'magick\magick.wasm')
)
foreach ($i in $itens) {
  $dest = Join-Path $aqui $i[1]
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  Write-Host "Baixando $($i[1]) ..."
  try { Invoke-WebRequest -Uri $i[0] -OutFile $dest -UseBasicParsing } catch { Write-Host "FALHOU: $($i[0])"; if (Test-Path $dest) { Remove-Item $dest } }
}
Write-Host 'Pronto. O Conversor de arquivos passa a usar estes arquivos, sem perguntar nada.'
