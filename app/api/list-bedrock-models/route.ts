import { NextRequest, NextResponse } from "next/server"
import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock"

export async function GET(req: NextRequest) {
  console.log("📋 Listing available Bedrock models...")
  
  try {
    const region = process.env.AWS_REGION || 'us-east-1'
    
    const client = new BedrockClient({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    })
    
    const command = new ListFoundationModelsCommand({})
    const response = await client.send(command)
    
    // Filter for Claude models
    const claudeModels = response.modelSummaries?.filter(model => 
      model.modelId?.includes('claude')
    ) || []
    
    console.log("Found Claude models:", claudeModels.length)
    
    return NextResponse.json({
      success: true,
      message: "Available Bedrock models",
      region: region,
      claudeModels: claudeModels.map(model => ({
        modelId: model.modelId,
        modelName: model.modelName,
        providerName: model.providerName,
        inputModalities: model.inputModalities,
        outputModalities: model.outputModalities,
        inferenceTypesSupported: model.inferenceTypesSupported
      })),
      allModels: response.modelSummaries?.length || 0
    })
    
  } catch (error) {
    console.error("❌ Failed to list models:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}
