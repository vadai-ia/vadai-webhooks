"use client";

/**
 * Submit que pide confirmación nativa antes de mandar el form. Para acciones
 * que cuesta revertir (pausar, archivar, reprocesar): un clic suelto en
 * "Pausar" dejó GENCO descartando ventas de junio a octubre de 2026.
 */
export function ConfirmSubmit({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
