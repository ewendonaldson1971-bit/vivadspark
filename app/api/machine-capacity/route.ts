import { NextResponse } from "next/server";
import { parseMachineCapacityCsv } from "../../../lib/machine-capacity";

export const dynamic = "force-dynamic";

const SHEET_ID = "1wxcLbLd9oli2HDIc-_Yec61YmwQjwZDT5F838gLVPtQ";
const SHEET_GID = "204999678";

export async function GET() {
  try {
    const sourceUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      headers: { "User-Agent": "Vivad SPARK machine-capability dashboard" },
    });
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);
    const machines = parseMachineCapacityCsv(await response.text());
    if (!machines.length) throw new Error("No valid machine capability rows were found.");
    return NextResponse.json({ machines, refreshedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Machine capability feed failed", error instanceof Error ? error.message : "source error");
    return NextResponse.json({ machines: [], error: "Machine capability data is temporarily unavailable." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
