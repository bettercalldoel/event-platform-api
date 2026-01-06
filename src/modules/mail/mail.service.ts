import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // kalau env belum lengkap, biarkan null (supaya tidak crash saat dev/build)
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  private renderTemplate(templateName: string, data: Record<string, any>) {
    // cari file template: src/modules/mail/templates/<templateName>.html
    // NOTE: __dirname = dist/modules/mail (saat build), jadi templates harus ikut ke dist.
    // kalau templates kamu belum ikut, tetap aman karena ada fallback plain text.
    const templatePath = path.join(__dirname, "templates", `${templateName}.html`);

    let html = "";
    try {
      html = fs.readFileSync(templatePath, "utf-8");
    } catch (e) {
      // fallback html sederhana
      html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>${templateName}</h2>
          <pre style="background:#f6f6f6;padding:12px;border-radius:8px">${JSON.stringify(
            data,
            null,
            2
          )}</pre>
        </div>
      `;
    }

    // replace placeholder: {{key}}
    for (const [k, v] of Object.entries(data || {})) {
      const safeVal = String(v ?? "");
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
      html = html.replace(re, safeVal);
    }

    return html;
  }

  async sendEmail(
    to: string,
    subject: string,
    templateName: string,
    data: Record<string, any>
  ) {
    // kalau transporter belum ready, jangan crash (dev/CI)
    if (!this.transporter) {
      console.log("[MAIL] transporter not configured. Skip sending email:", {
        to,
        subject,
        templateName,
        data,
      });
      return;
    }

    const from = process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@example.com";
    const html = this.renderTemplate(templateName, data);

    await this.transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
  }
}
