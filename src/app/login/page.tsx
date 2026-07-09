"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/auth/username";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuário"),
  password: z.string().min(1, "Informe a senha"),
});
type LoginValues = z.infer<typeof loginSchema>;

/**
 * Tela de login (online-only). Autentica por usuário + senha: o nome de usuário
 * é mapeado para um e-mail interno (usernameToEmail) antes da chamada ao
 * Supabase Auth. Após entrar, o middleware assume a proteção de rota.
 */
export default function LoginPage() {
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
    <div className="flex min-h-screen items-center justify-center bg-background px-margin">
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-lg shadow-level-2">
        <div className="text-center">
          <h1 className="font-logo text-[2rem] text-primary">Build.Store</h1>
          <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">
            OKEY STORE - PDV
          </p>
        </div>

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
              <p className="px-2 text-label-sm text-error">
                {errors.username.message}
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
      </div>
    </div>
  );
}
