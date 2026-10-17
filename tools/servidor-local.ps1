# Nebulosa Workspace - servidor local
# Entrega os arquivos do Workspace APENAS para este computador (localhost).
# Nao usa internet e nao envia nada para fora. Baseado no servidor do LePraMim.
# Use quando quiser todos os recursos fora do GitHub Pages (por exemplo, o OCR
# e a voz Piper do LePraMim nao funcionam abrindo o index.html direto do disco).
$ErrorActionPreference = 'Stop'
$raiz = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..'))
$porta = 8780
$endereco = "http://localhost:$porta/"
$tipos = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'; '.json'='application/json';
  '.webmanifest'='application/manifest+json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg';
  '.gif'='image/gif'; '.webp'='image/webp'; '.ico'='image/x-icon'; '.svg'='image/svg+xml';
  '.wasm'='application/wasm'; '.txt'='text/plain; charset=utf-8'; '.md'='text/markdown; charset=utf-8';
  '.woff'='font/woff'; '.woff2'='font/woff2'; '.ttf'='font/ttf'; '.otf'='font/otf';
  '.mp3'='audio/mpeg'; '.wav'='audio/wav'; '.ogg'='audio/ogg'; '.pdf'='application/pdf'; '.xml'='application/xml'
}
$servidor = New-Object System.Net.HttpListener
$servidor.Prefixes.Add($endereco)
try {
  $servidor.Start()
} catch {
  Write-Host " O Nebulosa Workspace ja esta em execucao. Abrindo no navegador..."
  Start-Process $endereco
  exit 0
}
Write-Host " Pronto: $endereco"
Write-Host " Para encerrar, feche esta janela."
Start-Process $endereco
while ($servidor.IsListening) {
  $ctx = $servidor.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '' -or $rel.EndsWith('/')) { $rel = $rel + 'index.html' }
    $arq = [IO.Path]::GetFullPath((Join-Path $raiz $rel))
    $dentro = $arq.StartsWith($raiz.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
    if ($dentro -and (Test-Path -LiteralPath $arq -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($arq).ToLower()
      if ($tipos.ContainsKey($ext)) { $ctx.Response.ContentType = $tipos[$ext] } else { $ctx.Response.ContentType = 'application/octet-stream' }
      $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
      if ($ctx.Request.HttpMethod -eq 'HEAD') {
        $ctx.Response.ContentLength64 = (Get-Item -LiteralPath $arq).Length
      } else {
        $bytes = [IO.File]::ReadAllBytes($arq)
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } else {
      $ctx.Response.StatusCode = 404
    }
  } catch {
    try { $ctx.Response.StatusCode = 500 } catch {}
  } finally {
    try { $ctx.Response.Close() } catch {}
  }
}
