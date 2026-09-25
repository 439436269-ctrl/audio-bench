import { useCallback, useRef, useState } from "react";
import {
  CHUNK_SEC,
  Chunk,
  ProcessResult,
  SliceProgress,
  formatBytes,
  formatDuration,
  isAudioFile,
  processAudio,
  saveChunks,
} from "./audio";

type Phase = "queued" | "decoding" | "slicing" | "done" | "error";

interface Item {
  id: string;
  file: File;
  name: string;
  size: number;
  phase: Phase;
  progress: string;
  result?: ProcessResult;
  error?: string;
  savedTo?: string;
}

let seq = 0;
const uid = () => `f${Date.now().toString(36)}-${(seq++).toString(36)}`;

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const patch = useCallback((id: string, data: Partial<Item>) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...data } : x)));
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      const audio = files.filter((f) => isAudioFile(f.name, f.type));
      if (audio.length === 0) return;

      const fresh: Item[] = audio.map((file) => ({
        id: uid(),
        file,
        name: file.name,
        size: file.size,
        phase: "queued",
        progress: "排队中…",
      }));
      setItems((prev) => [...prev, ...fresh]);

      for (const item of fresh) {
        patch(item.id, { phase: "decoding", progress: "解码音频…" });
        try {
          const result = await processAudio(item.file, CHUNK_SEC, (p: SliceProgress) => {
            patch(item.id, {
              phase: p.phase === "decoding" ? "decoding" : "slicing",
              progress:
                p.phase === "decoding"
                  ? "解码音频…"
                  : `切块 ${p.done}/${p.total}`,
            });
          });
          patch(item.id, {
            phase: "done",
            progress: "",
            result,
          });
        } catch (e) {
          patch(item.id, { phase: "error", progress: "", error: (e as Error).message });
        }
      }
    },
    [patch],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files: File[] = [];
      if (e.dataTransfer?.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) files.push(e.dataTransfer.files[i]);
      }
      void addFiles(files);
    },
    [addFiles],
  );

  const doneItems = items.filter(
    (i) => i.phase === "done" && i.result,
  ) as (Item & { result: ProcessResult })[];
  const totalChunks = doneItems.reduce((s, i) => s + i.result.chunks.length, 0);
  const totalWav = doneItems.reduce(
    (s, i) => s + i.result.chunks.reduce((a, c) => a + c.bytes, 0),
    0,
  );
  const allDone = items.length > 0 && items.every((i) => i.phase === "done" || i.phase === "error");
  const hasDone = doneItems.length > 0;

  const onSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const where = await saveChunks(
        doneItems.map((i) => ({ name: i.name, result: i.result })),
      );
      const msg = where
        ? `已保存 ${totalChunks} 个切块 → ${where}`
        : "已取消";
      setSaveMsg(msg);
      setItems((prev) =>
        prev.map((x) => (x.phase === "done" ? { ...x, savedTo: where ?? undefined } : x)),
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setSaveMsg(`保存失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [doneItems, totalChunks]);

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header>
        <h1>音频切块</h1>
        <p className="tagline">拖进来，自动切成 ASR 友好的 {CHUNK_SEC} 秒小块（16kHz 单声道 WAV）。</p>
      </header>

      <div
        className={`drop ${dragging ? "over" : ""}`}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {dragging ? "松手即可" : "把音频文件拖到这里，或点击选择"}
        <span className="hint">支持 mp3 / m4a / wav / flac 等 · 全程本地处理，不上传</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.wav,.flac,.aac,.amr,.3gp,.wma"
        style={{ display: "none" }}
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) void addFiles(Array.from(list));
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <ul className="list">
          {items.map((it) => (
            <li key={it.id} className={`item ph-${it.phase}`}>
              <div className="head">
                <span className="name" title={it.name}>
                  {it.name}
                </span>
                <span className="meta">
                  {formatBytes(it.size)}
                  {it.result ? ` · ${formatDuration(it.result.durationSec)} · ${it.result.chunks.length} 块` : ""}
                </span>
                <button
                  type="button"
                  className="x"
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                  title="移除"
                >
                  ✕
                </button>
              </div>

              {it.phase !== "done" && it.phase !== "error" && (
                <div className="bar">
                  <i />
                  <span>{it.progress}</span>
                </div>
              )}
              {it.phase === "error" && <div className="err">失败：{it.error}</div>}

              {it.result && (
                <ol className="chunks">
                  {it.result.chunks.map((c: Chunk) => (
                    <li key={c.index}>
                      <span className="no">#{c.index + 1}</span>
                      <span className="range">
                        {formatDuration(c.startSec)} – {formatDuration(c.endSec)}
                      </span>
                      <span className="size">{formatBytes(c.bytes)}</span>
                      <audio controls preload="none" src={c.url} />
                    </li>
                  ))}
                </ol>
              )}
              {it.savedTo && <div className="saved">已保存：{it.savedTo}</div>}
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 && (
        <p className="empty">
          处理完可以选择一个文件夹，切块（WAV）和 manifest.json 会一起写进去；也可以逐个下载。
        </p>
      )}

      <footer className={`savebar ${hasDone && allDone ? "show" : ""}`}>
        {hasDone && allDone && (
          <>
            <span className="sum">
              {doneItems.length} 个文件 · {totalChunks} 块 · 约 {formatBytes(totalWav)}
            </span>
            <button type="button" onClick={onSave} disabled={saving}>
              {saving ? "保存中…" : "保存切块到文件夹"}
            </button>
            {saveMsg && <span className="savemsg">{saveMsg}</span>}
          </>
        )}
      </footer>
    </div>
  );
}
