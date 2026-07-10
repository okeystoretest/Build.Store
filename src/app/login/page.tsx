"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
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
 *
 * UX de teclado: Enter no campo Usuário move o foco para Senha (em vez de
 * submeter). O campo Senha tem um botão de olho para mostrar/ocultar o texto.
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // Combina o ref do react-hook-form com o nosso, para poder focar a senha.
  const passwordReg = register("password");

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
            BUILD.STORE - PDV
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-lg space-y-md">
          <div className="space-y-1.5">
            <Label>Usuário</Label>
            <Input
              type="text"
              autoComplete="username"
              placeholder="Ex.: Isabelle"
              {...register("username")}
              onKeyDown={(e) => {
                // Enter no usuário move o foco para a senha (não submete).
                if (e.key === "Enter") {
                  e.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
            />
            {errors.username && (
              <p className="px-2 text-label-sm text-error">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-14"
                {...passwordReg}
                ref={(el) => {
                  passwordReg.ref(el);
                  passwordRef.current = el;
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={1.75} />
                )}
              </button>
            </div>
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
