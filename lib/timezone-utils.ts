/**
 * Utility functions for timezone conversion
 * 
 * Design Principle: Store in UTC. Interpret in Local. Display in Local.
 */

/**
 * Convert any timestamp to local timezone as ISO string (for AI tool)
 * @param timestamp - Any timestamp (UTC with Z or local without Z)
 * @param userTimezone - User's timezone (e.g., "America/Vancouver")
 * @returns ISO string in local timezone without Z (e.g., "2024-01-15T07:00:00")
 */
export function convertToLocalTime(timestamp: string, userTimezone: string): string {
  try {
    const date = new Date(timestamp)
    
    // Use Intl.DateTimeFormat with formatToParts for precise control
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    const parts = formatter.formatToParts(date)
    const partsMap: Record<string, string> = {}
    
    for (const part of parts) {
      if (part.type !== 'literal') {
        partsMap[part.type] = part.value
      }
    }
    
    return `${partsMap.year}-${partsMap.month}-${partsMap.day}T${partsMap.hour}:${partsMap.minute}:${partsMap.second}`
  } catch (error) {
    console.error('Error converting to local time:', error)
    return timestamp
  }
}

/**
 * Convert UTC timestamp to local time for display
 * @param utcTimestamp - UTC ISO string (e.g., "2024-01-15T14:00:00Z")
 * @param userTimezone - User's timezone (e.g., "America/Vancouver")
 * @param format - 'short' | 'long' | 'time-only'
 * @returns Formatted local time string
 */
export function formatUTCToLocal(
  utcTimestamp: string,
  userTimezone: string = 'UTC',
  format: 'short' | 'long' | 'time-only' = 'short'
): string {
  try {
    const date = new Date(utcTimestamp)
    
    if (format === 'time-only') {
      return date.toLocaleString('en-US', {
        timeZone: userTimezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
    
    if (format === 'long') {
      return date.toLocaleString('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
    
    // short format (default)
    return date.toLocaleString('en-US', {
      timeZone: userTimezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch (error) {
    console.error('Error formatting UTC to local:', error)
    return utcTimestamp
  }
}

/**
 * Convert a local ISO timestamp (without Z) to UTC ISO string
 * @param localTimestamp - Local ISO timestamp like "2024-01-15T19:30:00"
 * @param userTimezone - User's timezone (e.g., "America/Vancouver")
 * @returns UTC ISO string with Z
 */
export function convertLocalISOToUTC(localTimestamp: string, userTimezone: string): string {
  try {
    console.log(`Converting local timestamp: ${localTimestamp} in timezone: ${userTimezone}`)
    
    // Parse the local timestamp components
    const match = localTimestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
    if (!match) {
      throw new Error(`Invalid timestamp format: ${localTimestamp}`)
    }
    
    const [, year, month, day, hour, minute, second] = match
    
    // Create a date object representing the local time
    const localDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
    console.log(`Local date created: ${localDate.toISOString()}`)
    
    // Get the timezone offset by comparing what the same time would be in UTC vs the user's timezone
    const utcTime = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }))
    const localTimeInTZ = new Date(localDate.toLocaleString('en-US', { timeZone: userTimezone }))
    
    console.log(`UTC time: ${utcTime.toISOString()}, Local time in TZ: ${localTimeInTZ.toISOString()}`)
    
    // Calculate the offset
    const offset = utcTime.getTime() - localTimeInTZ.getTime()
    console.log(`Offset: ${offset}ms`)
    
    // Apply the offset to get the UTC time
    const utcResult = new Date(localDate.getTime() + offset)
    console.log(`Final UTC result: ${utcResult.toISOString()}`)
    
    return utcResult.toISOString()
  } catch (error) {
    console.error('Error converting local ISO to UTC:', error, localTimestamp)
    // Fallback: assume it's already UTC
    return localTimestamp.endsWith('Z') ? localTimestamp : `${localTimestamp}Z`
  }
}

/**
 * Convert a time string in user's timezone to UTC ISO string
 * @param timeString - Time string like "9pm", "2pm", "10am"
 * @param userTimezone - User's timezone (e.g., "America/New_York")
 * @param date - Date to use for the time (defaults to today)
 * @returns UTC ISO string
 */
export function convertUserTimeToUTC(
  timeString: string, 
  userTimezone: string, 
  date: Date = new Date()
): string {
  try {
    // Parse the time string
    const time = parseTimeString(timeString)
    if (!time) {
      throw new Error(`Could not parse time: ${timeString}`)
    }

    // Create a date in the user's timezone
    const userDate = new Date(date)
    userDate.setHours(time.hours, time.minutes, 0, 0)

    // Convert to UTC
    const utcDate = new Date(userDate.toLocaleString("en-US", { timeZone: userTimezone }))
    const utcOffset = userDate.getTime() - utcDate.getTime()
    const utcTime = new Date(userDate.getTime() + utcOffset)

    return utcTime.toISOString()
  } catch (error) {
    console.error('Error converting time to UTC:', error)
    // Fallback to current time
    return new Date().toISOString()
  }
}

/**
 * Parse time string like "9pm", "2pm", "10am"
 */
function parseTimeString(timeString: string): { hours: number; minutes: number } | null {
  const cleanTime = timeString.toLowerCase().trim()
  
  // Match patterns like "9pm", "2pm", "10am", "9:30pm", "2:15pm"
  const match = cleanTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  
  if (!match) return null
  
  let hours = parseInt(match[1])
  const minutes = match[2] ? parseInt(match[2]) : 0
  const period = match[3]
  
  // Convert to 24-hour format
  if (period === 'pm' && hours !== 12) {
    hours += 12
  } else if (period === 'am' && hours === 12) {
    hours = 0
  }
  
  return { hours, minutes }
}

/**
 * Convert AI response times to UTC based on user timezone
 * @param aiResponse - AI response object
 * @param userTimezone - User's timezone
 * @returns Updated AI response with UTC times
 */
export function convertAIResponseTimesToUTC(aiResponse: any, userTimezone: string): any {
  console.log('convertAIResponseTimesToUTC called with:', { action: aiResponse.action, timestamp: aiResponse.timestamp, userTimezone })
  
  if (!aiResponse || !userTimezone) return aiResponse

  // Handle start_activity action - don't convert, AI should return UTC directly
  if (aiResponse.action === 'start_activity') {
    console.log('start_activity detected - no conversion needed, AI should return UTC')
    return aiResponse
  }

  // Handle edit_activities action
  if (aiResponse.action === 'edit_activities' && aiResponse.updates) {
    const updatedResponse = { ...aiResponse }
    updatedResponse.updates = aiResponse.updates.map((update: any) => {
      const newUpdate = { ...update }
      
      // Convert started_at if it's a time string in local time (doesn't end with 'Z')
      if (update.started_at && typeof update.started_at === 'string' && !update.started_at.endsWith('Z')) {
        newUpdate.started_at = convertLocalISOToUTC(update.started_at, userTimezone)
      }
      
      // Convert ended_at if it's a time string in local time (doesn't end with 'Z')
      if (update.ended_at && typeof update.ended_at === 'string' && !update.ended_at.endsWith('Z')) {
        newUpdate.ended_at = convertLocalISOToUTC(update.ended_at, userTimezone)
      }
      
      return newUpdate
    })
    
    return updatedResponse
  }

  // Handle log_past action
  if (aiResponse.action === 'log_past' && aiResponse.entries) {
    const updatedResponse = { ...aiResponse }
    updatedResponse.entries = aiResponse.entries.map((entry: any) => {
      const newEntry = { ...entry }
      
      // Convert start time if it's a local ISO timestamp (doesn't end with 'Z')
      if (entry.start && typeof entry.start === 'string' && !entry.start.endsWith('Z')) {
        newEntry.start = convertLocalISOToUTC(entry.start, userTimezone)
      }
      
      // Convert end time if it's a local ISO timestamp (doesn't end with 'Z')
      if (entry.end && typeof entry.end === 'string' && !entry.end.endsWith('Z')) {
        newEntry.end = convertLocalISOToUTC(entry.end, userTimezone)
      }
      
      return newEntry
    })
    
    return updatedResponse
  }

  return aiResponse
}

