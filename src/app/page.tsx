"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { LandingPage } from "@/components/landing/landing-page";
import { LoginDialog } from "@/components/shared/login-dialog";
import { DemoSheet } from "@/components/shared/demo-sheet";
import { InstitutionalPanel } from "@/components/panel/institutional-panel";

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const [loginOpen, setLoginOpen] = useState(false);
  const setModule = useUIStore((s) => s.setModule);

  // Detectar query param ?module=... (para deep links desde PWA shortcuts)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const m = params.get("module");
    if (m) {
      setModule(m as any);
    }
  }, [setModule]);

  // Auto-abrir login si hay un query ?login=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "1") {
      setLoginOpen(true);
    }
  }, []);

  return (
    <>
      {user ? (
        <InstitutionalPanel />
      ) : (
        <LandingPage onLogin={() => setLoginOpen(true)} />
      )}

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      <DemoSheet />

      {/* PWA install prompt nudge — deferido y no intrusivo */}
      <PWAInstallNudge />
    </>
  );
}

function PWAInstallNudge() {
  const [showNudge, setShowNudge] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Solo mostrar después de 8s y si no se ha cerrado antes
      const dismissed = localStorage.getItem("apprende-pwa-dismissed") || localStorage.getItem("aulnea-pwa-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowNudge(true), 8000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!showNudge || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs animate-slide-in-right">
      <div className="hairline rounded-lg bg-[var(--app-card)] p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground grid place-items-center flex-shrink-0 text-xs font-extrabold shadow-sm">
            Ap
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Instalar Apprende</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Acceso rápido desde su escritorio. Funciona offline.
            </div>
            <div className="flex gap-2 mt-3">
              <button
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-medium hover:opacity-90"
                onClick={() => {
                  deferredPrompt.prompt();
                  setShowNudge(false);
                  setDeferredPrompt(null);
                }}
              >
                Instalar
              </button>
              <button
                className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowNudge(false);
                  localStorage.setItem("apprende-pwa-dismissed", "1");
                }}
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
