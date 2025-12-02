import 'dotenv/config'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,       
    pass: process.env.GOOGLE_APP_PASSWORD,    
  },
  tls: {
    ciphers: 'SSLv3',
  },
})

export async function sendEmail(to, subject, text) {
  const mailOptions = {
    from: process.env.NODEMAILER_EMAIL,
    to,
    subject,
    text,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent:', info.response)
    return info
  } catch (error) {
    console.error('Email send error:', error)
    
    throw error
  }
}
