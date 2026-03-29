import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useTheme } from "../themes.js";
import type { Process, ProcessCreateBody } from "../api.js";

interface ProcessFormProps {
  process: Process | null;
  width: number;
  height: number;
  onSave: (body: ProcessCreateBody) => Promise<void>;
  onCancel: () => void;
}

interface FormState {
  name: string;
  command: string;
  cwd: string;
  envText: string;
  notes: string;
  healthUrl: string;
  autoRestart: boolean;
  autoStart: boolean;
}

interface Field {
  key: keyof FormState;
  label: string;
  type: "text" | "boolean";
  placeholder?: string;
  hint?: string;
}

const FIELDS: Field[] = [
  { key: "name", label: "Name", type: "text", placeholder: "my-server" },
  { key: "command", label: "Command", type: "text", placeholder: "bun run dev" },
  { key: "cwd", label: "Working Dir", type: "text", placeholder: "." },
  {
    key: "envText",
    label: "Env Vars",
    type: "text",
    placeholder: "PORT=3000,NODE_ENV=dev",
    hint: "KEY=value pairs, comma-separated",
  },
  { key: "notes", label: "Notes", type: "text", placeholder: "What does this do?" },
  {
    key: "healthUrl",
    label: "Health URL",
    type: "text",
    placeholder: "http://localhost:3000/health",
    hint: "Polled every 30s when running",
  },
  { key: "autoRestart", label: "Auto-restart on crash", type: "boolean" },
  { key: "autoStart", label: "Auto-start on launch", type: "boolean" },
];

const SAVE_IDX = FIELDS.length;
const CANCEL_IDX = FIELDS.length + 1;
const TOTAL = FIELDS.length + 2;

function parseEnv(envText: string): string {
  const obj: Record<string, string> = {};
  envText.split(",").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > 0) obj[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return JSON.stringify(obj);
}

function envToText(envJson: string): string {
  try {
    const obj = JSON.parse(envJson) as Record<string, string>;
    return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(",");
  } catch {
    return "";
  }
}

export function ProcessForm({ process, width, height, onSave, onCancel }: ProcessFormProps) {
  const theme = useTheme();

  const [fieldIdx, setFieldIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<FormState>({
    name: process?.name ?? "",
    command: process?.command ?? "",
    cwd: process?.cwd ?? ".",
    envText: process?.env && process.env !== "{}" ? envToText(process.env) : "",
    notes: process?.notes ?? "",
    healthUrl: process?.healthUrl ?? "",
    autoRestart: process?.autoRestart ?? false,
    autoStart: process?.autoStart ?? false,
  });

  const handleSave = useCallback(async () => {
    if (!state.name.trim() || !state.command.trim()) {
      setError("Name and command are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: ProcessCreateBody = {
        name: state.name.trim(),
        command: state.command.trim(),
        cwd: state.cwd.trim() || ".",
        env: parseEnv(state.envText),
        notes: state.notes.trim() || undefined,
        healthUrl: state.healthUrl.trim() || undefined,
        autoRestart: state.autoRestart,
        autoStart: state.autoStart,
      };
      await onSave(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }, [state, onSave]);

  useInput(
    (input, key) => {
      if (key.escape) { onCancel(); return; }

      if (key.downArrow || (key.tab && !key.shift)) {
        setFieldIdx((i) => (i + 1) % TOTAL);
        return;
      }
      if (key.upArrow || (key.tab && key.shift)) {
        setFieldIdx((i) => (i - 1 + TOTAL) % TOTAL);
        return;
      }

      if (input === " ") {
        const field = FIELDS[fieldIdx];
        if (field?.type === "boolean") {
          setState((s) => ({ ...s, [field.key]: !s[field.key as keyof FormState] }));
          return;
        }
      }

      if (key.return) {
        if (fieldIdx === SAVE_IDX) { handleSave(); return; }
        if (fieldIdx === CANCEL_IDX) { onCancel(); return; }
        if (fieldIdx === FIELDS.length - 1) { setFieldIdx(SAVE_IDX); return; }
        setFieldIdx((i) => Math.min(i + 1, TOTAL - 1));
      }
    },
    { isActive: true }
  );

  const boxW = Math.min(68, width - 4);
  const topPad = Math.max(0, Math.floor((height - TOTAL - 10) / 2));
  const labelW = 16;
  const inputW = boxW - labelW - 8;
  const currentHint = FIELDS[fieldIdx]?.hint;

  const row = " ".repeat(width);

  return (
    // Outer: absolute, covers the panels area with a solid backdrop
    <Box position="absolute" flexDirection="column" width={width} height={height}>
      {/* Solid backdrop */}
      {Array.from({ length: height }, (_, i) => (
        <Text key={i} >{row}</Text>
      ))}
      {/* Modal box on top */}
      <Box
        position="absolute"
        flexDirection="column"
        alignItems="center"
        width={width}
        height={height}
        paddingTop={topPad}
      >
      <Box
        borderStyle="round"
        borderColor={theme.accent}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        width={boxW}
      >
        <Box justifyContent="center" marginBottom={1}>
          <Text color={theme.accent} bold>
            {process ? " Edit Process " : " New Process "}
          </Text>
        </Box>

        {FIELDS.map((field, idx) => {
          const isActive = fieldIdx === idx && !saving;
          const cursor = isActive ? "▶ " : "  ";
          const cursorColor = isActive ? theme.accent : theme.mutedFg;

          if (field.type === "boolean") {
            const val = state[field.key] as boolean;
            return (
              <Box key={field.key}>
                <Text color={cursorColor}>{cursor}</Text>
                <Text color={isActive ? theme.normalFg : theme.dimFg}>
                  {"[" + (val ? "✓" : " ") + "] " + field.label}
                </Text>
              </Box>
            );
          }

          const val = state[field.key] as string;
          return (
            <Box key={field.key}>
              <Text color={cursorColor}>{cursor}</Text>
              <Box width={labelW}>
                <Text color={isActive ? theme.accent : theme.mutedFg}>
                  {(field.label + ":").slice(0, labelW).padEnd(labelW)}
                </Text>
              </Box>
              <Box width={inputW}>
                {isActive ? (
                  <TextInput
                    value={val}
                    onChange={(v) => setState((s) => ({ ...s, [field.key]: v }))}
                    placeholder={field.placeholder}
                    focus={isActive}
                  />
                ) : (
                  <Text color={val ? theme.normalFg : theme.mutedFg} wrap="truncate">
                    {(val || field.placeholder || "").slice(0, inputW)}
                  </Text>
                )}
              </Box>
            </Box>
          );
        })}

        {/* Hint */}
        {currentHint && fieldIdx < FIELDS.length && (
          <Box marginLeft={4}>
            <Text color={theme.mutedFg} italic>
              {currentHint}
            </Text>
          </Box>
        )}

        {/* Buttons */}
        <Box marginTop={1} gap={2} justifyContent="flex-end">
          <Text color={fieldIdx === SAVE_IDX ? theme.accent : theme.dimFg} bold={fieldIdx === SAVE_IDX}>
            {fieldIdx === SAVE_IDX ? "▶ " : "  "}
            {saving ? "[Saving…]" : "[  Save  ]"}
          </Text>
          <Text color={fieldIdx === CANCEL_IDX ? theme.normalFg : theme.mutedFg}>
            {fieldIdx === CANCEL_IDX ? "▶ " : "  "}
            {"[ Cancel ]"}
          </Text>
        </Box>

        {error && (
          <Box marginTop={1}>
            <Text color={theme.error}>{"  ⚠ " + error}</Text>
          </Box>
        )}
      </Box>
      </Box>
    </Box>
  );
}
