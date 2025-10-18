import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Basic test endpoint working",
    timestamp: new Date().toISOString()
  })
}
