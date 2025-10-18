import { NextRequest, NextResponse } from "next/server"
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"

export async function GET(req: NextRequest) {
  console.log("🔍 Debugging AWS Bedrock connection...")
  
  try {
    const region = process.env.AWS_REGION || 'us-east-1'
    
    console.log("Environment variables:", {
      region,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID?.substring(0, 8) + '...',
    })
    
    // Test different model IDs that are commonly available
    const modelsToTest = [
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-5-sonnet-20240620-v1:0', 
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-instant-20240229-v1:0'
    ]
    
    const regionsToTest = ['us-east-1', 'us-west-2', 'eu-west-1']
    
    const results = []
    
    for (const testRegion of regionsToTest) {
      console.log(`Testing region: ${testRegion}`)
      
      try {
        const client = new BedrockRuntimeClient({
          region: testRegion,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }
        })
        
        for (const modelId of modelsToTest) {
          console.log(`Testing model: ${modelId}`)
          
          try {
            const input = {
              modelId: modelId,
              contentType: "application/json",
              accept: "application/json",
              body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 50,
                temperature: 0.1,
                messages: [
                  {
                    role: "user",
                    content: "Say hello"
                  }
                ]
              })
            }
            
            const command = new InvokeModelCommand(input)
            const response = await client.send(command)
            
            const responseBody = JSON.parse(new TextDecoder().decode(response.body))
            
            results.push({
              region: testRegion,
              model: modelId,
              status: 'SUCCESS',
              response: responseBody.content?.[0]?.text || 'No content',
              metadata: response.$metadata
            })
            
            console.log(`✅ SUCCESS: ${testRegion} - ${modelId}`)
            break // If one model works in this region, move to next region
            
          } catch (modelError) {
            console.log(`❌ Model failed: ${modelId} - ${modelError}`)
            results.push({
              region: testRegion,
              model: modelId,
              status: 'FAILED',
              error: modelError instanceof Error ? modelError.message : String(modelError)
            })
          }
        }
        
      } catch (regionError) {
        console.log(`❌ Region failed: ${testRegion} - ${regionError}`)
        results.push({
          region: testRegion,
          model: 'N/A',
          status: 'REGION_FAILED',
          error: regionError instanceof Error ? regionError.message : String(regionError)
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: "Bedrock debug test completed",
      results: results,
      summary: {
        totalTests: results.length,
        successful: results.filter(r => r.status === 'SUCCESS').length,
        failed: results.filter(r => r.status !== 'SUCCESS').length
      }
    })
    
  } catch (error) {
    console.error("❌ Debug test failed:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}
