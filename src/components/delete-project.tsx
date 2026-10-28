"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions";
export function DeleteProject({ id, ar }: { id: string; ar: boolean }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="delete-control">
      {confirm ? (
        <form action={deleteProject.bind(null, id)}>
          <span>
            {ar
              ? "حذف المشروع وكل ملاحظاته نهائيًا؟"
              : "Permanently delete this project and its notes?"}
          </span>
          <button className="button danger small">
            {ar ? "نعم، احذف" : "Delete permanently"}
          </button>
          <button
            type="button"
            className="button ghost small"
            onClick={() => setConfirm(false)}
          >
            {ar ? "إلغاء" : "Cancel"}
          </button>
        </form>
      ) : (
        <button className="button ghost small" onClick={() => setConfirm(true)}>
          <Trash2 size={14} />
          {ar ? "حذف المشروع" : "Delete project"}
        </button>
      )}
    </div>
  );
}
