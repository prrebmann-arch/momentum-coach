"use client";

interface EditedBadgeProps {
  editedAt: string | null;
}

export default function EditedBadge({ editedAt }: EditedBadgeProps) {
  if (!editedAt) return null;

  const formatted = new Date(editedAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span
      title={`Modifié le ${formatted}`}
      className="inline-flex items-center gap-1 text-xs text-gray-500 ml-2"
    >
      <i className="fa-solid fa-pencil" style={{ fontSize: 10 }} />
      Édité
    </span>
  );
}
