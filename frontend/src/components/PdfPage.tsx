import { MouseEvent, MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import type { PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import type { PdfDocument } from "../pdfjs";
import type { Comment, DragBox, Redaction } from "../types";

type PdfPageProps = {
  pdf: PdfDocument;
  pageNumber: number;
  scale: number;
  redactions: Redaction[];
  addRedaction: (redaction: Omit<Redaction, "id">) => void;
  removeRedaction: (id: string) => void;
  readOnly?: boolean;
  // Comment mode lets reviewers select visible text lines for comments or suggestions.
  commentMode?: boolean;
  comments?: Comment[];
  activeCommentId?: number | null;
  onCommentClick?: (commentId: number) => void;
  selectedTextLineIds?: string[];
  onTextLinesSelect?: (selection: { id: string; page: number; text: string; anchor: { page: number; x: number; y: number; width: number; height: number } }[]) => void;
};

type TextSpan = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  line: { text: string; x: number; y: number; width: number; height: number };
};

export function PdfPage({
  pdf,
  pageNumber,
  scale,
  redactions,
  addRedaction,
  removeRedaction,
  readOnly = false,
  commentMode = false,
  comments = [],
  activeCommentId = null,
  onCommentClick,
  selectedTextLineIds = [],
  onTextLinesSelect,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [textSpans, setTextSpans] = useState<TextSpan[]>([]);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draftBox, setDraftBox] = useState<DragBox | null>(null);
  const allowEdit = !readOnly && !commentMode;

  useEffect(() => {
    let cancelled = false;
    async function loadPage() {
      const loadedPage = await pdf.getPage(pageNumber);
      if (!cancelled) setPage(loadedPage);
    }
    loadPage();
    return () => { cancelled = true; };
  }, [pdf, pageNumber]);

  useEffect(() => {
    if (!page || !canvasRef.current) return;
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    setPageSize({ width: viewport.width, height: viewport.height });
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
    const renderTask = page.render({ canvasContext: context, transform, viewport });
    renderTask.promise.catch(() => undefined);
    return () => { renderTask.cancel(); };
  }, [page, scale]);

  useEffect(() => {
    if (!page) return;
    const currentPage = page;
    let cancelled = false;
    async function loadText() {
      const viewport = currentPage.getViewport({ scale });
      const content = await currentPage.getTextContent();
      const measureContext = getMeasureContext(measureCanvasRef);
      const spans = content.items
        .filter((item): item is TextItem => "str" in item && Boolean(item.str.trim()))
        .flatMap((item, index) => {
          const tx = viewport.transform;
          const m = multiplyTransforms(tx, item.transform);

          // m[4], m[5] = screen-space origin of the text baseline (bottom-left in PDF coords).
          // In screen coords (y-down), m[5] IS the baseline Y.
          // Font size = scale factor from the combined matrix
          const fontSize = Math.hypot(m[2], m[3]);
          // PDF item.width is in PDF points; multiply by scale for screen pixels
          const itemScreenWidth = item.width * scale;

          // Ascent above baseline and descent below baseline
          const ascent = fontSize * 0.85;   // typical ascent ratio
          const descent = fontSize * 0.25;  // typical descent ratio (covers g, y, p, q)
          const totalHeight = ascent + descent;

          // Top of the bounding box in screen coords = baseline - ascent
          const boxTop = m[5] - ascent;

          const text = item.str;
          const style = content.styles[item.fontName];
          const fontFamily = style?.fontFamily || "sans-serif";
          const measuredFullWidth = measureText(measureContext, text, fontSize, fontFamily);
          const charWidthFallback = itemScreenWidth / (text.length || 1);

          const words = Array.from(text.matchAll(/\S+/g));
          if (!words.length) return [];

          const wordBoxes = words.map((match, wordIndex) => {
            const word = match[0];
            const startIdx = match.index ?? 0;
            const prefix = text.slice(0, startIdx);
            const prefixW = measureText(measureContext, prefix, fontSize, fontFamily);
            const wordW = measureText(measureContext, word, fontSize, fontFamily);
            // Scale measured widths proportionally to the actual PDF item width
            const xOff = measuredFullWidth > 0
              ? (prefixW / measuredFullWidth) * itemScreenWidth
              : startIdx * charWidthFallback;
            const wScaled = measuredFullWidth > 0
              ? (wordW / measuredFullWidth) * itemScreenWidth
              : word.length * charWidthFallback;

            return {
              id: `${pageNumber}-${index}-${wordIndex}`,
              text: word,
              x: m[4] + xOff,
              y: boxTop,
              width: Math.max(wScaled, 4),
              height: totalHeight,
            };
          });

          // Line object spans the full PDF item width (includes spaces, pipes, commas)
          const lineObj = {
            text: text.trim(),
            x: m[4],
            y: boxTop,
            width: itemScreenWidth,
            height: totalHeight,
          };

          return wordBoxes.map(wb => ({ ...wb, line: lineObj }));
        });
      if (!cancelled) setTextSpans(spans);
    }
    loadText();
    return () => { cancelled = true; };
  }, [page, pageNumber, scale]);

  function relativePoint(event: MouseEvent<HTMLDivElement>) {
    const bounds = pageRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height),
    };
  }

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, .text-hotspot, .redaction-box, .comment-anchor")) return;
    const point = relativePoint(event);
    setDragStart(point);
    setDraftBox({ page: pageNumber, x: point.x, y: point.y, width: 0, height: 0 });
  }

  function handleSelectionMouseDown(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".comment-anchor")) return;
    event.preventDefault();
    const point = relativePoint(event);
    setDragStart(point);
    setDraftBox({ page: pageNumber, x: point.x, y: point.y, width: 0, height: 0 });
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!dragStart) return;
    const point = relativePoint(event);
    setDraftBox({
      page: pageNumber,
      x: Math.min(dragStart.x, point.x), y: Math.min(dragStart.y, point.y),
      width: Math.abs(point.x - dragStart.x), height: Math.abs(point.y - dragStart.y),
    });
  }

  function handleMouseUp() {
    if (draftBox && draftBox.width > 8 && draftBox.height > 8) {
      if (allowEdit) {
        addRedaction({
          page: draftBox.page,
          x: draftBox.x / scale,
          y: draftBox.y / scale,
          width: draftBox.width / scale,
          height: draftBox.height / scale,
        });
      }
    }
    setDragStart(null);
    setDraftBox(null);
  }

  function handleSelectionMouseUp() {
    if (!dragStart || !draftBox || !onTextLinesSelect || pageSize.width <= 0 || pageSize.height <= 0) {
      setDragStart(null);
      setDraftBox(null);
      return;
    }

    const selected = getLinesInBox(draftBox);
    onTextLinesSelect(selected.map(lineToSelection));
    setDragStart(null);
    setDraftBox(null);
  }

  function redactText(span: TextSpan, redactLine: boolean) {
    const target = redactLine ? span.line : span;
    addRedaction({
      page: pageNumber,
      x: target.x / scale, y: target.y / scale,
      width: target.width / scale, height: target.height / scale,
      label: redactLine ? target.text : span.text,
    });
  }

  const selectableLines = useMemo(() => {
    const byLine = new Map<string, { id: string; text: string; x: number; y: number; width: number; height: number }>();
    for (const span of textSpans) {
      const key = `${Math.round(span.line.y)}-${Math.round(span.line.x)}-${span.line.text}`;
      if (!byLine.has(key)) {
        byLine.set(key, {
          id: `${pageNumber}-${key}`,
          text: span.line.text,
          x: span.line.x,
          y: span.line.y,
          width: span.line.width,
          height: span.line.height,
        });
      }
    }
    return Array.from(byLine.values()).sort((a, b) => a.y - b.y || a.x - b.x);
  }, [pageNumber, textSpans]);

  function lineToSelection(line: { id: string; text: string; x: number; y: number; width: number; height: number }) {
    return {
      id: line.id,
      page: pageNumber,
      text: line.text,
      anchor: {
        page: pageNumber,
        x: line.x / pageSize.width,
        y: line.y / pageSize.height,
        width: line.width / pageSize.width,
        height: line.height / pageSize.height,
      },
    };
  }

  function getLinesInBox(box: DragBox) {
    const isClick = box.width < 6 && box.height < 6;
    if (isClick) {
      return selectableLines.filter(line =>
        box.x >= line.x &&
        box.x <= line.x + line.width &&
        box.y >= line.y &&
        box.y <= line.y + line.height
      ).slice(0, 1);
    }
    return selectableLines.filter(line => rectanglesOverlap(
      { x: box.x, y: box.y, width: box.width, height: box.height },
      line
    ));
  }

  // Comments for this page
  const pageComments = comments.filter((c) => c.page === pageNumber);

  const cursor = "default";

  return (
    <article className="pdf-page-wrap">
      <div className="page-label">Page {pageNumber}</div>
      <div
        className="pdf-page"
        onMouseDown={allowEdit ? handleMouseDown : commentMode ? handleSelectionMouseDown : undefined}
        onMouseLeave={allowEdit ? handleMouseUp : commentMode ? handleSelectionMouseUp : undefined}
        onMouseMove={allowEdit || commentMode ? handleMouseMove : undefined}
        onMouseUp={allowEdit ? handleMouseUp : commentMode ? handleSelectionMouseUp : undefined}
        ref={pageRef}
        style={{ width: pageSize.width, height: pageSize.height, cursor }}
      >
        <canvas ref={canvasRef} />

        {/* Text hotspots for redaction mode */}
        {allowEdit ? (
          <div className="text-layer" aria-label={`Selectable text for page ${pageNumber}`}>
            {textSpans.map((span) => (
              <button
                aria-label={`Redact ${span.text}`}
                className="text-hotspot"
                key={span.id}
                onClick={(event) => redactText(span, event.ctrlKey || event.metaKey)}
                style={{ left: span.x, top: span.y, width: span.width, height: span.height }}
              />
            ))}
          </div>
        ) : null}

        {commentMode && onTextLinesSelect ? (
          <div className="text-layer" aria-label={`Selectable resume lines for page ${pageNumber}`}>
            {selectableLines.map((line) => {
              const selected = selectedTextLineIds.includes(line.id);
              return (
                <div
                  aria-label={`${selected ? "Deselect" : "Select"} line ${line.text}`}
                  className={`text-line-hotspot ${selected ? "selected" : ""}`}
                  key={line.id}
                  style={{ left: line.x, top: line.y, width: line.width, height: line.height }}
                />
              );
            })}
          </div>
        ) : null}

        {/* Redaction boxes */}
        <div className="redaction-layer">
          {redactions.map((redaction) =>
            allowEdit ? (
              <button
                aria-label={`Remove redaction${redaction.label ? ` for ${redaction.label}` : ""}`}
                className="redaction-box"
                key={redaction.id}
                onClick={() => removeRedaction(redaction.id)}
                style={{
                  left: redaction.x * scale, top: redaction.y * scale,
                  width: redaction.width * scale, height: redaction.height * scale,
                }}
              />
            ) : (
              <div
                className="redaction-box"
                key={redaction.id}
                style={{
                  left: redaction.x * scale, top: redaction.y * scale,
                  width: redaction.width * scale, height: redaction.height * scale,
                }}
              />
            )
          )}

          {/* Draft drag box */}
          {allowEdit && draftBox && (draftBox.width > 2 || draftBox.height > 2) ? (
            <div
              className="redaction-box draft"
              style={{ left: draftBox.x, top: draftBox.y, width: draftBox.width, height: draftBox.height }}
            />
          ) : null}
          {commentMode && draftBox && (draftBox.width > 2 || draftBox.height > 2) ? (
            <div
              className="line-selection-draft"
              style={{ left: draftBox.x, top: draftBox.y, width: draftBox.width, height: draftBox.height }}
            />
          ) : null}
        </div>

        {/* Comment anchors */}
        {pageComments.map((comment, index) => {
          const isActive = activeCommentId === comment.id;
          return (
            <button
              key={comment.id}
              className={`comment-anchor ${comment.status} ${isActive ? "active" : ""}`}
              onClick={() => onCommentClick?.(comment.id)}
              style={{
                left: comment.x * pageSize.width,
                top: comment.y * pageSize.height,
                width: comment.width * pageSize.width,
                height: comment.height * pageSize.height,
              }}
              aria-label={`Comment by ${comment.author_display_name}: ${comment.body}`}
            >
              <div className="comment-anchor-badge">{index + 1}</div>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function multiplyTransforms(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rectanglesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function getMeasureContext(ref: MutableRefObject<HTMLCanvasElement | null>) {
  if (!ref.current) ref.current = document.createElement("canvas");
  return ref.current.getContext("2d");
}

function measureText(context: CanvasRenderingContext2D | null, text: string, fontSize: number, fontFamily: string) {
  if (!context || !text) return 0;
  context.font = `${Math.max(fontSize, 1)}px ${fontFamily}`;
  return context.measureText(text).width;
}
