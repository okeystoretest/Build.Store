"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLiveQuery } from "dexie-react-hooks";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/sync/transport";
import { usernameToEmail } from "@/lib/auth/username";
import { setLocalUserId } from "@/lib/auth/local-session";
import { db } from "@/lib/db/dexie";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuário"),
  password: z.string().min(1, "Informe a senha"),
});
type LoginValues = z.infer<typeof loginSchema>;

/**
 * Tela de login.
 *
 * - Com Supabase configurado: autentica por usuário + senha. O usuário digita
 *   um nome de usuário, que é mapeado para um e-mail interno (usernameToEmail)
 *   antes da chamada ao Supabase Auth.
 * - Em modo local (sem Supabase): valida o nome de usuário contra os usuários
 *   cadastrados no Dexie e registra a sessão local (seletor de perfil). Não há
 *   verificação de senha offline — a segurança real depende do Supabase.
 */
export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return configured ? <SupabaseLogin /> : <LocalLogin />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-margin">
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-lg shadow-level-2">
        <div className="text-center">
          <h1 className="font-logo text-[2rem] text-primary">Build.Store</h1>
          <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">
            OKEY STORE - PDV
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function SupabaseLogin() {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(values.username),
      password: values.password,
    });
    if (error) {
      setError("Não foi possível entrar. Verifique usuário e senha.");
      return;
    }
    window.location.href = "/pos";
  };

  return (
    <Shell>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-lg space-y-md">
        <div className="space-y-1.5">
          <Label>Usuário</Label>
          <Input
            type="text"
            autoComplete="username"
            placeholder="Ex.: Dev"
            {...register("username")}
          />
          {errors.username && (
            <p className="px-2 text-label-sm text-error">{errors.username.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Senha</Label>
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register("password")}
          />
          {errors.password && (
            <p className="px-2 text-label-sm text-error">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-error-container px-4 py-3 text-label-md text-on-error-container">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </Shell>
  );
}

function LocalLogin() {
  const users = useLiveQuery(() => db.users.toArray(), []);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enter = () => {
    setError(null);
    const slug = username.trim().toLowerCase();
    const match = (users ?? []).find(
      (u) => u.username.toLowerCase() === slug && u.active,
    );
    if (!match) {
      setError("Usuário não encontrado. Verifique o nome de usuário.");
      return;
    }
    setLocalUserId(match.id);
    window.location.href = "/pos";
  };

  return (
    <Shell>
      <div className="mt-lg space-y-md">
        <p className="rounded-md bg-primary-fixed/40 px-4 py-3 text-label-md text-on-surface-variant">
          Modo local ativo. O login seleciona um perfil já cadastrado. Configure
          o Supabase para habilitar autenticação por senha e sincronização.
        </p>

        <div className="space-y-1.5">
          <Label>Usuário</Label>
          <Input
            type="text"
            autoComplete="username"
            placeholder="Ex.: admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enter()}
          />
        </div>

        {error && (
          <p className="rounded-md bg-error-container px-4 py-3 text-label-md text-on-error-container">
            {error}
          </p>
        )}

        <Button onClick={enter} className="w-full" size="lg" disabled={!username.trim()}>
          <LogIn className="h-5 w-5" strokeWidth={2} />
          Entrar
        </Button>

        {users && users.length > 0 && (
          <div className="space-y-1.5 border-t border-outline-variant/40 pt-md">
            <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
              Perfis disponíveis
            </p>
            <div className="flex flex-wrap gap-2">
              {users
                .filter((u) => u.active)
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUsername(u.username)}
                    className="rounded-full bg-surface-container px-4 py-2 text-label-md text-on-surface transition-colors hover:bg-primary-fixed/50"
                  >
                    {u.username}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
