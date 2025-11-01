// dabbtech-backend/server.js
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const Handlebars = require('handlebars');
const { Pool } = require('pg'); // Import the Postgres client
require('dotenv').config(); // Ensure dotenv is initialized first

const app = express();
const port = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Database Connection ---
// The pool will automatically use the DATABASE_URL from your .env or Vercel environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // This is required for Vercel Postgres, Supabase, and other cloud providers
  ssl: {
    rejectUnauthorized: false,
  },
});

// --- AI Client Initialization ---
const aiClient = new GoogleGenAI({
  apiKey: process.env.VITE_GEMINI_API_KEY,
});

// --- Helper: create Nodemailer transporter ---
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Configuration for Gmail/TLS (Port 587)
  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: String(port) === '465', // true for 465, false for other ports
    auth: {
      user: user,
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false, // Often required for testing with some providers
    },
  });
}

/**
 * Utility function to introduce a delay.
 * @param {number} ms - Milliseconds to wait.
 */
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Calls Google Gemini with a built-in retry mechanism for temporary 503 errors.
 * @param {string} systemPrompt - Instructions for the AI.
 * @param {string} userPrompt - The user's content.
 * @param {number} maxRetries - Maximum number of attempts.
 * @param {number} delayMs - Delay between retries in milliseconds.
 * @returns {Promise<string>} The AI response text.
 */
async function callGemini(systemPrompt, userPrompt, maxRetries = 3, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Content: ${userPrompt}` }] }],
        config: {
          temperature: 0.5,
        },
      });
      return response.text;
    } catch (error) {
      const isRetryable = error.status === 503 || error.status === 429;

      if (i < maxRetries - 1 && isRetryable) {
        console.warn(`Gemini API call failed (Status ${error.status}). Retrying in ${delayMs}ms...`);
        await delay(delayMs);
        delayMs *= 2; // Exponential backoff
      } else {
        console.error('Gemini API call failed after retries:', error);
        throw new Error('AI service unavailable or prompt failed.');
      }
    }
  }
}

// --- NEW AI API Endpoints (Using Gemini) ---

// POST to generate a full email based on a prompt
app.post('/api/ai/generate-email', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const systemPrompt = `You are a professional email assistant for DAB Tech. Generate a complete email, including a compelling subject line and content body, based on the user's request. Format the content in clean HTML (using <p>, <strong>, <em>, <br/>, and <a> tags only). Separate the subject and content with a clear delimiter.
  Format your response strictly as:
  Subject: [Your Subject Line]
  Content: [Your HTML Content Body]
  Ensure the tone is professional and the content is relevant to the prompt.`;

  try {
    const aiResponse = await callGemini(systemPrompt, prompt);

    const subjectMatch = aiResponse.match(/Subject:\s*(.*?)\s*Content:/s);
    const contentMatch = aiResponse.match(/Content:\s*([\s\S]*)/s);

    if (subjectMatch && contentMatch) {
      const subject = subjectMatch[1]?.trim() || 'Generated Subject';
      const content = contentMatch[1]?.trim() || 'Generated content is missing. Please try again.';

      res.status(200).json({ subject, content });
    } else {
      console.error('AI response format was invalid (Parsing Failed). Full response:\n', aiResponse.substring(0, 500));
      res.status(500).json({ error: 'AI response format was invalid. Parsing failed.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST to improve existing content
app.post('/api/ai/improve-content', async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const systemPrompt = `You are a professional editor. Review the user-provided HTML content. Apply the user's modification instruction. Return ONLY the improved HTML content. Do NOT include any subject line, introduction, or markdown formatting outside of the HTML structure.`;

  try {
    const improvedContent = await callGemini(systemPrompt, content);

    const cleanedContent = improvedContent.replace(/```html|```|```json|```text/g, '').trim();

    res.status(200).json({ improvedContent: cleanedContent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- NEW Custom Template Endpoints (Database-Powered) ---

// GET all custom templates (metadata)
app.get('/api/custom-templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, subject, createdAt FROM custom_email_templates ORDER BY createdAt DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching custom templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET a single custom template (full content)
app.get('/api/custom-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM custom_email_templates WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching custom template:', err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST to save a new custom template (HTML)
app.post('/api/custom-templates', async (req, res) => {
  const { name, subject, content } = req.body || {};

  if (!name || !subject || !content) {
    return res.status(400).json({ error: 'name, subject and content are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO custom_email_templates (name, subject, content, createdAt) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [name, subject, content]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving custom template:', err);
    return res.status(500).json({ error: 'Failed to save template' });
  }
});

// DELETE a custom template
app.delete('/api/custom-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM custom_email_templates WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Template not found' });
    } else {
      res.status(200).json({ message: 'Template deleted successfully' });
    }
  } catch (err) {
    console.error('Error deleting custom template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// --- Existing/Modified API Endpoints (Database-Powered) ---

// GET all prospects
app.get('/api/prospects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prospects ORDER BY lastContact DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching prospects:', err);
    res.status(500).json({ error: 'Failed to fetch prospects' });
  }
});

// GET all consultations
app.get('/api/consultations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM consultations ORDER BY date ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching consultations:', err);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
});

// GET all email templates (old system)
app.get('/api/templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_templates ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching email templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST to create a new prospect
app.post('/api/prospects', async (req, res) => {
  // Extract all potential fields from the frontend form
  const { name, email, company, service, source, status, priority, value, notes } = req.body;
  
  if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const newProspect = await pool.query(
      'INSERT INTO prospects (name, email, company, service, source, status, priority, value, notes, lastContact) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *',
      [name, email, company, service, source, status, priority, value, notes]
    );
    res.status(201).json(newProspect.rows[0]);
  } catch (err) {
    console.error('Error creating prospect:', err);
    res.status(500).json({ error: 'Failed to create prospect' });
  }
});

// POST create a new email template (old system)
app.post('/api/templates', async (req, res) => {
  const { name, subject, category, content } = req.body || {};

  if (!name || !subject || !content) {
    return res.status(400).json({ error: 'name, subject and content are required' });
  }

  try {
    const newTemplate = await pool.query(
      'INSERT INTO email_templates (name, subject, category, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, subject, category || 'uncategorized', content]
    );
    return res.status(201).json(newTemplate.rows[0]);
  } catch (err) {
    console.error('Error creating email template:', err);
    return res.status(500).json({ error: 'Failed to create template' });
  }
});

// UPDATED POST to send a generic email (now supports rich HTML from frontend)
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'to, subject and html are required' });
  }

  let transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: `"DAB Tech" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html, // Sends the rich HTML content directly
    });
    return res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// POST to render a template by id and/or accept overrides, then send (old system)
app.post('/api/templates/send', async (req, res) => {
  const {
    templateId,
    recipientName,
    recipientEmail,
    subject: overrideSubject,
    html: overrideHtml,
    templateData = {},
  } = req.body || {};

  if (!recipientEmail) {
    return res.status(400).json({ error: 'recipientEmail is required' });
  }

  let template;
  if (templateId !== undefined && templateId !== null) {
    try {
      // Fetch the template from the database
      const result = await pool.query('SELECT * FROM email_templates WHERE id = $1', [templateId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }
      template = result.rows[0];
    } catch (err) {
      console.error('Error fetching template for sending:', err);
      return res.status(500).json({ error: 'Database error while fetching template' });
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

// --- Chatbot Endpoint (for streaming chat) ---
app.post('/api/chat', async (req, res) => {
  const { userMessage, systemPrompt } = req.body;

  try {
    const stream = await aiClient.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Message: ${userMessage}` }] }],
    });

    res.setHeader('Content-Type', 'text/event-stream');
    for await (const chunk of stream) {
      if (chunk.text) {
        // Stream text content directly in the data field
        res.write(`data: ${JSON.stringify(chunk.text)}\n\n`);
      }
    }
    res.end();
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Failed to get response from AI.' });
  }
});

// --- Server Start ---
// This app.listen() block is FOR LOCAL DEVELOPMENT ONLY.
// Vercel uses the `module.exports = app;` line instead.
// We check if the environment is Vercel to avoid running app.listen() there.
if (process.env.VERCEL_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`✅ DabbTech Backend is live on port: ${port}`);
  });
}

// Export the app for Vercel
module.exports = app;