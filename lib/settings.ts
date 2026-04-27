/**
 * Settings management for Canvas Email System
 * Stores configuration in a JSON file on the server
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { DEFAULT_TEMPLATES, type EmailTemplate } from "./email-templates";

const DATA_DIR = join(process.cwd(), ".data");
const SETTINGS_FILE = join(DATA_DIR, "email-settings.json");
const TEMPLATES_FILE = join(DATA_DIR, "email-templates.json");

export interface EmailSettings {
  canvasBaseUrl: string;
  canvasToken: string;
  courseId: string;
  teacherName: string;
  teacherEmail: string;
  courseName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  twilioSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  daysForward: number;
  daysBack: number;
}

const DEFAULT_SETTINGS: EmailSettings = {
  canvasBaseUrl: "",
  canvasToken: "",
  courseId: "",
  teacherName: "",
  teacherEmail: "",
  courseName: "",
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  twilioSid: "",
  twilioAuthToken: "",
  twilioPhoneNumber: "",
  daysForward: 7,
  daysBack: 14,
};

async function ensureDataDir(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // directory already exists
  }
}

export async function getSettings(): Promise<EmailSettings> {
  await ensureDataDir();
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(
  settings: Partial<EmailSettings>
): Promise<EmailSettings> {
  await ensureDataDir();
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function getTemplates(): Promise<Record<string, EmailTemplate>> {
  await ensureDataDir();
  try {
    const raw = await readFile(TEMPLATES_FILE, "utf-8");
    return { ...DEFAULT_TEMPLATES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_TEMPLATES };
  }
}

export async function saveTemplates(
  templates: Record<string, EmailTemplate>
): Promise<Record<string, EmailTemplate>> {
  await ensureDataDir();
  await writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2), "utf-8");
  return templates;
}

export async function saveTemplate(
  id: string,
  template: EmailTemplate
): Promise<Record<string, EmailTemplate>> {
  const templates = await getTemplates();
  templates[id] = template;
  return saveTemplates(templates);
}
