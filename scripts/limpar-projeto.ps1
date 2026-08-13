# limpar-projeto.ps1 — remove do projeto os arquivos que não são mais usados.
#
# COMO RODAR (terminal do VS Code, na RAIZ do projeto):
#   powershell -ExecutionPolicy Bypass -File .\scripts\limpar-projeto.ps1           # simulação
#   powershell -ExecutionPolicy Bypass -File .\scripts\limpar-projeto.ps1 -Apply    # remove
#
# Nada é apagado direto: tudo vai antes para _backup-limpeza-<data>\, com a
# estrutura de pastas preservada. Se algo der errado, é só copiar de volta.
#
# O que é removido e por quê:
#   src/lib/auth/username.ts  Mapeava username → e-mail interno "@build.store",
#                             exigência do Supabase Auth. A auth é própria
#                             (Lucia + Argon2) desde a Fase 2 e o login usa o
#                             username puro. Nenhum arquivo importa este módulo.
#   .env                      Só tem chaves do Supabase (inclusive a
#                             SERVICE_ROLE_KEY) e MANUFACTURER_SYNC_URL. Nenhuma
#                             delas é lida pelo código — as variáveis reais
#                             (DATABASE_URL, CRON_SECRET, MEDIA_DIR...) vêm do
#                             painel do Easypanel. Também sai do índice do git.

param([switch]$Apply)

$ErrorActionPreference = "Stop"

# --- trava de segurança: só roda na raiz do Build.Sales -----------------------
if (-not (Test-Path ".\package.json")) {
    Write-Host "ERRO: rode na RAIZ do projeto (onde está o package.json)." -ForegroundColor Red
    exit 1
}
$pkg = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ($pkg.name -ne "build-store") {
    Write-Host "ERRO: este não parece ser o projeto Build.Sales (package.json name = '$($pkg.name)')." -ForegroundColor Red
    exit 1
}

$alvos = @(
    @{ Path = "src\lib\auth\username.ts"; Motivo = "resquício do Supabase Auth; nenhum import aponta para ele" },
    @{ Path = ".env";                     Motivo = "só chaves do Supabase, nenhuma lida pelo código" }
)

$carimbo = Get-Date -Format "yyyy-MM-dd_HHmm"
$backup  = ".\_backup-limpeza-$carimbo"

if ($Apply) {
    Write-Host "APLICANDO — backup em $backup`n" -ForegroundColor Yellow
} else {
    Write-Host "SIMULAÇÃO (use -Apply para remover de verdade)`n" -ForegroundColor Cyan
}

$removidos = 0
foreach ($a in $alvos) {
    if (-not (Test-Path $a.Path)) {
        Write-Host "  ja ausente  $($a.Path)" -ForegroundColor DarkGray
        continue
    }

    Write-Host "  remover     $($a.Path)" -ForegroundColor White
    Write-Host "              motivo: $($a.Motivo)" -ForegroundColor DarkGray

    if ($Apply) {
        $destino = Join-Path $backup $a.Path
        $pastaDestino = Split-Path $destino -Parent
        if (-not (Test-Path $pastaDestino)) {
            New-Item -ItemType Directory -Path $pastaDestino -Force | Out-Null
        }
        Copy-Item $a.Path $destino -Force
        Remove-Item $a.Path -Force
        $removidos++
    }
}

# --- .env também precisa sair do índice do git -------------------------------
# O .gitignore já lista o .env, mas ele foi commitado ANTES dessa regra existir
# — e um arquivo já rastreado continua rastreado, o ignore não o remove sozinho.
if ($Apply) {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        $rastreado = & git ls-files --error-unmatch .env 2>$null
        if ($LASTEXITCODE -eq 0) {
            & git rm --cached .env --quiet
            Write-Host "`n  .env removido do índice do git (arquivo local ja foi pro backup)." -ForegroundColor Yellow
        }
    } else {
        Write-Host "`n  AVISO: git não encontrado no PATH — rode 'git rm --cached .env' na mão." -ForegroundColor Yellow
    }
}

Write-Host ""
if ($Apply) {
    Write-Host "$removidos arquivo(s) removido(s). Backup: $backup" -ForegroundColor Green
    Write-Host @"

PRÓXIMOS PASSOS
  1. npm run type-check     (deve passar limpo)
  2. npm run build          (deve compilar)
  3. git add -A && git commit -m "remove arquivos nao utilizados" && git push
  4. Apague a pasta $backup quando tiver certeza.

ATENÇÃO: tirar o .env do repositório NÃO apaga as chaves do histórico do git.
Como o repo é público, a SERVICE_ROLE_KEY continua acessível a quem procurar.
O que resolve de fato é DELETAR o projeto Supabase antigo no painel deles —
sem o projeto, a chave não abre nada. (Item #10 da checklist.)
"@ -ForegroundColor Gray
} else {
    Write-Host "Nada foi alterado. Rode com -Apply para valer." -ForegroundColor Cyan
}
