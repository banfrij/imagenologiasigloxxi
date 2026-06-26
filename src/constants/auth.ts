export const allowedEmails = ['alamosxxi@gmail.com', 'sanfexxi@gmail.com']

const allowedEmailSet = new Set(allowedEmails.map((email) => email.toLowerCase()))

export const isAllowedEmail = (email: string) => allowedEmailSet.has(email.trim().toLowerCase())
