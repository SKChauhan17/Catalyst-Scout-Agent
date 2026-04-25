'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import Papa from 'papaparse';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Info,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { useScoutStore } from '@/lib/store/useScoutStore';
import type { CustomCandidate } from '@/lib/agent/state';

type Feedback =
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string }
  | null;

interface ManualFormState {
  name: string;
  skills: string;
  experience: string;
  location: string;
  salary_expectation: string;
}

const REQUIRED_UPLOAD_COLUMNS = ['name', 'skills'] as const;
const FORMAT_EXAMPLE = `{
  "name": "Ava Chen",
  "skills": ["React", "TypeScript", "Node.js"],
  "experience": "6 years building SaaS products",
  "location": "Remote",
  "salary_expectation": "$160,000"
}`;

const EMPTY_FORM: ManualFormState = {
  name: '',
  skills: '',
  experience: '',
  location: '',
  salary_expectation: '',
};

const INLINE_FIELDS: Array<{
  key: 'name' | 'location' | 'salary_expectation';
  label: string;
  placeholder: string;
}> = [
  {
    key: 'name',
    label: 'Name',
    placeholder: 'Marcus Chen',
  },
  {
    key: 'location',
    label: 'Location',
    placeholder: 'San Francisco, USA',
  },
  {
    key: 'salary_expectation',
    label: 'Salary Expectation',
    placeholder: '$160,000',
  },
];

function createCandidateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((skill) => String(skill).trim())
      .filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseSkills(parsed);
    } catch {
      // Fall back to delimiter parsing below.
    }
  }

  return trimmed
    .split(/[\n,;|]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function getRecordValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function buildCustomCandidate(record: Record<string, unknown>, rowLabel: string): CustomCandidate {
  const name = readString(getRecordValue(record, ['name']));
  const skills = parseSkills(getRecordValue(record, ['skills']));

  if (!name) {
    throw new Error(`${rowLabel} is missing a name.`);
  }

  if (skills.length === 0) {
    throw new Error(`${rowLabel} is missing skills.`);
  }

  return {
    id: readString(getRecordValue(record, ['id'])) || createCandidateId(),
    name,
    skills,
    experience:
      readString(getRecordValue(record, ['experience'])) || 'Not specified',
    location:
      readString(getRecordValue(record, ['location'])) || 'Not specified',
    salary_expectation:
      readString(getRecordValue(record, ['salary_expectation', 'salaryExpectation']))
      || 'Not specified',
  };
}

async function parseCsvFile(file: File): Promise<CustomCandidate[]> {
  const text = await file.text();

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: (result) => {
        const fields = result.meta.fields ?? [];
        const missingColumns = REQUIRED_UPLOAD_COLUMNS.filter((column) => !fields.includes(column));

        if (missingColumns.length > 0) {
          reject(new Error(`CSV must include ${missingColumns.join(' and ')} column(s).`));
          return;
        }

        try {
          const candidates = result.data
            .filter((row) => Object.values(row).some((value) => readString(value)))
            .map((row, index) => buildCustomCandidate(row, `Row ${index + 2}`));

          if (candidates.length === 0) {
            reject(new Error('The CSV file did not contain any candidate rows.'));
            return;
          }

          resolve(candidates);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => reject(error),
    });
  });
}

async function parseJsonFile(file: File): Promise<CustomCandidate[]> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;

  const rawCandidates = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { candidates?: unknown }).candidates)
      ? (parsed as { candidates: unknown[] }).candidates
      : null;

  if (!rawCandidates) {
    throw new Error('JSON must be an array of candidate objects or an object with a candidates array.');
  }

  const candidates = rawCandidates.map((candidate, index) => {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new Error(`Row ${index + 1} is not a valid candidate object.`);
    }
    return buildCustomCandidate(candidate as Record<string, unknown>, `Row ${index + 1}`);
  });

  if (candidates.length === 0) {
    throw new Error('The JSON file did not contain any candidate rows.');
  }

  return candidates;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface BYODControllerProps {
  context: 'desktop' | 'mobile';
}

export default function BYODController({ context }: BYODControllerProps) {
  const { addCustomCandidate, addCustomCandidates, customCandidates, isScouting } = useScoutStore();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showFormat, setShowFormat] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [formState, setFormState] = useState<ManualFormState>(EMPTY_FORM);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const idPrefix = context === 'desktop' ? 'desktop' : 'mobile';

  const countLabel = useMemo(() => {
    if (customCandidates.length === 0) {
      return null;
    }

    return `${customCandidates.length} Custom Candidate${customCandidates.length === 1 ? '' : 's'} Loaded`;
  }, [customCandidates.length]);

  const updateFormField = <K extends keyof ManualFormState>(key: K, value: ManualFormState[K]) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsProcessingFile(true);
    setFeedback(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const candidates = extension === 'csv'
        ? await parseCsvFile(file)
        : await parseJsonFile(file);

      addCustomCandidates(candidates);
      setFeedback({
        kind: 'success',
        message: `Loaded ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}. ${customCandidates.length + candidates.length} total in session.`,
      });
    } catch (error) {
      setFeedback({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setIsProcessingFile(false);
      event.target.value = '';
    }
  };

  const handleManualSave = () => {
    setFeedback(null);

    try {
      const candidate = buildCustomCandidate(
        {
          ...formState,
          skills: formState.skills,
        },
        'Manual entry'
      );

      addCustomCandidate(candidate);
      setShowManualEntry(false);
      setFormState(EMPTY_FORM);
      setFeedback({
        kind: 'success',
        message: `${candidate.name} added to the custom candidate pool.`,
      });
    } catch (error) {
      setFeedback({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  return (
    <>
      <div
        id={`${idPrefix}-byod-panel`}
        className="mt-4 rounded-lg border p-4"
        style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.12em]"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}
            >
              Bring Your Own Data
            </p>
            <p className="mt-1 text-[12px] leading-5" style={{ color: '#8b949e' }}>
              Upload your own candidates and let the agent rank them without hitting Supabase retrieval.
            </p>
          </div>

          {countLabel && (
            <span
              className="shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.08em]"
              style={{
                fontFamily: 'var(--font-geist-mono)',
                backgroundColor: 'rgba(0,217,146,0.1)',
                border: '1px solid rgba(0,217,146,0.2)',
                color: '#00d992',
              }}
            >
              {customCandidates.length}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            id={`${idPrefix}-byod-format`}
            type="button"
            onClick={() => setShowFormat((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors hover:bg-white/5"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              color: '#8b949e',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Info className="h-3.5 w-3.5" />
            View Data Format
          </button>

          <button
            id={`${idPrefix}-byod-manual`}
            type="button"
            onClick={() => setShowManualEntry(true)}
            disabled={isScouting}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors hover:bg-white/5 disabled:opacity-40"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              color: '#f7f8f8',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Candidate Manually
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showFormat && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mt-3 rounded-lg border p-3"
              style={{
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <p
                className="text-[11px] uppercase tracking-[0.12em]"
                style={{ fontFamily: 'var(--font-geist-mono)', color: '#f7f8f8' }}
              >
                Required Schema
              </p>
              <p className="mt-2 text-[12px] leading-5" style={{ color: '#8b949e' }}>
                CSV headers should be `name`, `skills`, `experience`, `location`, `salary_expectation`.
                JSON should match the same keys.
              </p>
              <pre
                className="mt-3 overflow-x-auto rounded-md p-3 text-[11px] leading-5"
                style={{
                  fontFamily: 'var(--font-geist-mono)',
                  backgroundColor: '#101010',
                  color: '#8b949e',
                  boxShadow: 'rgba(0,0,0,0.2) 0px 0px 12px 0px inset',
                }}
              >
                {FORMAT_EXAMPLE}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>

        {feedback && (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12px] leading-5"
            style={{
              backgroundColor:
                feedback.kind === 'error'
                  ? 'rgba(248,113,113,0.08)'
                  : 'rgba(0,217,146,0.08)',
              borderColor:
                feedback.kind === 'error'
                  ? 'rgba(248,113,113,0.2)'
                  : 'rgba(0,217,146,0.2)',
              color: feedback.kind === 'error' ? '#fca5a5' : '#9be8c8',
            }}
          >
            {feedback.kind === 'error' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <button
          id={`${idPrefix}-byod-upload`}
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isScouting || isProcessingFile}
          className="mt-3 flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition-colors hover:bg-white/[0.03] disabled:opacity-40"
          style={{
            borderColor: 'rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(255,255,255,0.01)',
          }}
        >
          <div
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: 'rgba(0,217,146,0.1)',
              border: '1px solid rgba(0,217,146,0.2)',
            }}
          >
            {isProcessingFile ? (
              <Upload className="h-4 w-4 animate-pulse" style={{ color: '#00d992' }} />
            ) : (
              <FileUp className="h-4 w-4" style={{ color: '#00d992' }} />
            )}
          </div>
          <span
            className="text-[12px]"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#f7f8f8' }}
          >
            {isProcessingFile ? 'Parsing candidate file...' : 'Upload CSV / JSON'}
          </span>
          <span className="mt-1 text-[12px] leading-5" style={{ color: '#8b949e' }}>
            `name` and `skills` are required. Everything else can be inferred or defaulted.
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,application/json"
          className="hidden"
          onChange={handleFileUpload}
        />

        {countLabel && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.08em]"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              backgroundColor: 'rgba(0,217,146,0.08)',
              border: '1px solid rgba(0,217,146,0.18)',
              color: '#00d992',
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {countLabel}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showManualEntry && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowManualEntry(false)}
            />

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l"
              style={{
                backgroundColor: '#0f1011',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="flex items-start justify-between gap-4 border-b px-5 py-4"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div>
                  <p
                    className="text-[11px] uppercase tracking-[0.12em]"
                    style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d992' }}
                  >
                    Manual Candidate
                  </p>
                  <h2
                    className="mt-1 text-[18px] font-[600]"
                    style={{ color: '#f7f8f8' }}
                  >
                    Add Candidate Manually
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualEntry(false)}
                  className="rounded-md p-1.5 transition-colors hover:bg-white/5"
                  aria-label="Close manual candidate form"
                >
                  <X className="h-4 w-4" style={{ color: '#8b949e' }} />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {INLINE_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label
                      className="mb-2 block text-[11px] uppercase tracking-[0.12em]"
                      style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
                    >
                      {field.label}
                    </label>
                    <input
                      value={formState[field.key]}
                      onChange={(event) => updateFormField(field.key, event.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none transition-colors"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        color: '#f7f8f8',
                      }}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}

                <div>
                  <label
                    className="mb-2 block text-[11px] uppercase tracking-[0.12em]"
                    style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
                  >
                    Skills
                  </label>
                  <textarea
                    value={formState.skills}
                    onChange={(event) => updateFormField('skills', event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-lg border px-3 py-2.5 text-[13px] leading-6 outline-none transition-colors"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      color: '#f7f8f8',
                    }}
                    placeholder="React, TypeScript, Node.js"
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-[11px] uppercase tracking-[0.12em]"
                    style={{ fontFamily: 'var(--font-geist-mono)', color: '#8b949e' }}
                  >
                    Experience
                  </label>
                  <textarea
                    value={formState.experience}
                    onChange={(event) => updateFormField('experience', event.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-lg border px-3 py-2.5 text-[13px] leading-6 outline-none transition-colors"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      color: '#f7f8f8',
                    }}
                    placeholder="Senior frontend engineer with 6 years shipping SaaS workflows and design systems."
                  />
                </div>
              </div>

              <div
                className="flex items-center justify-end gap-2 border-t px-5 py-4"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <button
                  type="button"
                  onClick={() => setShowManualEntry(false)}
                  className="rounded-md px-3 py-2 text-[12px] transition-colors hover:bg-white/5"
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    color: '#8b949e',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleManualSave}
                  className="rounded-full px-4 py-2 text-[12px] transition-all hover:brightness-110"
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    backgroundColor: '#0f0f0f',
                    border: '1px solid #fafafa',
                    color: '#2fd6a1',
                  }}
                >
                  Save Candidate
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
