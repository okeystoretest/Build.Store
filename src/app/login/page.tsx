"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/sync/transport";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});
type LoginValues = z.infer<typeof loginSchema>;

/**
 * Login screen. Uses Supabase email/password. In local-only mode there's no
 * backend, so it explains that and links straight into the app.
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setError("Não foi possível entrar. Verifique suas credenciais.");
      return;
    }
    window.location.href = "/pos";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-margin">
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-lg shadow-level-2">
        <div className="text-center">
          <h1 className="text-headline-lg text-primary">Serene</h1>
          <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">
            Premium POS System
          </p>
        </div>

        {!configured ? (
          <div className="mt-lg space-y-md text-center">
            <p className="text-body-md text-on-surface-variant">
              Modo local ativo. Configure o Supabase para habilitar login e
              sincronização em nuvem.
            </p>
            <a href="/pos">
              <Button className="w-full" size="lg">
                Entrar no app (modo local)
              </Button>
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-lg space-y-md">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="voce@loja.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="px-2 text-label-sm text-error">
                  {errors.email.message}
                </p>
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
                <p className="px-2 text-label-sm text-error">
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-md bg-error-container px-4 py-3 text-label-md text-on-error-container">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
