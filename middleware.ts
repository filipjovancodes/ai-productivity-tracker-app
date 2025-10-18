import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/n8n|api/test-bedrock|api/test-bedrock-sdk|api/test-bedrock-debug|api/test-basic|api/list-bedrock-models|api/chat|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
