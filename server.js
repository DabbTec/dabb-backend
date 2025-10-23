// dabbtech-backend/server.js
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const OpenAI = require('openai');
const Handlebars = require('handlebars');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- OpenAI Client Initialization ---
const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
});

// --- Mock Database (for demonstration) ---
// In a real application, this data would be stored in a database like MongoDB or PostgreSQL.
let prospects = [
  { id: 1, name: 'Sarah Johnson', email: 'sarah.johnson@techcorp.com', company: 'TechCorp Solutions', service: 'AI Integration', source: 'Website', status: 'new', priority: 'high', lastContact: new Date(Date.now() - 300000), value: '$25,000' },
  { id: 2, name: 'Michael Chen', email: 'michael.chen@innovate.io', company: 'Innovate Digital', service: 'Web Development', source: 'Referral', status: 'contacted', priority: 'medium', lastContact: new Date(Date.now() - 86400000), value: '$15,000' },
];

let consultations = [
  { id: 1, clientName: 'Sarah Johnson', company: 'TechCorp Solutions', service: 'AI Integration Consultation', date: new Date(2024, 9, 5, 14, 0), duration: 60, status: 'confirmed' },
  { id: 2, clientName: 'Michael Chen', company: 'Innovate Digital', service: 'Web Development Strategy', date: new Date(2024, 9, 6, 10, 30), duration: 45, status: 'confirmed' },
];

let emailTemplates = [
  { id: 1, name: 'Welcome New Lead', subject: 'Thank you for your interest in DAB Tech Solutions', category: 'lead_nurturing', content: 'Dear {{client_name}},\n\nThank you for reaching out to DAB Tech Solutions. We look forward to discussing how we can help your team with {{project_name}}.\n\nBest regards,\nThe DAB Tech Team' },
  { id: 2, name: 'Consultation Follow-up', subject: 'Great meeting you - Next steps for {{project_name}}', category: 'consultation', content: 'Hi {{client_name}},\n\nIt was great speaking with you today about {{project_name}}. The next steps are ...\n\nRegards,\nDAB Tech' },
];

// --- Helper: create Nodemailer transporter ---
function createTransporter() {
  // Basic validation: if SMTP env vars are missing, transporter creation will likely fail on send
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: String(port) === '465', // true for 465, false for other ports
    auth: user && pass ? { user, pass } : undefined,
  });
}

// --- API Endpoints ---

// GET all prospects
app.get('/api/prospects', (req, res) => {
  res.json(prospects);
});

// GET all consultations
app.get('/api/consultations', (req, res) => {
  res.json(consultations);
});

// GET all email templates
app.get('/api/templates', (req, res) => {
  res.json(emailTemplates);
});

// POST to create a new prospect
app.post('/api/prospects', (req, res) => {
  const newProspect = { id: Date.now(), ...req.body, lastContact: new Date() };
  prospects.push(newProspect);
  res.status(201).json(newProspect);
});

// POST create a new email template
app.post('/api/templates', (req, res) => {
  const { name, subject, category, content } = req.body || {};

  if (!name || !subject || !content) {
    return res.status(400).json({ error: 'name, subject and content are required' });
  }

  const newTemplate = {
    id: Date.now(),
    name,
    subject,
    category: category || 'uncategorized',
    content,
  };

  emailTemplates.push(newTemplate);
  return res.status(201).json(newTemplate);
});

// POST to send a pre-rendered email (frontend provided full subject/html)
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body; // Expecting pre-filled HTML from a template

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'to, subject and html are required' });
  }

  let transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: `"DAB Tech" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });
    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email." });
  }
});

// POST to render a template by id and/or accept overrides, then send
// Supports:
// - { templateId, recipientName, recipientEmail } -> uses stored template and renders it server-side
// - { recipientEmail, subject, html } -> uses provided subject/html (frontend-edited content)
// - combined: { templateId, recipientName, recipientEmail, subject, html } -> template as base, overrides allowed
app.post('/api/templates/send', async (req, res) => {
  const {
    templateId,
    recipientName,
    recipientEmail,
    subject: overrideSubject,
    html: overrideHtml,
    templateData = {}
  } = req.body || {};

  if (!recipientEmail) {
    return res.status(400).json({ error: 'recipientEmail is required' });
  }

  // Find template if templateId provided
  let template;
  if (templateId !== undefined && templateId !== null) {
    template = emailTemplates.find(t => String(t.id) === String(templateId));
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
  }

  // Build render data for placeholders
  const renderData = Object.assign(
    { client_name: recipientName || '', project_name: templateData.project_name || '' },
    templateData
  );

  // Determine subject/html source (overrides take precedence)
  let subject = overrideSubject || (template ? template.subject : '');
  let html = overrideHtml || (template ? template.content : '');

  // Render templates using Handlebars (if there are placeholders)
  try {
    if (subject && subject.includes('{{')) {
      const sTpl = Handlebars.compile(subject);
      subject = sTpl(renderData);
    }
    if (html && html.includes('{{')) {
      const hTpl = Handlebars.compile(html);
      html = hTpl(renderData);
    }

    // If html appears plain-text (no tags) convert newlines to <br/>
    if (html && !html.trim().startsWith('<')) {
      html = html.replace(/\r\n/g, '\n').replace(/\n/g, '<br/>');
    }
  } catch (err) {
    console.error('Template rendering error:', err);
    return res.status(500).json({ error: 'Template rendering failed' });
  }

  if (!subject || !html) {
    return res.status(400).json({ error: 'subject and html (or a valid template) are required' });
  }

  // Send the email
  let transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: `"DAB Tech" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject,
      html,
    });
    return res.status(200).json({ message: 'Email sent successfully!' });
  } catch (err) {
    console.error('Failed to send templated email:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// --- Chatbot Endpoint (your original streaming approach) ---
app.post('/api/chat', async (req, res) => {
  const { userMessage, systemPrompt } = req.body;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    // Stream the response back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        res.write(`data: ${JSON.stringify(chunk.choices[0].delta.content)}\n\n`);
      }
    }
    res.end();

  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({ error: "Failed to get response from AI." });
  }
});

// --- Server Start ---
app.listen(port, () => {
  console.log(`✅ DabbTech Backend is live on port: ${port}`);
});