"use client";

import { useState } from "react";
import { createCampaign } from "@/lib/db/management-repository";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Create campaign — only a name, per spec. */
export function CampaignForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await createCampaign(trimmed);
      setName("");
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-md">
      <div className="space-y-1.5">
        <Label>Nome da campanha</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Dia das Mães"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      <Button onClick={submit} disabled={saving || !name.trim()}>
        Criar campanha
      </Button>
    </div>
  );
}
