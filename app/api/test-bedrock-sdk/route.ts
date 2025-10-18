import { NextRequest, NextResponse } from "next/server"
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"

export async function GET(req: NextRequest) {
  console.log("🧪 Testing AWS Bedrock with SDK...")
  
  try {
    // Check environment variables
    const region = process.env.AWS_REGION || 'us-east-1'
    const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID
    const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY
    
    console.log("Environment check:", {
      region,
      hasAccessKey,
      hasSecretKey
    })
    
    if (!hasAccessKey || !hasSecretKey) {
      throw new Error('AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
    }
    
    // Create Bedrock client
    const client = new BedrockRuntimeClient({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    })
    
    // Test with Claude 3.5 Sonnet
    const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    
    const input = {
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 100,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: "Respond with exactly this JSON: {\"status\": \"connected\", \"model\": \"claude-3.5-sonnet\"}"
          }
        ]
      })
    }
    
    console.log("Sending request to Bedrock with model:", modelId)
    console.log("Request body:", input.body)
    
    const command = new InvokeModelCommand(input)
    const response = await client.send(command)
    
    console.log("Response received:", {
      statusCode: response.$metadata.httpStatusCode,
      requestId: response.$metadata.requestId,
      bodyLength: response.body?.byteLength
    })
    
    // Parse response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))
    console.log("Response body:", JSON.stringify(responseBody, null, 2))
    
    return NextResponse.json({
      success: true,
      message: "Bedrock SDK test successful",
      metadata: response.$metadata,
      response: responseBody,
      aiResponse: responseBody.content?.[0]?.text || 'No content in response'
    })
    
  } catch (error) {
    console.error("❌ Bedrock SDK test failed:", error)
    
    // Extract more detailed error information
    let errorDetails = {}
    if (error instanceof Error) {
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }
    
    // Check if it's an AWS error
    if (error && typeof error === 'object' && 'name' in error) {
      errorDetails = {
        ...errorDetails,
        awsError: true,
        errorName: (error as any).name,
        errorCode: (error as any).$metadata?.httpStatusCode,
        requestId: (error as any).$metadata?.requestId
      }
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: errorDetails
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  console.log("🧪 Testing AWS Bedrock SDK with custom message...")
  
  try {
    const body = await req.json()
    const { message = "Hello Claude, respond with a simple JSON object" } = body
    
    const region = process.env.AWS_REGION || 'us-east-1'
    
    const client = new BedrockRuntimeClient({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    })
    
    const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    
    const input = {
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 200,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: message
          }
        ]
      })
    }
    
    const command = new InvokeModelCommand(input)
    const response = await client.send(command)
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))
    
    return NextResponse.json({
      success: true,
      message: "Bedrock SDK message test successful",
      input: message,
      output: responseBody.content?.[0]?.text || 'No content in response',
      fullResponse: responseBody
    })
    
  } catch (error) {
    console.error("❌ Bedrock SDK message test failed:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}
