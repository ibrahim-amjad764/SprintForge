// lib/email.ts
import { Resend } from 'resend';

/*
Email Provider Configuration
All application emails
go through this file.
*/

const resend = new Resend(process.env.RESEND_API_KEY);

export default resend;
