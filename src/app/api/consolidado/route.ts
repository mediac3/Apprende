import { NextRequest, NextResponse } from "next/server";
import { getConsolidadoAnual } from "@/lib/queries/consolidado";

// === [F2] Consolidado anual ===
// GET /api/consolidado?groupId=&hasta=
//   groupId  (requerido): grupo a consolidar
//   hasta    (opcional): order de periodo → vista acumulada hasta ese periodo;
//            sin él se calcula el año completo (consolidado final)
// Misma convención que /api/grade-records: params por query, {ok, error}.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const hastaRaw = searchParams.get("hasta");

  if (!groupId) {
    return NextResponse.json(
      { ok: false, error: "groupId requerido" },
      { status: 400 }
    );
  }
  let hastaOrder: number | undefined;
  if (hastaRaw !== null) {
    hastaOrder = parseInt(hastaRaw, 10);
    if (Number.isNaN(hastaOrder)) {
      return NextResponse.json(
        { ok: false, error: "hasta debe ser numérico" },
        { status: 400 }
      );
    }
  }

  const data = await getConsolidadoAnual({ groupId, hastaOrder });
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Grupo no encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, ...data });
}
