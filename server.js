// dabbtech-backend/server.js
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai'); 
const Handlebars = require('handlebars');
require('dotenv').config(); // Ensure dotenv is initialized first

const app = express();
const port = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- AI Client Initialization ---
const aiClient = new GoogleGenAI({
  apiKey: process.env.VITE_GEMINI_API_KEY, 
});

// --- Mock Database (for demonstration) ---
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

let customEmailTemplates = [
  { id: 101, name: 'AI Welcome Email (HTML)', subject: 'Welcome to DAB Tech Solutions!', content: '<p>Dear <strong>{{client_name}}</strong>,</p><p>We are thrilled to welcome you to the DAB Tech community! Thank you for signing up. You can start exploring our <a href="https://dabtech.solutions/services">services</a> now.</p><p>Best regards,<br>The DAB Tech Team</p>', createdAt: new Date().toISOString() },
  { id: 102, name: 'Project Follow-up (HTML)', subject: 'Following up on your {{project_name}} project', content: '<p>Hi,</p><p>It was a pleasure discussing your <strong>{{project_name}}</strong> project. Please find the detailed proposal attached, or simply reply to this email.</p><p>Thanks,<br>DAB Tech</p>', createdAt: new Date().toISOString() },
  {
    id: 103,
    name: 'Modern Proposal Delivery',
    subject: 'Your Custom AI Solution Proposal is Ready, {{client_name}}!',
    content: `
      <div style="font-family: 'Inter', Arial, sans-serif; background-color: #0F0F0F; color: #FFFFFF; padding: 20px 0;">
        <center>
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; border-collapse: collapse; background-color: #1A1A1A; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);">
            
            <tr>
              <td style="padding: 20px 30px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="display: inline-block; background: linear-gradient(to right, #9ACD32, #ADFF2F); padding: 5px 10px; border-radius: 8px;">
                  <span style="color: #0F0F0F; font-size: 24px; font-weight: 700; line-height: 1;">DAB Tech</span>
                </div>
                <p style="color: #B0B0B0; font-size: 10px; margin: 0; padding-top: 4px;">Solutions</p>
              </td>
            </tr>

            <tr>
              <td style="padding: 40px 30px; text-align: center;">
                <h1 style="color: #FFFFFF; font-size: 28px; font-weight: 700; margin: 0 0 15px; line-height: 1.3;">
                  Your Custom Proposal is Ready!
                </h1>
                <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                  Dear {{client_name}},<br>
                  We are delighted to inform you that the comprehensive proposal for your <strong>{{project_name}}</strong> project is complete and ready for your review.
                </p>
                
                <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    <td align="center" style="border-radius: 6px;" bgcolor="#9ACD32">
                      <a href="https://dabtech.solutions/proposal/{{project_id}}" target="_blank" style="font-size: 16px; font-weight: 600; color: #0F0F0F; text-decoration: none; padding: 12px 25px; border-radius: 6px; border: 1px solid #9ACD32; display: inline-block;">
                        VIEW PROPOSAL NOW
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding: 0 30px 40px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1A1A1A; border-radius: 8px;">
                  <tr>
                    <td style="padding: 20px; background-color: rgba(154, 205, 50, 0.1); border: 1px solid rgba(154, 205, 50, 0.2); border-radius: 8px;">
                      <h3 style="color: #9ACD32; font-size: 18px; margin: 0 0 10px; font-weight: 600;">What's Inside?</h3>
                      <ul style="color: #B0B0B0; font-size: 15px; text-align: left; padding-left: 20px; margin: 0;">
                        <li style="margin-bottom: 8px;">Detailed Technical Roadmap</li>
                        <li style="margin-bottom: 8px;">Phase-by-Phase Investment Breakdown</li>
                        <li>Expected Return on Investment (ROI)</li>
                      </ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 30px 30px; text-align: center;">
                <h3 style="color: #FFFFFF; font-size: 20px; margin: 0 0 10px;">Want to Discuss This?</h3>
                <p style="color: #B0B0B0; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                  We are available for a follow-up consultation to walk through the details.
                </p>
                <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    <td align="center" style="border-radius: 6px;" bgcolor="#ADFF2F">
                      <a href="https://dabtech.solutions/contact-consultation" target="_blank" style="font-size: 14px; font-weight: 600; color: #0F0F0F; text-decoration: none; padding: 10px 20px; border-radius: 6px; border: 1px solid #ADFF2F; display: inline-block;">
                        BOOK FOLLOW-UP CALL
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 30px; text-align: center; background-color: #0F0F0F; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <p style="color: #B0B0B0; font-size: 12px; margin: 0 0 15px;">
                  <a href="mailto:hello@dabtech.solutions" style="color: #B0B0B0; text-decoration: underline;">hello@dabtech.solutions</a> | +1 (555) 123-4567
                </p>
                <p style="color: #6B7280; font-size: 10px; margin: 0;">
                  © 2025 DAB Tech Solutions. All rights reserved.<br>
                  <a href="https://dabtech.solutions/unsubscribe" style="color: #6B7280; text-decoration: underline;">Unsubscribe</a> | <a href="https://dabtech.solutions/privacy" style="color: #6B7280; text-decoration: underline;">Privacy Policy</a>
                </p>
              </td>
            </tr>
          </table>
        </center>
      </div>
    `,
    createdAt: new Date().toISOString()
  }
];

// --- Helper: create Nodemailer transporter ---
function createTransporter() {
  // Read SMTP variables directly from process.env (loaded by dotenv)
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Configuration for Gmail/TLS (Port 587)
  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: false, // Must be false for port 587 (uses STARTTLS)
    auth: {
        user: user,
        pass: pass
    },
    // Adding optional transport options to help with connection errors
    tls: {
        rejectUnauthorized: false // Often required for testing with some providers
    }
  });
}

/**
 * Utility function to introduce a delay.
 * @param {number} ms - Milliseconds to wait.
 */
const delay = ms => new Promise(res => setTimeout(res, ms));

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
        model: "gemini-2.5-flash", 
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser Content: ${userPrompt}` }] }],
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
        console.error("Gemini API call failed after retries:", error);
        throw new Error("AI service unavailable or prompt failed."); 
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
      const subject = subjectMatch[1]?.trim() || "Generated Subject";
      const content = contentMatch[1]?.trim() || "Generated content is missing. Please try again.";
      
      res.status(200).json({ subject, content });
    } else {
      console.error("AI response format was invalid (Parsing Failed). Full response:\n", aiResponse.substring(0, 500));
      res.status(500).json({ error: "AI response format was invalid. Parsing failed." });
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


// --- NEW Custom Template Endpoints ---

// GET all custom templates (metadata)
app.get('/api/custom-templates', (req, res) => {
  res.json(customEmailTemplates.map(t => ({ id: t.id, name: t.name, subject: t.subject, createdAt: t.createdAt })));
});

// GET a single custom template (full content)
app.get('/api/custom-templates/:id', (req, res) => {
  const template = customEmailTemplates.find(t => String(t.id) === req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

// POST to save a new custom template (HTML)
app.post('/api/custom-templates', (req, res) => {
  const { name, subject, content } = req.body || {};

  if (!name || !subject || !content) {
    return res.status(400).json({ error: 'name, subject and content are required' });
  }

  const newTemplate = {
    id: Date.now(),
    name,
    subject,
    content, // Stores HTML content
    createdAt: new Date().toISOString(),
  };

  customEmailTemplates.push(newTemplate);
  return res.status(201).json(newTemplate);
});

// DELETE a custom template
app.delete('/api/custom-templates/:id', (req, res) => {
  const initialLength = customEmailTemplates.length;
  customEmailTemplates = customEmailTemplates.filter(t => String(t.id) !== req.params.id);
  
  if (customEmailTemplates.length < initialLength) {
    res.status(200).json({ message: 'Template deleted successfully' });
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});


// --- Existing/Modified API Endpoints ---

// GET all prospects
app.get('/api/prospects', (req, res) => {
  res.json(prospects);
});

// GET all consultations
app.get('/api/consultations', (req, res) => {
  res.json(consultations);
});

// GET all email templates (old system)
app.get('/api/templates', (req, res) => {
  res.json(emailTemplates);
});

// POST to create a new prospect
app.post('/api/prospects', (req, res) => {
  const newProspect = { id: Date.now(), ...req.body, lastContact: new Date() };
  prospects.push(newProspect);
  res.status(201).json(newProspect);
});

// POST create a new email template (old system)
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
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email." });
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
    templateData = {}
  } = req.body || {};

  if (!recipientEmail) {
    return res.status(400).json({ error: 'recipientEmail is required' });
  }

  let template;
  if (templateId !== undefined && templateId !== null) {
    template = emailTemplates.find(t => String(t.id) === String(templateId));
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
  }

  const renderData = Object.assign(
    { client_name: recipientName || '', project_name: templateData.project_name || '' },
    templateData
  );

  let subject = overrideSubject || (template ? template.subject : '');
  let html = overrideHtml || (template ? template.content : '');

  try {
    if (subject && subject.includes('{{')) {
      const sTpl = Handlebars.compile(subject);
      subject = sTpl(renderData);
    }
    if (html && html.includes('{{')) {
      const hTpl = Handlebars.compile(html);
      html = hTpl(renderData);
    }

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
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser Message: ${userMessage}` }] }],
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
    console.error("Chat API error:", error);
    res.status(500).json({ error: "Failed to get response from AI." });
  }
});

// --- Server Start ---
// app.listen(port, () => {
//   console.log(`✅ DabbTech Backend is live on port: ${port}`);
// });

// Export the app for Vercel
module.exports = app;