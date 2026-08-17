"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { loginAction } from "@/features/auth/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/brand-logo";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuário"),
  password: z.string().min(1, "Informe a senha"),
});
type LoginValues = z.infer<typeof loginSchema>;

/**
 * Tela de login (online-only). Autentica por usuário + senha direto contra o
 * Postgres (auth própria com Lucia). Sem e-mail interno: o username é a
 * credencial. Após entrar, o middleware assume a proteção de rota.
 *
 * UX de teclado: Enter no campo Usuário move o foco para Senha (em vez de
 * submeter). O campo Senha tem um botão de olho para mostrar/ocultar o texto.
 *
 * ## Entrada limpa
 *
 * O sucesso NÃO usa o roteador do Next. Trocar de rota por ele preserva o
 * `QueryClient` — e com ele qualquer resquício da sessão anterior ou do estado
 * deslogado, que era exatamente o que deixava a interface incompleta até um
 * `Ctrl+Shift+R`. Aqui o cache é esvaziado e a navegação é de DOCUMENTO: a
 * próxima página nasce com processo novo e com o cookie de sessão já gravado
 * pela resposta da action.
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Mantém o botão em "Entrando..." durante a troca de página — sem isto o
  // formulário voltava ao estado ocioso e convidava a um segundo clique.
  const [entrando, setEntrando] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // Combina o ref do react-hook-form com o nosso, para poder focar a senha.
  const passwordReg = register("password");

  // Chegar ao login (inclusive de volta, pelo botão do navegador) zera o cache:
  // nada do usuário anterior pode atravessar para a próxima sessão.
  useEffect(() => {
    queryClient.clear();
  }, [queryClient]);

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    const fd = new FormData();
    fd.set("username", values.username);
    fd.set("password", values.password);
    const res = await loginAction(null, fd);

    if ("error" in res) {
      setError(res.error);
      return;
    }

    setEntrando(true);
    queryClient.clear();
    // Navegação de documento (não `router.push`): garante cache novo em folha.
    window.location.assign("/pos");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-margin">
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-lg shadow-level-2">
        <div className="text-center">
          <h1 className="flex justify-center">
            <BrandLockup
              markClassName="h-11 w-11"
              wordClassName="text-[2rem]"
            />
          </h1>
          <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">
            BUILD.SALES - PDV
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
            disabled={isSubmitting || entrando}
          >
            {isSubmitting || entrando ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
