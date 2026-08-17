#!/usr/bin/env node
/**
 * Gera as derivadas (.thumb.webp / .lg.webp) das imagens JÁ gravadas no volume,
 * e faz o inventário do que está lá.
 *
 * A partir desta versão o upload gera as derivadas sozinho; este script existe
 * para o acervo anterior, que não tem nenhuma. Enquanto ele não rodar, as telas
 * continuam funcionando — o `MediaImage` cai no original quando a derivada não
 * existe —, só não ficam mais rápidas.
 *
 * COMO RODAR (dentro do container da app, onde o volume está montado):
 *   node scripts/gerar-derivadas.mjs              # inventário, não grava nada
 *   node scripts/gerar-derivadas.mjs --apply      # gera as derivadas
 *
 * É idempotente: derivada existente é pulada. Pode rodar de novo a qualquer
 * momento, e pode ser interrompido no meio sem estragar nada.
 *
 * O inventário responde as perguntas que ficaram abertas na análise de mídia:
 * quanto do disco é foto e quanto é vídeo, e quantos HEIC existem (formato que
 * grava com sucesso e aparece quebrado no Chrome e no Firefox).
 */

import { readdir, stat, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const APLICAR = process.argv.includes("--apply");
const MEDIA_ROOT = path.resolve(process.env.MEDIA_DIR ?? "/app/data/media");

const LARGURAS = { thumb: 480, lg: 1600 };
const WEBP_QUALITY = 72;

const DERIVAVEIS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const VIDEOS = new Set([".mp4", ".webm", ".mov"]);
const PROBLEMATICOS = new Set([".heic", ".gif"]);

sharp.concurrency(1);

/** Lista recursiva de arquivos do volume. */
async function listar(dir) {
  const saida = [];
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return saida;
  }
  for (const e of entradas) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...(await listar(abs)));
    else if (e.isFile()) saida.push(abs);
  }
  return saida;
}

function ehDerivada(arquivo) {
  return /\.(thumb|lg)\.webp$/.test(arquivo);
}

function caminhoDaVariante(abs, variante) {
  const ponto = abs.lastIndexOf(".");
  const base = ponto > 0 ? abs.slice(0, ponto) : abs;
  return `${base}.${variante}.webp`;
}

async function existe(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function mb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function main() {
  const arquivos = await listar(MEDIA_ROOT);
  if (arquivos.length === 0) {
    console.log(`Nada em ${MEDIA_ROOT}. Volume montado?`);
    return;
  }

  const inventario = {
    imagem: { n: 0, bytes: 0 },
    video: { n: 0, bytes: 0 },
    derivada: { n: 0, bytes: 0 },
    problematico: { n: 0, bytes: 0, exemplos: [] },
    outro: { n: 0, bytes: 0 },
  };

  const paraDerivar = [];

  for (const abs of arquivos) {
    const ext = path.extname(abs).toLowerCase();
    const { size } = await stat(abs);

    if (ehDerivada(abs)) {
      inventario.derivada.n++;
      inventario.derivada.bytes += size;
    } else if (DERIVAVEIS.has(ext)) {
      inventario.imagem.n++;
      inventario.imagem.bytes += size;
      paraDerivar.push({ abs, size });
    } else if (VIDEOS.has(ext)) {
      inventario.video.n++;
      inventario.video.bytes += size;
    } else if (PROBLEMATICOS.has(ext)) {
      inventario.problematico.n++;
      inventario.problematico.bytes += size;
      if (inventario.problematico.exemplos.length < 5) {
        inventario.problematico.exemplos.push(path.relative(MEDIA_ROOT, abs));
      }
    } else {
      inventario.outro.n++;
      inventario.outro.bytes += size;
    }
  }

  const total =
    inventario.imagem.bytes +
    inventario.video.bytes +
    inventario.derivada.bytes +
    inventario.problematico.bytes +
    inventario.outro.bytes;

  const pct = (b) => (total ? ((b / total) * 100).toFixed(1) + "%" : "-");

  console.log(`\nInventário de ${MEDIA_ROOT}`);
  console.log(`  imagens originais  ${String(inventario.imagem.n).padStart(5)}  ${mb(inventario.imagem.bytes).padStart(10)}  ${pct(inventario.imagem.bytes)}`);
  console.log(`  vídeos             ${String(inventario.video.n).padStart(5)}  ${mb(inventario.video.bytes).padStart(10)}  ${pct(inventario.video.bytes)}`);
  console.log(`  derivadas          ${String(inventario.derivada.n).padStart(5)}  ${mb(inventario.derivada.bytes).padStart(10)}  ${pct(inventario.derivada.bytes)}`);
  console.log(`  HEIC/GIF           ${String(inventario.problematico.n).padStart(5)}  ${mb(inventario.problematico.bytes).padStart(10)}  ${pct(inventario.problematico.bytes)}`);
  console.log(`  outros             ${String(inventario.outro.n).padStart(5)}  ${mb(inventario.outro.bytes).padStart(10)}  ${pct(inventario.outro.bytes)}`);
  console.log(`  TOTAL                     ${mb(total)}\n`);

  if (inventario.problematico.n > 0) {
    console.log("HEIC não é renderizado por Chrome nem Firefox, e GIF animado");
    console.log("perde a animação se convertido — os dois ficam sem derivada:");
    for (const ex of inventario.problematico.exemplos) console.log(`  ${ex}`);
    console.log("");
  }

  if (!APLICAR) {
    console.log(`${paraDerivar.length} imagens candidatas. Rode com --apply para gerar as derivadas.`);
    return;
  }

  let geradas = 0;
  let puladas = 0;
  let economia = 0;

  for (const { abs, size } of paraDerivar) {
    for (const [variante, largura] of Object.entries(LARGURAS)) {
      const destino = caminhoDaVariante(abs, variante);
      if (await existe(destino)) {
        puladas++;
        continue;
      }
      try {
        const buffer = await sharp(abs, { failOn: "error" })
          // Orientação do EXIF nos pixels; metadados (inclusive GPS) descartados.
          .rotate()
          .resize({ width: largura, withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY, effort: 4 })
          .toBuffer();

        // Mesma regra do servidor: só vale se ficar menor.
        if (buffer.byteLength >= size) {
          puladas++;
          continue;
        }
        await writeFile(destino, buffer);
        geradas++;
        if (variante === "thumb") economia += size - buffer.byteLength;
      } catch (e) {
        console.log(`  falhou: ${path.relative(MEDIA_ROOT, abs)} (${variante}) — ${e.message}`);
      }
    }
  }

  console.log(`\n${geradas} derivadas geradas, ${puladas} puladas.`);
  console.log(`Economia por tela cheia de miniaturas: ~${mb(economia)} a menos por carregamento completo do acervo.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
