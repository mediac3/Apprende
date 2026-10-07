"use client";

// [Dashboard Padre] Bloque A — saludo cálido del acudiente
export function WelcomeHeader({
  parentName,
  childFirstName,
  groupName,
}: {
  parentName: string;
  childFirstName: string;
  groupName: string | null;
}) {
  const firstName = parentName.split(" ")[0];
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        ¡Hola, {firstName}! 👋
      </h1>
      <p className="text-muted-foreground">
        Aquí está el resumen de{" "}
        <span className="font-medium text-foreground">{childFirstName}</span>
        {groupName ? <span className="text-sm"> · {groupName}</span> : null}
      </p>
    </header>
  );
}
