import { useState } from "react";
export function InvoiceLogo({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="generator-logo">
      {value && <img src={value} alt="Invoice logo" />}
      <label className="generator-logo-upload">
        {loading ? "Loading logo…" : value ? "Change logo" : "+ Add your logo"}
        <input
          aria-label="Add your logo"
          type="file"
          accept="image/png,image/jpeg"
          disabled={loading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            setLoading(true);
            try {
              if (
                !["image/png", "image/jpeg"].includes(file.type) ||
                file.size > 2 * 1024 * 1024
              )
                throw new Error("Choose a PNG or JPEG logo under 2 MB.");
              const bitmap = await createImageBitmap(file);
              try {
                if (bitmap.width > 8000 || bitmap.height > 8000)
                  throw new Error(
                    "Choose a logo smaller than 8000 pixels per side.",
                  );
                const scale = Math.min(
                  1,
                  600 / bitmap.width,
                  300 / bitmap.height,
                );
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                canvas
                  .getContext("2d")!
                  .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                const logo = canvas.toDataURL("image/png");
                if (logo.length > 350000)
                  throw new Error(
                    "This logo is too detailed. Choose a smaller image.",
                  );
                onChange(logo);
              } finally {
                bitmap.close();
              }
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Could not load this image.",
              );
            } finally {
              setLoading(false);
            }
          }}
        />
      </label>
      {value && (
        <button
          type="button"
          className="generator-remove-logo"
          onClick={() => onChange("")}
        >
          Remove logo
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
