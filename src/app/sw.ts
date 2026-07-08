/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import {
  Serwist,
  NetworkOnly,
  type PrecacheEntry,
  type SerwistGlobalConfig,
  type RuntimeCaching,
} from "serwist";

// Service worker entry. Serwist precaches the build and applies runtime caching
// so the app shell and last-seen data stay available offline.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Navegações (páginas) NÃO são cacheadas: as rotas do app dependem de sessão e
 * o middleware redireciona entre /login e /pos conforme o estado de auth. O
 * Workbox não consegue armazenar/retornar respostas redirecionadas, o que
 * causava o erro "no-response" ao servir /login do cache. Usamos NetworkOnly
 * para requisições de navegação (mode === "navigate") e mantemos o defaultCache
 * apenas para os demais assets (JS, CSS, imagens, fontes).
 */
const navigationOnlyNetwork: RuntimeCaching = {
  matcher: ({ request }) => request.mode === "navigate",
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [navigationOnlyNetwork, ...defaultCache],
});

serwist.addEventListeners();