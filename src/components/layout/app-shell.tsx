"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { useStoreName } from "@/hooks/use-store-name";

/**
 * Shell responsivo das telas autenticadas.
 *
 * - Desktop (lg+): sidebar fixa à esquerda, retrátil (expandida/recolhida). O
 *   estado é persistido em localStorage.
 * - Mobile (< lg): a sidebar vira um drawer que desliza sobre a tela, aberto
 *   por um botão hambúrguer numa barra de topo. Um overlay escurece o fundo e
 *   fecha ao toque.
 */
const COLLAPSE_KEY = "bs:sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Recolhida (desktop). Inicia expandida; hidrata do localStorage no mount.
  const [collapsed, setCollapsed] = useState(false);
  // Drawer aberto (mobile).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const storeName = useStoreName();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Fecha o drawer ao redimensionar para desktop.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setDrawerOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const initials = (storeName || "BS")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Sidebar desktop (retrátil) */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          variant="desktop"
        />
      </div>

      {/* Drawer mobile + overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out lg:hidden " +
          (drawerOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <Sidebar
          collapsed={false}
          variant="mobile"
          onNavigate={() => setDrawerOpen(false)}
        />
      </div>

      {/* Área de conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra de topo (só mobile) */}
        <header className="flex items-center gap-3 border-b border-outline-variant/50 bg-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Menu className="h-6 w-6" strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed/60 text-label-md font-semibold text-primary">
              {initials}
            </span>
            <span className="font-logo text-[1.4rem] leading-none text-primary">
              {storeName}
            </span>
          </div>
        </header>

        {/*
          min-w-0 + overflow-x-hidden: sem isso, um filho flex/grid mais largo
          que a tela empurrava o conteúdo para fora no mobile (cards do carrinho
          e textos apareciam cortados na direita).
        */}
        <main className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
