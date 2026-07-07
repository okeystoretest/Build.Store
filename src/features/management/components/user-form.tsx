"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Role } from "@/types/domain";
import { createUser } from "@/lib/db/management-repository";
import { createUserAction } from "@/features/management/actions/create-user";
import { isSupabaseConfigured } from "@/lib/sync/transport";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const userSchema = z.object({
  username: z
    .string()
    .min(3, "Mínimo de 3 caracteres")
    .regex(/^[a-zA-Z0-9 .]+$/, "Use apenas letras, números, espaço ou ponto"),
  fullName: z.string().min(2, "Informe o nome completo"),
  birthDate: z.string().optional(),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
  role: z.enum(["vendedora", "lojista", "admin"]),
});
type UserValues = z.infer<typeof userSchema>;

const ROLE_LABELS: Record<Role, string> = {
  vendedora: "Vendedora",
  lojista: "Lojista",
  admin: "Admin",
};

/**
 * User registration. Fields: username (login), full name, birth date, access
 * level and password — matching the `profiles` table.
 *
 * - Real mode (Supabase): a server action creates the auth user (email derived
 *   from the username) + profile row scoped to the caller's store, then the
 *   Dexie mirror reuses the same id.
 * - Local/demo mode: stored in Dexie only; the password has no auth backend.
 */
export function UserForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "vendedora" },
  });

  const submit = async (values: UserValues) => {
    setServerError(null);
    try {
      const birthDate = values.birthDate || null;

      if (isSupabaseConfigured()) {
        const res = await createUserAction({
          username: values.username,
          password: values.password,
          fullName: values.fullName,
          birthDate,
          role: values.role,
        });
        if (!res.ok) {
          setServerError(res.error);
          return;
        }
        await createUser({
          username: values.username,
          fullName: values.fullName,
          birthDate,
          role: values.role,
          authId: res.authId,
        });
      } else {
        await createUser({
          username: values.username,
          fullName: values.fullName,
          birthDate,
          role: values.role,
        });
      }

      reset({ role: "vendedora", username: "", fullName: "", birthDate: "", password: "" });
      onCreated();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Falha ao cadastrar usuário.");
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-md">
      <div className="space-y-1.5">
        <Label>Nome de usuário</Label>
        <Input {...register("username")} placeholder="Ex.: ana.silva" autoComplete="off" />
        {errors.username && (
          <p className="px-2 text-label-sm text-error">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Nome completo</Label>
        <Input {...register("fullName")} placeholder="Ex.: Ana Silva" />
        {errors.fullName && (
          <p className="px-2 text-label-sm text-error">{errors.fullName.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-md">
        <div className="space-y-1.5">
          <Label>Data de nascimento</Label>
          <Input type="date" {...register("birthDate")} />
        </div>
        <div className="space-y-1.5">
          <Label>Nível de acesso</Label>
          <Select {...register("role")}>
            <option value="vendedora">Vendedora</option>
            <option value="lojista">Lojista</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Senha</Label>
        <Input type="password" {...register("password")} placeholder="••••••••" autoComplete="new-password" />
        {errors.password && (
          <p className="px-2 text-label-sm text-error">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p className="px-2 text-label-sm text-error">{serverError}</p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Cadastrando..." : "Cadastrar usuário"}
      </Button>
    </form>
  );
}

export { ROLE_LABELS };
