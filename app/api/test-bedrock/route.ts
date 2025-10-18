import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  console.log("🧪 Testing AWS Bedrock connection...")
  
  try {
    // Test basic connectivity and authentication
    const testResult = await testBedrockConnection()
    
    return NextResponse.json({
      success: true,
      message: "Bedrock connection test completed",
      result: testResult
    })
    
  } catch (error) {
    console.error("❌ Bedrock test failed:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  console.log("🧪 Testing AWS Bedrock with custom message...")
  
  try {
    const body = await req.json()
    const { message = "Hello, can you respond with a simple JSON object like {\"test\": \"success\"}?" } = body
    
    const testResult = await testBedrockWithMessage(message)
    
    return NextResponse.json({
      success: true,
      message: "Bedrock message test completed",
      result: testResult
    })
    
  } catch (error) {
    console.error("❌ Bedrock message test failed:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}

async function testBedrockConnection() {
  const region = process.env.AWS_REGION || 'us-east-1'
  const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
  
  console.log("Testing with region:", region)
  console.log("Testing with model:", modelId)
  
  // Check environment variables
  const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID
  const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY
  
  console.log("Environment check:", {
    hasAccessKey,
    hasSecretKey,
    region
  })
  
  if (!hasAccessKey || !hasSecretKey) {
    throw new Error('AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
  }
  
  // Test with a simple message
  const testMessage = "Respond with exactly this JSON: {\"status\": \"connected\", \"model\": \"claude-3.5-sonnet\"}"
  
  const bedrockPayload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 100,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: testMessage
      }
    ]
  }
  
  console.log("Sending test payload:", JSON.stringify(bedrockPayload, null, 2))
  
  const response = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`, {
    method: 'POST',
    headers: {
      'Authorization': `AWS4-HMAC-SHA256 ${await getAWS4Signature('bedrock-runtime', region, modelId, JSON.stringify(bedrockPayload))}`,
      'Content-Type': 'application/json',
      'X-Amz-Target': `BedrockInvokeModel`,
      'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
    },
    body: JSON.stringify(bedrockPayload)
  })
  
  console.log("Response status:", response.status)
  console.log("Response headers:", Object.fromEntries(response.headers.entries()))
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error("Error response:", errorText)
    throw new Error(`AWS Bedrock API error: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  console.log("Success response:", JSON.stringify(data, null, 2))
  
  return {
    region,
    modelId,
    response: data,
    aiResponse: data.content?.[0]?.text || 'No content in response'
  }
}

async function testBedrockWithMessage(message: string) {
  const region = process.env.AWS_REGION || 'us-east-1'
  const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
  
  const bedrockPayload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 200,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: message
      }
    ]
  }
  
  const response = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`, {
    method: 'POST',
    headers: {
      'Authorization': `AWS4-HMAC-SHA256 ${await getAWS4Signature('bedrock-runtime', region, modelId, JSON.stringify(bedrockPayload))}`,
      'Content-Type': 'application/json',
      'X-Amz-Target': `BedrockInvokeModel`,
      'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
    },
    body: JSON.stringify(bedrockPayload)
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AWS Bedrock API error: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  
  return {
    input: message,
    output: data.content?.[0]?.text || 'No content in response',
    fullResponse: data
  }
}

// AWS4 Signature helper function (same as in chat route)
async function getAWS4Signature(service: string, region: string, modelId: string, payload: string): Promise<string> {
  const crypto = require('crypto')
  
  const accessKey = process.env.AWS_ACCESS_KEY_ID
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY
  
  if (!accessKey || !secretKey) {
    throw new Error('AWS credentials not configured')
  }

  const now = new Date()
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
  
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  
  const canonicalRequest = [
    'POST',
    `/model/${modelId}/invoke`,
    '',
    `host:bedrock-runtime.${region}.amazonaws.com`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:BedrockInvokeModel`,
    '',
    'host;x-amz-date;x-amz-target',
    crypto.createHash('sha256').update(payload).digest('hex')
  ].join('\n')
  
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n')
  
  const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  
  return `Credential=${accessKey}/${credentialScope}, SignedHeaders=host;x-amz-date;x-amz-target, Signature=${signature}`
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const crypto = require('crypto')
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest()
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest()
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
  return kSigning
}
