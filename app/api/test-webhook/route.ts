import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log("Test webhook received:", JSON.stringify(body, null, 2))
    
    return NextResponse.json({ 
      success: true, 
      message: "Test webhook received successfully",
      receivedData: body 
    })
  } catch (error) {
    console.error("Error in test webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
