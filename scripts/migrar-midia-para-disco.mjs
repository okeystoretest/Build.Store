#!/usr/bin/env node
/**
 * Migra as mídias já gravadas como data URL (base64 dentro do Postgres) para
 * arquivos no volume, reescrevendo as colunas com a URL `/api/media/...`.
 *
 * Cobre:
 *   showcase_media.file_url   (vitrine)
 *   products.image_url        (foto do produto)
 *   order_items.image_url     (cópia da foto no item vendido)
 *   stores.logo_url           (foto da loja)
 *   settings.value            (key = 'store_logo')
 *
 * COMO RODAR (dentro do container da app, onde o volume está montado):
 *   node scripts/migrar-midia-para-disco.mjs            # simulação (dry-run)
 *   node scripts/migrar-midia-para-disco.mjs --apply    # grava de verdade
 *
 * Usa DATABASE_URL e MEDIA_DIR do ambiente. É idempotente: linhas que já estão
 * como /api/media/... são ignoradas, então pode rodar mais de uma vez.
 *
 * Roda como o usuário do app (build_app). A RLS de products/showcase_media
 * bloquearia UPDATE sem identidade — por isso o script usa
 * `set_config('app.current_user_id', <id do admin>, true)` em cada transação,
 * com o admin passado em ADMIN_USER_ID (ou o primeiro profile role=admin).
 */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const MEDIA_ROOT = path.resolve(process.env.MEDIA_DIR ?? "/app/data/media");
const URL_PREFIX = "/api/media";

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Alvos: tabela, coluna do valor, coluna de id, escopo de pasta, filtro extra. */
const TARGETS = [
  { table: "showcase_media", column: "file_url", scope: "showcase" },
  { table: "products", column: "image_url", scope: "products" },
  { table: "order_items", column: "image_url", scope: "products" },
  { table: "stores", column: "logo_url", scope: "stores" },
  {
    table: "settings",
    column: "value",
    scope: "logos",
    // settings tem PK composta (key, store_id) — id sintético via ctid.
    idExpr: "ctid::text",
    idColumn: "ctid",
    where: "key = 'store_logo'",
  },
];

function parseDataUrl(value) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(value ?? "");
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const isBase64 = Boolean(m[2]);
  const ext = EXT_BY_MIME[mime];
  if (!ext) return null;
  const data = isBase64
    ? Buffer.from(m[3], "base64")
    : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return { mime, ext, data };
}

function bucket() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function saveFile(scope, ext, data) {
  const dir = path.join(MEDIA_ROOT, scope, bucket());
  const name = `${randomUUID()}.${ext}`;
  if (APPLY) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), data);
  }
  return `${URL_PREFIX}/${scope}/${bucket()}/${name}`;
}

function mb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL não configurada.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  // Identidade para a RLS enxergar (UPDATE em products/showcase_media).
  let adminId = process.env.ADMIN_USER_ID ?? null;
  if (!adminId) {
    const r = await client.query(
      "select id from profiles where role = 'admin' and active = true order by created_at asc limit 1",
    );
    adminId = r.rows[0]?.id ?? null;
  }
  if (!adminId) {
    console.error(
      "Nenhum admin encontrado. Defina ADMIN_USER_ID com o id de um profile admin.",
    );
    process.exit(1);
  }

  console.log(
    `${APPLY ? "APLICANDO" : "SIMULAÇÃO (use --apply para gravar)"} — destino: ${MEDIA_ROOT}\n`,
  );

  let totalRows = 0;
  let totalBytes = 0;

  for (const t of TARGETS) {
    const idExpr = t.idExpr ?? "id";
    const where = [
      `${t.column} like 'data:%'`,
      ...(t.where ? [t.where] : []),
    ].join(" and ");

    const { rows } = await client.query(
      `select ${idExpr} as _id, ${t.column} as _value from ${t.table} where ${where}`,
    );

    if (rows.length === 0) {
      console.log(`${t.table}.${t.column}: nada a migrar`);
      continue;
    }

    let migrated = 0;
    let bytes = 0;
    let skipped = 0;

    for (const row of rows) {
      const parsed = parseDataUrl(row._value);
      if (!parsed) {
        skipped += 1;
        continue;
      }

      const url = await saveFile(t.scope, parsed.ext, parsed.data);
      bytes += parsed.data.byteLength;

      if (APPLY) {
        await client.query("begin");
        await client.query("select set_config('app.current_user_id', $1, true)", [
          adminId,
        ]);
        await client.query(
          `update ${t.table} set ${t.column} = $1 where ${t.idColumn ?? "id"} = $2`,
          [url, row._id],
        );
        await client.query("commit");
      }
      migrated += 1;
    }

    totalRows += migrated;
    totalBytes += bytes;
    console.log(
      `${t.table}.${t.column}: ${migrated} migrada(s), ${mb(bytes)} MB` +
        (skipped ? ` — ${skipped} ignorada(s) (mime não suportado)` : ""),
    );
  }

  console.log(
    `\nTotal: ${totalRows} mídia(s), ${mb(totalBytes)} MB saindo do banco.`,
  );
  if (!APPLY) console.log("Nada foi gravado. Rode com --apply para valer.");
  console.log(
    "\nDepois de aplicar, rode um VACUUM FULL nas tabelas afetadas para o " +
      "Postgres devolver o espaço ao disco.",
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
