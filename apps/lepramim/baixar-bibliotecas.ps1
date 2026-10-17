# LePraMim - baixa as bibliotecas opcionais para a pasta libs (uma unica vez).
# Depois disso o programa funciona totalmente sem internet.
#   Tesseract.js  -> OCR de PDFs digitalizados e imagens
#   lamejs        -> exportar audiobook em MP3
#   Mammoth.js    -> leitura de DOCX (opcional; ja existe um leitor interno)
#   Piper         -> voz neural "Cadu" em portugues do Brasil, sem internet
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$libs = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'libs'
$t = 'https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist'
$c = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0'
$l = 'https://tessdata.projectnaptha.com/4.0.0'
# Voz neural Piper (motor + voz "Cadu", cerca de 90 MB no total)
$o = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist'
$f = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build'
$v = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR'
# Para instalar outras vozes Piper em portugues, acrescente a lista abaixo, por exemplo:
#   @("$v/faber/medium/pt_BR-faber-medium.onnx.json", 'piper\vozes\pt_BR-faber-medium.onnx.json'),
#   @("$v/faber/medium/pt_BR-faber-medium.onnx", 'piper\vozes\pt_BR-faber-medium.onnx'),
$itens = @(
  @("$t/tesseract.min.js", 'tesseract\tesseract.min.js'),
  @("$t/worker.min.js", 'tesseract\worker.min.js'),
  @("$c/tesseract-core.wasm.js", 'tesseract\core\tesseract-core.wasm.js'),
  @("$c/tesseract-core-simd.wasm.js", 'tesseract\core\tesseract-core-simd.wasm.js'),
  @("$c/tesseract-core-lstm.wasm.js", 'tesseract\core\tesseract-core-lstm.wasm.js'),
  @("$c/tesseract-core-simd-lstm.wasm.js", 'tesseract\core\tesseract-core-simd-lstm.wasm.js'),
  @("$l/por.traineddata.gz", 'tesseract\lang\por.traineddata.gz'),
  @("$l/eng.traineddata.gz", 'tesseract\lang\eng.traineddata.gz'),
  @('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js', 'lamejs\lame.min.js'),
  @('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js', 'mammoth\mammoth.browser.min.js'),
  @("$o/ort.wasm.min.js", 'piper\ort\ort.wasm.min.js'),
  @("$o/ort-wasm-simd.wasm", 'piper\ort\ort-wasm-simd.wasm'),
  @("$o/ort-wasm.wasm", 'piper\ort\ort-wasm.wasm'),
  @("$f/piper_phonemize.js", 'piper\phonemize\piper_phonemize.js'),
  @("$f/piper_phonemize.wasm", 'piper\phonemize\piper_phonemize.wasm'),
  @("$f/piper_phonemize.data", 'piper\phonemize\piper_phonemize.data'),
  @("$v/cadu/medium/pt_BR-cadu-medium.onnx.json", 'piper\vozes\pt_BR-cadu-medium.onnx.json'),
  @("$v/cadu/medium/pt_BR-cadu-medium.onnx", 'piper\vozes\pt_BR-cadu-medium.onnx')
)
$falhas = 0
Write-Host ''
Write-Host ' LePraMim - baixando bibliotecas opcionais...'
Write-Host ' (a voz Cadu tem cerca de 60 MB; aguarde)'
Write-Host ''
foreach ($i in $itens) {
  $destino = Join-Path $libs $i[1]
  $pasta = Split-Path -Parent $destino
  if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Force -Path $pasta | Out-Null }
  if ((Test-Path $destino) -and ((Get-Item $destino).Length -gt 1000)) { Write-Host "  ja existe  $($i[1])"; continue }
  try {
    Invoke-WebRequest -Uri $i[0] -OutFile $destino -UseBasicParsing
    Write-Host "  ok         $($i[1])"
  } catch {
    $falhas++
    if (Test-Path $destino) { Remove-Item $destino -Force }
    Write-Host "  FALHOU     $($i[1])  ($($_.Exception.Message))"
  }
}
Write-Host ''
if ($falhas -eq 0) { Write-Host ' Tudo pronto. O LePraMim ja pode ser usado sem internet.' }
else { Write-Host " $falhas arquivo(s) nao foram baixados. Verifique a internet e execute de novo." }
