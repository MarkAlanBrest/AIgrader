import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FlaskConical, FileText, BookOpen, Type, Pencil, ClipboardList,
  GraduationCap, Presentation, Settings, X, Upload, Trash2, ChevronDown,
  ChevronRight, Loader2, Download, Lock, Lightbulb, RefreshCw, ArrowLeft,
  FileUp, FileDown, Sparkles, Plus
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import PptxGenJS from 'pptxgenjs';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { BUILDERS, CATEGORIES, BACKEND_URL, PIN } from './builderConfigs';
import type { BuilderConfig, BuilderOption, Recommendation, RecommendationSet } from './types';

// Configure PDF.js worker using bundled worker from npm package
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─── Icon mapping ───
const BUILDER_ICONS: Record<string, React.ReactNode> = {
  lab: <FlaskConical size={16} />,
  worksheet: <FileText size={16} />,
  studyguide: <BookOpen size={16} />,
  terminology: <Type size={16} />,
  custom: <Pencil size={16} />,
  test: <ClipboardList size={16} />,
  lessonplan: <GraduationCap size={16} />,
  ppt: <Presentation size={16} />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Assignments: <FileText size={14} />,
  Tests: <ClipboardList size={14} />,
  Lessons: <GraduationCap size={14} />,
  Presentation: <Presentation size={14} />,
};

const RECOMMENDATION_TYPE_ICONS: Record<string, React.ReactNode> = {
  lab: <FlaskConical size={20} className="text-green-400" />,
  worksheet: <FileText size={20} className="text-blue-400" />,
  studyguide: <BookOpen size={20} className="text-yellow-400" />,
  terminology: <Type size={20} className="text-cyan-400" />,
  custom: <Pencil size={20} className="text-pink-400" />,
  test: <ClipboardList size={20} className="text-red-400" />,
  lessonplan: <GraduationCap size={20} className="text-purple-400" />,
  ppt: <Presentation size={20} className="text-orange-400" />,
};

// ─── PIN Auth Gate ───
function PinGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('edubuilder-auth') === 'true');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(() => {
    if (pin === PIN) {
      sessionStorage.setItem('edubuilder-auth', 'true');
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  }, [pin]);

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className={`bg-gray-800/80 border border-gray-700 rounded-2xl p-8 w-80 text-center shadow-2xl ${shake ? 'animate-shake' : ''}`}>
        <Lock className="mx-auto mb-4 text-blue-400" size={32} />
        <h2 className="text-white text-lg font-semibold mb-1">EduBuilder</h2>
        <p className="text-gray-400 text-sm mb-6">Enter PIN to continue</p>
        <input
          type="password"
          value={pin}
          onChange={e => { setPin(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-center text-lg tracking-widest focus:outline-none focus:border-blue-500 mb-3"
          placeholder="• • • •"
          maxLength={8}
          autoFocus
        />
        {error && <p className="text-red-400 text-xs mb-2">Incorrect PIN</p>}
        <button onClick={submit} className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 font-medium transition-colors">
          Unlock
        </button>
      </div>
    </div>
  );
}

// ─── Settings Modal ───
function SettingsModal({ show, onClose, apiKey, setApiKey, unsplashKey, setUnsplashKey }: {
  show: boolean; onClose: () => void; apiKey: string; setApiKey: (k: string) => void;
  unsplashKey: string; setUnsplashKey: (k: string) => void;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <label className="block text-gray-400 text-xs mb-1">Anthropic API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value); localStorage.setItem('edubuilder-api-key', e.target.value); }}
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-blue-500"
          placeholder="sk-ant-..."
        />
        <label className="block text-gray-400 text-xs mb-1">Unsplash API Key <span className="text-gray-600">(for PowerPoint images)</span></label>
        <input
          type="password"
          value={unsplashKey}
          onChange={e => { setUnsplashKey(e.target.value); localStorage.setItem('edubuilder-unsplash-key', e.target.value); }}
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-blue-500"
          placeholder="Access key from unsplash.com/developers"
        />
        <p className="text-gray-500 text-xs">Your keys are stored in this browser only.</p>
      </div>
    </div>
  );
}

// ─── Option Renderer ───
function OptionRow({ opt, value, onChange }: {
  opt: BuilderOption; value: string | number | boolean; onChange: (v: string | number | boolean) => void;
}) {
  if (opt.type === 'divider') return <hr className="border-gray-700 my-3" />;
  if (opt.type === 'label') return <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mt-2">{opt.label}</p>;

  if (opt.type === 'select') {
    return (
      <div className="mb-2">
        <label className="text-gray-400 text-xs mb-1 block">{opt.label}</label>
        <select
          value={String(value)}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          {(opt.options as string[])?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (opt.type === 'toggle') {
    return (
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-gray-300 text-sm">{opt.label}</span>
        <button
          onClick={() => onChange(!value)}
          className={`w-9 h-5 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-gray-600'} relative`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>
    );
  }

  if (opt.type === 'slider') {
    return (
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <label className="text-gray-400 text-xs">{opt.label}</label>
          <span className="text-white text-xs font-mono">{value}</span>
        </div>
        <input
          type="range"
          min={opt.min} max={opt.max} step={opt.step}
          value={Number(value)}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    );
  }

  if (opt.type === 'textarea') {
    return (
      <div className="mb-2">
        <label className="text-gray-400 text-xs mb-1 block">{opt.label}</label>
        <textarea
          value={String(value || '')}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 h-24 resize-none"
          placeholder={opt.placeholder}
        />
      </div>
    );
  }

  if (opt.type === 'chips') {
    const items = opt.items || [];
    return (
      <div className="mb-2">
        <label className="text-gray-400 text-xs mb-1 block">{opt.label}</label>
        <div className="flex flex-wrap gap-1.5">
          {items.map(it => (
            <button
              key={it.value}
              onClick={() => onChange(it.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                value === it.value ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// ─── File upload helpers ───
async function extractFileText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  try {
    // Plain text files
    if (['txt', 'csv', 'rtf', 'md'].includes(ext)) {
      return await file.text();
    }

    // PDF files - use pdf.js
    if (ext === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items
          .filter(item => 'str' in item)
          .map(item => (item as { str: string }).str);
        pages.push(strings.join(' '));
      }
      return pages.join('\n\n');
    }

    // DOCX files - use mammoth
    if (['docx', 'doc'].includes(ext)) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    // Fallback: try to read as text
    return await file.text();
  } catch (err) {
    console.error('File extraction error:', err);
    alert(`Could not extract text from "${file.name}". Supported formats: PDF, DOCX, TXT, CSV, MD.`);
    return '';
  }
}

// ─── DOCX generation ───
function generateDocx(title: string, data: Record<string, unknown>): Document {
  const children: Paragraph[] = [];

  children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));

  if (data.objective) {
    children.push(new Paragraph({ text: 'Objective', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.objective), spacing: { after: 200 } }));
  }

  if (data.overview) {
    children.push(new Paragraph({ text: 'Overview', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.overview), spacing: { after: 200 } }));
  }

  if (data.instructions) {
    children.push(new Paragraph({ text: 'Instructions', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.instructions), spacing: { after: 200 } }));
  }

  if (data.duration) {
    children.push(new Paragraph({ text: `Duration: ${data.duration}`, spacing: { after: 200 } }));
  }

  if (data.objectives && Array.isArray(data.objectives)) {
    children.push(new Paragraph({ text: 'Learning Objectives', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.objectives as string[]).forEach(obj => {
      children.push(new Paragraph({ text: obj, bullet: { level: 0 }, spacing: { after: 50 } }));
    });
  }

  if (data.standards) {
    children.push(new Paragraph({ text: 'Standards Alignment', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.standards), spacing: { after: 200 } }));
  }

  if (data.safety && Array.isArray(data.safety)) {
    children.push(new Paragraph({ text: 'Safety Warnings', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.safety as string[]).forEach(w => {
      children.push(new Paragraph({ text: `⚠ ${w}`, spacing: { after: 50 } }));
    });
  }

  if (data.materials && Array.isArray(data.materials)) {
    children.push(new Paragraph({ text: 'Materials', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.materials as string[]).forEach(m => {
      children.push(new Paragraph({ text: m, bullet: { level: 0 }, spacing: { after: 50 } }));
    });
  }

  if (data.background) {
    children.push(new Paragraph({ text: 'Background', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.background), spacing: { after: 200 } }));
  }

  if (data.procedure && Array.isArray(data.procedure)) {
    children.push(new Paragraph({ text: 'Procedure', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    if (typeof data.procedure[0] === 'string') {
      (data.procedure as string[]).forEach((step, i) => {
        children.push(new Paragraph({ text: `${i + 1}. ${step}`, spacing: { after: 80 } }));
      });
    } else {
      (data.procedure as Array<Record<string, string>>).forEach((step, i) => {
        children.push(new Paragraph({
          text: `${step.phase || `Phase ${i + 1}`} (${step.duration || ''})`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 50 }
        }));
        if (step.activity) children.push(new Paragraph({ text: step.activity, spacing: { after: 50 } }));
        if (step.teacherActions) children.push(new Paragraph({ text: `Teacher: ${step.teacherActions}`, spacing: { after: 50 } }));
        if (step.studentActions) children.push(new Paragraph({ text: `Students: ${step.studentActions}`, spacing: { after: 50 } }));
      });
    }
  }

  if (data.preLabQuestions && Array.isArray(data.preLabQuestions)) {
    children.push(new Paragraph({ text: 'Pre-Lab Questions', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.preLabQuestions as string[]).forEach((q, i) => {
      children.push(new Paragraph({ text: `${i + 1}. ${q}`, spacing: { after: 80 } }));
    });
  }

  if (data.dataSection) {
    children.push(new Paragraph({ text: 'Data Collection', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.dataSection), spacing: { after: 200 } }));
  }

  if (data.analysisQuestions && Array.isArray(data.analysisQuestions)) {
    children.push(new Paragraph({ text: 'Analysis Questions', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.analysisQuestions as string[]).forEach((q, i) => {
      children.push(new Paragraph({ text: `${i + 1}. ${q}`, spacing: { after: 80 } }));
    });
  }

  if (data.conclusion) {
    children.push(new Paragraph({ text: 'Conclusion', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.conclusion), spacing: { after: 200 } }));
  }

  // Sections (study guide, custom, lesson plan)
  if (data.sections && Array.isArray(data.sections)) {
    (data.sections as Array<Record<string, unknown>>).forEach(sec => {
      if (sec.heading || sec.name) {
        children.push(new Paragraph({
          text: String(sec.heading || sec.name),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 }
        }));
      }
      if (sec.instructions) children.push(new Paragraph({ text: String(sec.instructions), spacing: { after: 100 } }));
      if (sec.content) children.push(new Paragraph({ text: String(sec.content), spacing: { after: 150 } }));
      if (sec.keyPoints && Array.isArray(sec.keyPoints)) {
        (sec.keyPoints as string[]).forEach(p => {
          children.push(new Paragraph({ text: p, bullet: { level: 0 }, spacing: { after: 50 } }));
        });
      }
      if (sec.questions && Array.isArray(sec.questions)) {
        (sec.questions as Array<Record<string, unknown>>).forEach(q => {
          const num = q.number || '';
          const pts = q.points ? ` (${q.points} pts)` : '';
          children.push(new Paragraph({ text: `${num}. ${q.question}${pts}`, spacing: { before: 100, after: 50 } }));
          if (q.options && Array.isArray(q.options)) {
            (q.options as string[]).forEach(o => {
              children.push(new Paragraph({ text: `    ${o}`, spacing: { after: 30 } }));
            });
          }
        });
      }
    });
  }

  // Questions (worksheet, test)
  if (data.questions && Array.isArray(data.questions)) {
    children.push(new Paragraph({ text: 'Questions', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.questions as Array<Record<string, unknown>>).forEach(q => {
      const num = q.number || '';
      const pts = q.points ? ` (${q.points} pts)` : '';
      children.push(new Paragraph({ text: `${num}. ${q.question}${pts}`, spacing: { before: 100, after: 50 } }));
      if (q.options && Array.isArray(q.options)) {
        (q.options as string[]).forEach(o => {
          children.push(new Paragraph({ text: `    ${o}`, spacing: { after: 30 } }));
        });
      }
    });
  }

  // Key terms (terminology, study guide)
  if (data.keyTerms && Array.isArray(data.keyTerms)) {
    children.push(new Paragraph({ text: 'Key Terms', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.keyTerms as Array<Record<string, string>>).forEach(t => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${t.term}: `, bold: true }),
          new TextRun({ text: t.definition }),
        ],
        spacing: { after: 80 }
      }));
    });
  }

  // Terms (terminology sheet)
  if (data.terms && Array.isArray(data.terms)) {
    children.push(new Paragraph({ text: 'Terms', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.terms as Array<Record<string, string>>).forEach(t => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${t.term}: `, bold: true }),
          new TextRun({ text: t.definition }),
        ],
        spacing: { after: 60 }
      }));
      if (t.example) {
        children.push(new Paragraph({ text: `  Example: ${t.example}`, spacing: { after: 40 } }));
      }
    });
  }

  // Word bank
  if (data.wordBank && Array.isArray(data.wordBank)) {
    children.push(new Paragraph({ text: 'Word Bank', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: (data.wordBank as string[]).join('  |  '), spacing: { after: 200 } }));
  }

  // Summary
  if (data.summary) {
    children.push(new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.summary), spacing: { after: 200 } }));
  }

  // Practice questions
  if (data.practiceQuestions && Array.isArray(data.practiceQuestions)) {
    children.push(new Paragraph({ text: 'Practice Questions', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.practiceQuestions as string[]).forEach((q, i) => {
      children.push(new Paragraph({ text: `${i + 1}. ${q}`, spacing: { after: 80 } }));
    });
  }

  // Tips
  if (data.tips && Array.isArray(data.tips)) {
    children.push(new Paragraph({ text: 'Tips & Mnemonics', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.tips as string[]).forEach(t => {
      children.push(new Paragraph({ text: `💡 ${t}`, spacing: { after: 50 } }));
    });
  }

  // Differentiation
  if (data.differentiation) {
    children.push(new Paragraph({ text: 'Differentiation', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.differentiation), spacing: { after: 200 } }));
  }

  // Assessment
  if (data.assessment) {
    children.push(new Paragraph({ text: 'Assessment', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.assessment), spacing: { after: 200 } }));
  }

  // Homework
  if (data.homework) {
    children.push(new Paragraph({ text: 'Homework / Follow-up', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.homework), spacing: { after: 200 } }));
  }

  // Reflection
  if (data.reflection) {
    children.push(new Paragraph({ text: 'Reflection', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ text: String(data.reflection), spacing: { after: 200 } }));
  }

  // Rubric
  if (data.rubric && Array.isArray(data.rubric)) {
    children.push(new Paragraph({ text: 'Rubric', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    (data.rubric as Array<Record<string, unknown>>).forEach(r => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${r.criteria} (${r.points} pts): `, bold: true }),
          new TextRun({ text: String(r.description) }),
        ],
        spacing: { after: 80 }
      }));
    });
  }

  // Total points
  if (data.totalPoints) {
    children.push(new Paragraph({ text: `Total Points: ${data.totalPoints}`, spacing: { before: 200, after: 200 } }));
  }

  return new Document({
    sections: [{ children }]
  });
}

// ─── PPTX generation ───
async function fetchUnsplashImage(query: string, unsplashKey: string): Promise<string | null> {
  if (!unsplashKey || !query) return null;
  try {
    const resp = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
      headers: { Authorization: `Client-ID ${unsplashKey}` },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.results?.[0]?.urls?.regular || null;
  } catch {
    return null;
  }
}

async function generatePptx(data: Record<string, unknown>, _opts: Record<string, string | number | boolean>, unsplashKey?: string): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const slides = (data.slides || []) as Array<Record<string, unknown>>;
  const accentColors: Record<string, string> = { Blue: '2563EB', Teal: '0D9488', Purple: '7C3AED', Red: 'DC2626', Green: '16A34A' };
  const accent = accentColors[String(_opts['ppt-color'] || 'Blue')] || '2563EB';
  const includeImages = _opts['ppt-images'] !== false;

  for (const slideData of slides) {
    const slide = pptx.addSlide();

    if (slideData.type === 'title') {
      slide.addText(String(slideData.title || data.title || 'Presentation'), {
        x: 0.5, y: 1.5, w: 12, h: 1.5,
        fontSize: 36, color: 'FFFFFF', bold: true, align: 'center',
      });
      if (slideData.subtitle || data.subtitle) {
        slide.addText(String(slideData.subtitle || data.subtitle || ''), {
          x: 0.5, y: 3.2, w: 12, h: 0.8,
          fontSize: 18, color: 'AAAAAA', align: 'center',
        });
      }
      slide.background = { color: '1a1a2e' };
    } else if (slideData.type === 'agenda') {
      slide.addText(String(slideData.title || 'Agenda'), {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 28, color: accent, bold: true,
      });
      const items = (slideData.agendaItems || slideData.bullets || []) as string[];
      items.forEach((item, i) => {
        slide.addText(`${i + 1}.  ${item}`, {
          x: 1, y: 1.4 + i * 0.55, w: 11, h: 0.5,
          fontSize: 16, color: '333333',
        });
      });
    } else if (slideData.type === 'summary') {
      slide.addText(String(slideData.title || 'Summary'), {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 28, color: accent, bold: true,
      });
      const bullets = (slideData.bullets || []) as string[];
      bullets.forEach((b, i) => {
        slide.addText(b, {
          x: 1, y: 1.4 + i * 0.55, w: 11, h: 0.5,
          fontSize: 14, color: '444444',
        });
      });
    } else {
      // Content slide
      const hasImage = includeImages && unsplashKey && slideData.imageSearchTerm;
      const bulletWidth = hasImage ? 7 : 11;
      slide.addText(String(slideData.title || ''), {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, color: accent, bold: true,
      });
      const bullets = (slideData.bullets || []) as string[];
      bullets.forEach((b, i) => {
        slide.addText(b, {
          x: 1, y: 1.3 + i * 0.55, w: bulletWidth, h: 0.5,
          fontSize: 14, color: '333333',
        });
      });
      if (hasImage) {
        const imgUrl = await fetchUnsplashImage(String(slideData.imageSearchTerm), unsplashKey!);
        if (imgUrl) {
          slide.addImage({ path: imgUrl, x: 8.5, y: 1.3, w: 4, h: 3 });
        }
      }
      if (slideData.keyTakeaway) {
        slide.addText(`Key: ${slideData.keyTakeaway}`, {
          x: 0.5, y: 6.2, w: 12, h: 0.5,
          fontSize: 12, color: accent, italic: true,
        });
      }
    }

    if (slideData.speakerNotes) {
      slide.addNotes(String(slideData.speakerNotes));
    }
  }

  await pptx.writeFile({ fileName: `${String(data.title || 'presentation').replace(/[^a-zA-Z0-9]/g, '_')}.pptx` });
}

// ─── AI Call ───
async function callAI(systemPrompt: string, userMessage: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error (${response.status}): ${err}`);
  }
  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  if (!text) {
    console.error('Empty AI response:', JSON.stringify(data));
    throw new Error('AI returned an empty response. Please try again.');
  }
  return text;
}

// ─── Content Recommender AI Call ───
async function getRecommendations(content: string, apiKey: string): Promise<Recommendation[]> {
  const systemPrompt = `You are an expert curriculum designer and educational content analyst. 
A teacher has provided you with educational content (a chapter, article, textbook section, etc.).
Analyze this content and recommend a diverse set of educational resources that could be built from it.

For each recommendation, specify which builder type should be used. Valid builder types are:
- "lab" - for hands-on lab projects
- "worksheet" - for practice worksheets
- "studyguide" - for study guides  
- "terminology" - for terminology/vocabulary sheets
- "test" - for tests and quizzes
- "lessonplan" - for lesson plans
- "ppt" - for PowerPoint presentations
- "custom" - for creative/unique resources that don't fit other categories

For each recommendation provide a ready-to-use prompt that a teacher can send directly to the builder to create the resource.

Return ONLY valid JSON array:
[
  {
    "title": "short descriptive title",
    "type": "builder type from list above",
    "category": "Assignments|Tests|Lessons|Presentation",
    "description": "2-3 sentence description of what this resource would contain and how it helps learners",
    "builderPrompt": "the exact prompt/topic text a teacher would paste into the builder to create this resource - be specific and reference the actual content"
  }
]

Generate 8-12 diverse recommendations covering different builder types. Include a mix of standard items (worksheets, tests, study guides) and creative ones (debate topics, case studies via custom builder, engaging presentations). Make each recommendation specific to the actual content provided - not generic templates.`;

  const response = await callAI(systemPrompt, `Here is the educational content to analyze:\n\n${content}`, apiKey);

  // Parse JSON from response - handle markdown code blocks and extra text
  let cleaned = response.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('AI response (could not parse):', response);
    throw new Error('Failed to parse recommendations — the AI response did not contain valid JSON. Please try again.');
  }

  let recs: Array<{ title: string; type: string; category: string; description: string; builderPrompt: string; }>;
  try {
    recs = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error('JSON parse error:', parseErr, 'Raw match:', jsonMatch[0]);
    throw new Error('Failed to parse recommendations JSON. Please try again.');
  }

  return recs.map((r, i) => ({
    id: `rec-${Date.now()}-${i}`,
    title: r.title,
    type: r.type,
    category: r.category || getCategoryForType(r.type),
    description: r.description,
    builderPrompt: r.builderPrompt,
    builderType: r.type,
  }));
}

function getCategoryForType(type: string): string {
  const map: Record<string, string> = {
    lab: 'Assignments', worksheet: 'Assignments', studyguide: 'Assignments',
    terminology: 'Assignments', custom: 'Assignments', test: 'Tests',
    lessonplan: 'Lessons', ppt: 'Presentation',
  };
  return map[type] || 'Assignments';
}

// ─── Get another recommendation for a specific type ───
async function getAnotherRecommendation(
  content: string, type: string, existingTitles: string[], apiKey: string
): Promise<Recommendation> {
  const builderLabel = BUILDERS[type]?.label || type;
  const systemPrompt = `You are an expert curriculum designer. A teacher has content and wants ANOTHER ${builderLabel} recommendation that is DIFFERENT from these existing ones: ${existingTitles.join(', ')}.

Return ONLY valid JSON (single object, not array):
{
  "title": "short descriptive title",
  "type": "${type}",
  "category": "${getCategoryForType(type)}",
  "description": "2-3 sentence description",
  "builderPrompt": "the exact prompt text for the builder"
}`;

  const response = await callAI(systemPrompt, `Content:\n\n${content}`, apiKey);
  let cleaned = response.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('AI response (could not parse):', response);
    throw new Error('Failed to parse recommendation. Please try again.');
  }
  let r;
  try {
    r = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error('JSON parse error:', parseErr);
    throw new Error('Failed to parse recommendation JSON. Please try again.');
  }
  return {
    id: `rec-${Date.now()}-new`,
    title: r.title,
    type: r.type || type,
    category: r.category || getCategoryForType(type),
    description: r.description,
    builderPrompt: r.builderPrompt,
    builderType: r.type || type,
  };
}

// ─── Export recommendations to Word ───
async function exportRecommendationsToWord(recSet: RecommendationSet): Promise<void> {
  const children: Paragraph[] = [];

  children.push(new Paragraph({
    text: `Content Recommendations: ${recSet.sourceTitle}`,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 100 }
  }));
  children.push(new Paragraph({
    text: `Generated: ${new Date(recSet.createdAt).toLocaleString()}`,
    spacing: { after: 300 },
    children: [new TextRun({ text: `Generated: ${new Date(recSet.createdAt).toLocaleString()}`, color: '666666', size: 20 })]
  }));

  const categories = [...new Set(recSet.recommendations.map(r => r.category))];
  for (const cat of categories) {
    children.push(new Paragraph({
      text: cat.toUpperCase(),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 150 }
    }));

    const catRecs = recSet.recommendations.filter(r => r.category === cat);
    for (const rec of catRecs) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `[${rec.type.toUpperCase()}] `, bold: true, color: '2563EB' }),
          new TextRun({ text: rec.title, bold: true }),
        ],
        spacing: { before: 200, after: 50 }
      }));
      children.push(new Paragraph({
        text: rec.description,
        spacing: { after: 50 }
      }));
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Builder Prompt: ', bold: true, color: '666666', size: 20 }),
          new TextRun({ text: rec.builderPrompt, color: '666666', size: 20 }),
        ],
        spacing: { after: 150 }
      }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recommendations-${recSet.sourceTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import recommendations from Word ───
async function importRecommendationsFromWord(file: File): Promise<RecommendationSet | null> {
  const text = await extractFileText(file);
  if (!text) return null;

  // Parse the exported format
  const lines = text.split('\n').filter(l => l.trim());
  const recommendations: Recommendation[] = [];
  let sourceTitle = 'Imported Recommendations';
  let currentRec: Partial<Recommendation> | null = null;

  for (const line of lines) {
    if (line.startsWith('Content Recommendations:')) {
      sourceTitle = line.replace('Content Recommendations:', '').trim();
    }

    const typeMatch = line.match(/^\[([A-Z]+)\]\s+(.+)$/);
    if (typeMatch) {
      if (currentRec && currentRec.title) {
        recommendations.push(currentRec as Recommendation);
      }
      currentRec = {
        id: `rec-import-${Date.now()}-${recommendations.length}`,
        type: typeMatch[1].toLowerCase(),
        title: typeMatch[2],
        category: getCategoryForType(typeMatch[1].toLowerCase()),
        description: '',
        builderPrompt: '',
        builderType: typeMatch[1].toLowerCase(),
      };
    } else if (currentRec) {
      if (line.startsWith('Builder Prompt:')) {
        currentRec.builderPrompt = line.replace('Builder Prompt:', '').trim();
      } else if (!currentRec.description) {
        currentRec.description = line;
      }
    }
  }
  if (currentRec && currentRec.title) {
    recommendations.push(currentRec as Recommendation);
  }

  if (recommendations.length === 0) return null;

  return {
    id: `recset-import-${Date.now()}`,
    sourceTitle,
    createdAt: new Date().toISOString(),
    recommendations,
  };
}

// ─── Main App ───
type AppView = 'builder' | 'recommender';

export default function App() {
  return (
    <PinGate>
      <AppInner />
    </PinGate>
  );
}

function AppInner() {
  // ─── State ───
  const [view, setView] = useState<AppView>('builder');
  const [activeBuilder, setActiveBuilder] = useState<string>('lab');
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [optionValues, setOptionValues] = useState<Record<string, Record<string, string | number | boolean>>>({});
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('edubuilder-api-key') || '');
  const [unsplashKey, setUnsplashKey] = useState(() => localStorage.getItem('edubuilder-unsplash-key') || '');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; name: string; text: string }>>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    CATEGORIES.forEach(c => init[c] = true);
    return init;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Recommender state
  const [recContent, setRecContent] = useState('');
  const [recSourceTitle, setRecSourceTitle] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [recSet, setRecSet] = useState<RecommendationSet | null>(null);
  const [recLoadingMore, setRecLoadingMore] = useState<string | null>(null);
  const [recUploadedFiles, setRecUploadedFiles] = useState<Array<{ id: string; name: string; text: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recFileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const builder = BUILDERS[activeBuilder];

  // Get option values for current builder
  const getOptVal = (key: string) => {
    if (optionValues[activeBuilder]?.[key] !== undefined) return optionValues[activeBuilder][key];
    const opt = builder?.options.find(o => o.key === key);
    return opt?.defaultValue ?? '';
  };

  const setOptVal = (key: string, val: string | number | boolean) => {
    setOptionValues(prev => ({
      ...prev,
      [activeBuilder]: { ...prev[activeBuilder], [key]: val },
    }));
  };

  // File upload handler for builder
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const text = await extractFileText(file);
      const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploadedFiles(prev => [...prev, { id, name: file.name, text }]);
      setContext(prev => prev + (prev ? '\n\n' : '') + text);
    }
    e.target.value = '';
  };

  // File upload handler for recommender
  const handleRecFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const text = await extractFileText(file);
      const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setRecUploadedFiles(prev => [...prev, { id, name: file.name, text }]);
      setRecContent(prev => prev + (prev ? '\n\n' : '') + text);
      if (!recSourceTitle) setRecSourceTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    e.target.value = '';
  };

  // Import recommendations
  const handleImportRecs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imported = await importRecommendationsFromWord(file);
    if (imported) {
      setRecSet(imported);
    }
    e.target.value = '';
  };

  // Generate content
  const handleGenerate = async () => {
    if (!apiKey) { setShowSettings(true); return; }
    if (!topic.trim()) return;

    setGenerating(true);
    setResult(null);

    try {
      const opts: Record<string, string | number | boolean> = {};
      builder.options.forEach(o => {
        if (o.key) opts[o.key] = getOptVal(o.key);
      });

      const systemPrompt = builder.systemPrompt(opts);
      const userMessage = `Topic: ${topic}\n${context ? `\nAdditional context/content:\n${context}` : ''}`;
      const response = await callAI(systemPrompt, userMessage, apiKey);

      // Strip markdown code blocks before parsing
      const cleaned = response.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          setResult(parsed);
        } catch (parseErr) {
          console.error('JSON parse error:', parseErr, 'Raw match:', jsonMatch[0]);
          throw new Error('Failed to parse AI response. Please try again.');
        }
      } else {
        console.error('No JSON found in AI response:', response);
        throw new Error('AI response did not contain valid JSON. Please try again.');
      }
    } catch (err) {
      console.error('Generation error:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  // Download result
  const handleDownload = async () => {
    if (!result) return;

    if (activeBuilder === 'ppt') {
      const opts: Record<string, string | number | boolean> = {};
      builder.options.forEach(o => { if (o.key) opts[o.key] = getOptVal(o.key); });
      await generatePptx(result, opts, unsplashKey);
    } else {
      const title = String(result.title || topic || 'document');
      const doc = generateDocx(title, result);
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Generate recommendations
  const handleGetRecommendations = async () => {
    if (!apiKey) { setShowSettings(true); return; }
    if (!recContent.trim()) return;

    setRecLoading(true);
    try {
      const recs = await getRecommendations(recContent, apiKey);
      setRecSet({
        id: `recset-${Date.now()}`,
        sourceTitle: recSourceTitle || 'Content Analysis',
        createdAt: new Date().toISOString(),
        recommendations: recs,
      });
    } catch (err) {
      console.error('Recommendation error:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRecLoading(false);
    }
  };

  // Recommend another of a specific type
  const handleRecommendAnother = async (type: string) => {
    if (!apiKey || !recSet) return;
    setRecLoadingMore(type);
    try {
      const existingTitles = recSet.recommendations.filter(r => r.type === type).map(r => r.title);
      const newRec = await getAnotherRecommendation(recContent, type, existingTitles, apiKey);
      setRecSet(prev => prev ? {
        ...prev,
        recommendations: [...prev.recommendations, newRec],
      } : null);
    } catch (err) {
      console.error('Recommend another error:', err);
    } finally {
      setRecLoadingMore(null);
    }
  };

  // Use recommendation -> go to builder with pre-loaded prompt
  const handleUseRecommendation = (rec: Recommendation) => {
    const builderType = rec.builderType in BUILDERS ? rec.builderType : 'custom';
    setActiveBuilder(builderType);
    setTopic(rec.builderPrompt);
    setContext('');
    setResult(null);
    setView('builder');
  };

  // ─── Render ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.rtf,.pptx,.xlsx,.csv" multiple onChange={handleFileUpload} />
      <input ref={recFileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.rtf,.pptx,.xlsx,.csv" multiple onChange={handleRecFileUpload} />
      <input ref={importFileInputRef} type="file" className="hidden" accept=".docx" onChange={handleImportRecs} />

      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-900/50 border-r border-gray-700/50 flex flex-col transition-all duration-200`}>
        {/* Logo area */}
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">E</div>
            {!sidebarCollapsed && <span className="text-white font-semibold">EduBuilder</span>}
          </div>
        </div>

        {/* Navigation */}
        <div className="p-2 border-b border-gray-700/50">
          <button
            onClick={() => setView('builder')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              view === 'builder' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <FileText size={16} />
            {!sidebarCollapsed && <span>Page Builder</span>}
          </button>
          <button
            onClick={() => setView('recommender')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mt-1 ${
              view === 'recommender' ? 'bg-purple-600/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Lightbulb size={16} />
            {!sidebarCollapsed && <span>Content Recommender</span>}
          </button>
        </div>

        {/* Builder list (only shown in builder view) */}
        {view === 'builder' && !sidebarCollapsed && (
          <nav className="flex-1 overflow-y-auto p-2">
            {CATEGORIES.map(cat => {
              const catBuilders = Object.entries(BUILDERS).filter(([, b]) => b.category === cat);
              if (catBuilders.length === 0) return null;
              return (
                <div key={cat} className="mb-1">
                  <button
                    onClick={() => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300"
                  >
                    {expandedCategories[cat] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {CATEGORY_ICONS[cat]}
                    {cat}
                  </button>
                  {expandedCategories[cat] && catBuilders.map(([key, b]) => (
                    <button
                      key={key}
                      onClick={() => { setActiveBuilder(key); setResult(null); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeBuilder === key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      {BUILDER_ICONS[key]}
                      <span className="truncate">{b.label.replace(' Builder', '')}</span>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${b.badgeClass}`}>{b.badge}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        )}

        {/* Bottom actions */}
        <div className="p-2 border-t border-gray-700/50">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-sm"
          >
            <Settings size={16} />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex">
        {view === 'builder' ? (
          <BuilderView
            builder={builder}
            activeBuilder={activeBuilder}
            topic={topic}
            setTopic={setTopic}
            context={context}
            setContext={setContext}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            fileInputRef={fileInputRef}
            getOptVal={getOptVal}
            setOptVal={setOptVal}
            generating={generating}
            result={result}
            handleGenerate={handleGenerate}
            handleDownload={handleDownload}
            apiKey={apiKey}
            setShowSettings={setShowSettings}
          />
        ) : (
          <RecommenderView
            recContent={recContent}
            setRecContent={setRecContent}
            recSourceTitle={recSourceTitle}
            setRecSourceTitle={setRecSourceTitle}
            recLoading={recLoading}
            recSet={recSet}
            setRecSet={setRecSet}
            recLoadingMore={recLoadingMore}
            recUploadedFiles={recUploadedFiles}
            setRecUploadedFiles={setRecUploadedFiles}
            recFileInputRef={recFileInputRef}
            importFileInputRef={importFileInputRef}
            handleGetRecommendations={handleGetRecommendations}
            handleRecommendAnother={handleRecommendAnother}
            handleUseRecommendation={handleUseRecommendation}
            exportRecommendations={exportRecommendationsToWord}
            apiKey={apiKey}
            setShowSettings={setShowSettings}
          />
        )}
      </main>

      <SettingsModal show={showSettings} onClose={() => setShowSettings(false)} apiKey={apiKey} setApiKey={setApiKey} unsplashKey={unsplashKey} setUnsplashKey={setUnsplashKey} />

      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; cursor: pointer; }
      `}</style>
    </div>
  );
}

// ─── Builder View ───
function BuilderView({
  builder, activeBuilder, topic, setTopic, context, setContext,
  uploadedFiles, setUploadedFiles, fileInputRef,
  getOptVal, setOptVal,
  generating, result, handleGenerate, handleDownload,
  apiKey, setShowSettings,
}: {
  builder: BuilderConfig;
  activeBuilder: string;
  topic: string;
  setTopic: (t: string) => void;
  context: string;
  setContext: (c: string) => void;
  uploadedFiles: Array<{ id: string; name: string; text: string }>;
  setUploadedFiles: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; text: string }>>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  getOptVal: (key: string) => string | number | boolean;
  setOptVal: (key: string, val: string | number | boolean) => void;
  generating: boolean;
  result: Record<string, unknown> | null;
  handleGenerate: () => void;
  handleDownload: () => void;
  apiKey: string;
  setShowSettings: (s: boolean) => void;
}) {
  return (
    <>
      {/* Center panel - Topic & Generate */}
      <div className="flex-1 flex flex-col p-6 max-w-3xl mx-auto w-full">
        {/* Builder header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="text-blue-400">{BUILDER_ICONS[activeBuilder]}</div>
            <h1 className="text-white text-xl font-semibold">{builder.label}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded ${builder.badgeClass}`}>{builder.badge}</span>
          </div>
          <p className="text-gray-400 text-sm ml-7">{builder.sub}</p>
        </div>

        {/* Topic input */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs font-medium mb-1 block">Topic / Subject</label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
            placeholder="e.g. Photosynthesis in C4 plants"
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Context / file upload */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-gray-400 text-xs font-medium">Additional Context (optional)</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <Upload size={12} /> Upload file
            </button>
          </div>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Paste chapter text, additional instructions, or upload a file..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-32 resize-none text-sm transition-colors"
          />
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {uploadedFiles.map(f => (
                <span key={f.id} className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300">
                  <FileText size={12} /> {f.name}
                  <button onClick={() => setUploadedFiles(prev => prev.filter(x => x.id !== f.id))} className="text-gray-500 hover:text-red-400 ml-1">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={!apiKey ? () => setShowSettings(true) : handleGenerate}
          disabled={generating || !topic.trim()}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white rounded-xl py-3 font-medium transition-all flex items-center justify-center gap-2 mb-6"
        >
          {generating ? (
            <><Loader2 size={16} className="animate-spin" /> Generating...</>
          ) : !apiKey ? (
            <><Settings size={16} /> Set API Key to Generate</>
          ) : (
            <><Sparkles size={16} /> Generate {builder.badge}</>
          )}
        </button>

        {/* Result preview & download */}
        {result && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">{String(result.title || 'Generated Content')}</h3>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={14} /> Download {builder.badge}
              </button>
            </div>
            <div className="text-gray-300 text-sm max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans">{JSON.stringify(result, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Right panel - Options */}
      <aside className="w-72 bg-gray-900/30 border-l border-gray-700/50 p-4 overflow-y-auto">
        <h3 className="text-white font-medium mb-1">{builder.optionsTitle}</h3>
        <p className="text-gray-500 text-xs mb-4">{builder.optionsSub}</p>
        {builder.options.map((opt, i) => (
          <OptionRow
            key={opt.key || `opt-${i}`}
            opt={opt}
            value={opt.key ? getOptVal(opt.key) : ''}
            onChange={val => opt.key && setOptVal(opt.key, val)}
          />
        ))}
      </aside>
    </>
  );
}

// ─── Content Recommender View ───
function RecommenderView({
  recContent, setRecContent, recSourceTitle, setRecSourceTitle,
  recLoading, recSet, setRecSet, recLoadingMore, recUploadedFiles, setRecUploadedFiles,
  recFileInputRef, importFileInputRef,
  handleGetRecommendations, handleRecommendAnother, handleUseRecommendation,
  exportRecommendations, apiKey, setShowSettings,
}: {
  recContent: string;
  setRecContent: (c: string) => void;
  recSourceTitle: string;
  setRecSourceTitle: (t: string) => void;
  recLoading: boolean;
  recSet: RecommendationSet | null;
  setRecSet: React.Dispatch<React.SetStateAction<RecommendationSet | null>>;
  recLoadingMore: string | null;
  recUploadedFiles: Array<{ id: string; name: string; text: string }>;
  setRecUploadedFiles: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; text: string }>>>;
  recFileInputRef: React.RefObject<HTMLInputElement | null>;
  importFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleGetRecommendations: () => void;
  handleRecommendAnother: (type: string) => void;
  handleUseRecommendation: (rec: Recommendation) => void;
  exportRecommendations: (recSet: RecommendationSet) => Promise<void>;
  apiKey: string;
  setShowSettings: (s: boolean) => void;
}) {
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filteredRecs = recSet?.recommendations.filter(r => !filterCategory || r.category === filterCategory) || [];
  const categories = [...new Set(recSet?.recommendations.map(r => r.category) || [])];

  // Group by type for "recommend another" buttons
  const typeGroups = recSet ? [...new Set(recSet.recommendations.map(r => r.type))] : [];

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      {/* Header */}
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-1">
          <Lightbulb className="text-purple-400" size={24} />
          <h1 className="text-white text-xl font-semibold">Content Recommender</h1>
        </div>
        <p className="text-gray-400 text-sm mb-6 ml-9">
          Paste content from a chapter, PDF, or any source — AI will recommend educational resources you can build.
        </p>

        {/* Input section */}
        {!recSet && (
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 mb-6">
            <div className="mb-4">
              <label className="text-gray-400 text-xs font-medium mb-1 block">Source Title (optional)</label>
              <input
                type="text"
                value={recSourceTitle}
                onChange={e => setRecSourceTitle(e.target.value)}
                placeholder="e.g. Chapter 5 - Cell Division"
                className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-400 text-xs font-medium">Content to Analyze</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => recFileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                  >
                    <Upload size={12} /> Upload file
                  </button>
                  <button
                    onClick={() => importFileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                  >
                    <FileUp size={12} /> Import recommendations
                  </button>
                </div>
              </div>
              <textarea
                value={recContent}
                onChange={e => setRecContent(e.target.value)}
                placeholder="Paste your chapter text, article content, or any educational material here. The more content you provide, the better the recommendations will be..."
                className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 h-48 resize-none text-sm"
              />
              {recUploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {recUploadedFiles.map(f => (
                    <span key={f.id} className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300">
                      <FileText size={12} /> {f.name}
                      <button onClick={() => setRecUploadedFiles(prev => prev.filter(x => x.id !== f.id))} className="text-gray-500 hover:text-red-400 ml-1">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={!apiKey ? () => setShowSettings(true) : handleGetRecommendations}
              disabled={recLoading || !recContent.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white rounded-xl py-3 font-medium transition-all flex items-center justify-center gap-2"
            >
              {recLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Analyzing content...</>
              ) : !apiKey ? (
                <><Settings size={16} /> Set API Key to Analyze</>
              ) : (
                <><Sparkles size={16} /> Get Recommendations</>
              )}
            </button>
          </div>
        )}

        {/* Recommendations grid */}
        {recSet && (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setRecSet(null); setRecContent(''); setRecSourceTitle(''); setRecUploadedFiles([]); }}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm"
                >
                  <ArrowLeft size={14} /> New Analysis
                </button>
                <span className="text-gray-600">|</span>
                <span className="text-gray-300 text-sm font-medium">{recSet.sourceTitle}</span>
                <span className="text-gray-500 text-xs">({recSet.recommendations.length} recommendations)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportRecommendations(recSet)}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  <FileDown size={12} /> Export to Word
                </button>
                <button
                  onClick={() => importFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  <FileUp size={12} /> Import
                </button>
              </div>
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setFilterCategory(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !filterCategory ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterCategory === cat ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Tiles grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {filteredRecs.map(rec => (
                <div
                  key={rec.id}
                  onClick={() => handleUseRecommendation(rec)}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-all group"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="mt-0.5">{RECOMMENDATION_TYPE_ICONS[rec.type] || <Pencil size={20} className="text-gray-400" />}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white text-sm font-medium truncate group-hover:text-blue-300 transition-colors">{rec.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 uppercase">{rec.type}</span>
                        <span className="text-[10px] text-gray-500">{rec.category}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{rec.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    <Sparkles size={10} /> Click to build this resource
                  </div>
                </div>
              ))}
            </div>

            {/* Recommend another section */}
            <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
              <h3 className="text-gray-300 text-sm font-medium mb-3 flex items-center gap-2">
                <RefreshCw size={14} /> Want more recommendations?
              </h3>
              <div className="flex flex-wrap gap-2">
                {typeGroups.map(type => (
                  <button
                    key={type}
                    onClick={() => handleRecommendAnother(type)}
                    disabled={recLoadingMore === type}
                    className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >
                    {recLoadingMore === type ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Another {BUILDERS[type]?.label.replace(' Builder', '') || type}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
