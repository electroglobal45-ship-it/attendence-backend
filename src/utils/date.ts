// Get today's date in IST timezone (YYYY-MM-DD format)
export const getTodayIST = (): string => {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000 // IST is UTC+5:30
  const istDate = new Date(now.getTime() + istOffset)
  return istDate.toISOString().split('T')[0]
}

// Get current time in IST
export const getCurrentTimeIST = (): string => {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  return istDate.toISOString()
}

// Format date to readable string
export const formatDate = (date: Date | string): string => {
  const d = new Date(date)
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Format time to readable string
export const formatTime = (date: Date | string): string => {
  const d = new Date(date)
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}
