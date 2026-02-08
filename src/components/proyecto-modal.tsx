"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export interface ProyectoData {
  id?: number;
  cliente: string;
  servicio_contratado: string;
  estado: string;
  precio: number | "";
  contacto: string;
  estado_pago: string;
  fecha_terminado: string;
}

const EMPTY_FORM: ProyectoData = {
  cliente: "",
  servicio_contratado: "",
  estado: "",
  precio: "",
  contacto: "",
  estado_pago: "",
  fecha_terminado: "",
};

const ESTADOS = ["Agendado!", "Curso hecho :)"];
const ESTADOS_PAGO = ["Por facturar", "esperando pago", "pago completo"];

const SERVICIOS = [
  "Programa acompañamiento",
  "Talleres IA",
  "Hands-On grupales",
  "Cápsulas",
  "Clases particulares",
  "Otro",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: ProyectoData) => Promise<void>;
  initialData?: ProyectoData | null;
  onDelete?: (id: number) => Promise<void>;
}

export function ProyectoModal({
  open,
  onClose,
  onSave,
  initialData,
  onDelete,
}: Props) {
  const [form, setForm] = useState<ProyectoData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isEditing = !!initialData?.id;

  useEffect(() => {
    if (open) {
      setForm(initialData ?? EMPTY_FORM);
    }
  }, [open, initialData]);

  function updateField(field: keyof ProyectoData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClick() {
    if (!onDelete || !form.id) return;
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar este proyecto? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await onDelete(form.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Proyecto" : "Nuevo Proyecto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="cliente">Cliente</Label>
            <Input
              id="cliente"
              placeholder="Nombre del cliente"
              value={form.cliente}
              onChange={(e) => updateField("cliente", e.target.value)}
              required
            />
          </div>

          {/* Servicio + Precio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Servicio Contratado</Label>
              <Select
                value={form.servicio_contratado}
                onValueChange={(v) => updateField("servicio_contratado", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ...SERVICIOS,
                    ...(form.servicio_contratado &&
                    !SERVICIOS.includes(form.servicio_contratado)
                      ? [form.servicio_contratado]
                      : []),
                  ].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="precio">Precio (CLP)</Label>
              <Input
                id="precio"
                type="number"
                min={0}
                placeholder="0"
                value={form.precio}
                onChange={(e) =>
                  updateField(
                    "precio",
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                required
              />
            </div>
          </div>

          {/* Estado + Estado de Pago */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={form.estado}
                onValueChange={(v) => updateField("estado", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado de Pago</Label>
              <Select
                value={form.estado_pago}
                onValueChange={(v) => updateField("estado_pago", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_PAGO.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contacto + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contacto">Contacto</Label>
              <Input
                id="contacto"
                placeholder="Email o teléfono"
                value={form.contacto}
                onChange={(e) => updateField("contacto", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha">Fecha Servicio Terminado</Label>
              <Input
                id="fecha"
                type="date"
                value={form.fecha_terminado}
                onChange={(e) => updateField("fecha_terminado", e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-4">
            {isEditing && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteClick}
                disabled={saving}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            )}
            <div className="ml-auto flex gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Guardando..."
                  : isEditing
                    ? "Actualizar"
                    : "Crear Proyecto"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
