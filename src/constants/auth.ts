export const allowedEmails = ['alamosxxi@gmail.com', 'sanfexxi@gmail.com', 'alamos04u@gmail.com', 'alamos01m@gmail.com', 'alamos02m@gmail.com', 'alamos03t@gmail.com', 'sanfe01f@gmail.com']

const allowedEmailSet = new Set(allowedEmails.map((email) => email.toLowerCase()))

export const isAllowedEmail = (email: string) => allowedEmailSet.has(email.trim().toLowerCase())
