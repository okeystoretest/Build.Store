"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Role } from "@/types/domain";
import { createUser } from "@/lib/db/management-repository";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const userSchema = z.object({
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
 * User registration. Fields: full name, birth date, password + access level.
 * Password is collected for the real Supabase Auth flow; in local mode users
 * are stored without credentials (demo only).
 */
export function UserForm({ onCreated }: { onCreated: () => void }) {
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
    await createUser({
      fullName: values.fullName,
      birthDate: values.birthDate || null,
      role: values.role,
    });
    reset({ role: "vendedora", fullName: "", birthDate: "", password: "" });
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-md">
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
        <Input type="password" {...register("password")} placeholder="••••••••" />
        {errors.password && (
          <p className="px-2 text-label-sm text-error">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        Cadastrar usuário
      </Button>
    </form>
  );
}

export { ROLE_LABELS };
