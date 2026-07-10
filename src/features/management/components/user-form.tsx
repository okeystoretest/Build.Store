"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, ImageIcon, Eye, EyeOff } from "lucide-react";
import type { Role } from "@/types/domain";
import { createUserAction } from "@/features/management/actions/create-user";
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
 * Cadastro de usuário (online-only). Uma server action cria o usuário de auth
 * (e-mail derivado do username) + a linha em `profiles`. Ao concluir, chama
 * onCreated para a tela recarregar a lista.
 */
export function UserForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "vendedora" },
  });

  const handlePhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (values: UserValues) => {
    setServerError(null);
    try {
      const birthDate = values.birthDate || null;

      const res = await createUserAction({
        username: values.username,
        password: values.password,
        fullName: values.fullName,
        birthDate,
        role: values.role,
        photoUrl,
      });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }

      reset({
        role: "vendedora",
        username: "",
        fullName: "",
        birthDate: "",
        password: "",
      });
      setPhotoUrl(null);
      onCreated();
    } catch (e) {
      setServerError(
        e instanceof Error ? e.message : "Falha ao cadastrar usuário.",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-md">
      <div className="space-y-1.5">
        <Label>Foto do usuário</Label>
        <div className="flex items-center gap-md">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-surface-container">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Prévia" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-7 w-7 text-on-surface-variant/40" strokeWidth={1.5} />
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-primary-container px-5 py-3 text-label-md text-primary transition-colors hover:bg-primary-fixed/40">
            <Upload className="h-4 w-4" strokeWidth={1.75} />
            Enviar foto
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Nome de usuário</Label>
        <Input {...register("username")} placeholder="Ex.: ana.silva" autoComplete="off" />
        {errors.username && (
          <p className="px-2 text-label-sm text-error">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Nome completo</Label>
        <Input {...register("fullName")} placeholder="Ex.: Ana Silva" autoComplete="name" />
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
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            {...register("password")}
            placeholder="••••••••"
            autoComplete="new-password"
            className="pr-14"
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
