import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, ArrowLeft, Camera, CheckCircle, DoorOpen, Keyboard, Warning, XCircle, ArrowUUpLeft, ClockCounterClockwise } from "@phosphor-icons/react";
import { DecodeHintType } from "@zxing/library";
import type { Gate, ScanResult } from "@cpj/contracts";
import { useNavigate } from "react-router-dom";
import type { IScannerControls } from "@zxing/browser";
import { api } from "../lib/api";

const deviceId = () => { const existing = localStorage.getItem("cpj_device_id"); if (existing) return existing; const id = crypto.randomUUID(); localStorage.setItem("cpj_device_id", id); return id; };
const sound = (success: boolean) => { const context = new AudioContext(); const oscillator = context.createOscillator(); oscillator.connect(context.destination); oscillator.frequency.value = success ? 880 : 220; oscillator.start(); oscillator.stop(context.currentTime + (success ? 0.12 : 0.28)); };
export const cleanupCameraResources = (mediaStream: MediaStream | undefined, controls: IScannerControls | undefined, element: HTMLVideoElement | null, timer: number | undefined) => { if (timer !== undefined) globalThis.clearTimeout(timer); controls?.stop(); mediaStream?.getTracks().forEach((track) => track.stop()); if (element) element.srcObject = null; };

type RecentCheckIn = { id: string; participantName: string | null; gateName: string; checkedInAt: string; voidedAt: string | null };

export function ScannerPage() {
  const navigate = useNavigate(); const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | undefined>(undefined); const scannerControls = useRef<IScannerControls | undefined>(undefined); const detectionTimer = useRef<number | undefined>(undefined); const mounted = useRef(true); const busy = useRef(false); const lastCode = useRef("");
  const stopCamera = useCallback(() => { cleanupCameraResources(stream.current, scannerControls.current, video.current, detectionTimer.current); detectionTimer.current = undefined; scannerControls.current = undefined; stream.current = undefined; }, []);
  const [gates, setGates] = useState<Gate[]>([]); const [gateId, setGateId] = useState(localStorage.getItem("cpj_gate_id") ?? ""); const [manual, setManual] = useState(""); const [cameraState, setCameraState] = useState<"idle"|"active"|"denied">("idle"); const [result, setResult] = useState<ScanResult>(); const [online, setOnline] = useState(navigator.onLine); const [pendingInput, setPendingInput] = useState<{ code: string; requestId: string }>();
  const [allowUndo, setAllowUndo] = useState(() => localStorage.getItem("cpj_allow_undo") !== "false");
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => { mounted.current = true; void api<Gate[]>("/gates").then((data) => { if (mounted.current) setGates(data); }); const onStatus = () => setOnline(navigator.onLine); addEventListener("online", onStatus); addEventListener("offline", onStatus); return () => { mounted.current = false; removeEventListener("online", onStatus); removeEventListener("offline", onStatus); stopCamera(); }; }, [stopCamera]);

  const fetchRecent = useCallback(async () => {
    try { const data = await api<RecentCheckIn[]>("/check-ins/recent"); if (mounted.current) setRecent(data); } catch { /* ignore */ }
  }, []);

  const submit = useCallback(async (code: string, requestId: string = crypto.randomUUID()) => { if (!gateId || !online || busy.current || !code.trim()) return; busy.current = true; setPendingInput({ code, requestId }); setResult(undefined); try { const scan = await api<ScanResult>("/check-ins", { method: "POST", body: JSON.stringify({ code, requestId, deviceId: deviceId(), gateId }) }); setResult(scan); setPendingInput(undefined); const success = scan.status === "CHECKED_IN"; sound(success); navigator.vibrate?.(success ? 100 : [180, 80, 180]); if (success) void fetchRecent(); setTimeout(() => { busy.current = false; lastCode.current = ""; }, success ? 900 : 1400); } catch { setResult({ status: "SERVICE_UNAVAILABLE" }); busy.current = false; } }, [gateId, online, fetchRecent]);

  const undo = useCallback(async (checkInId: string) => {
    try { await api(`/check-ins/${checkInId}/undo`, { method: "POST" }); setResult(undefined); void fetchRecent(); } catch (err: any) { alert(err?.message || "Gagal undo"); }
  }, [fetchRecent]);

  const startCamera = async () => { if (!gateId) return; stopCamera(); try { const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); if (!mounted.current || !video.current) { mediaStream.getTracks().forEach((track) => track.stop()); return; } stream.current = mediaStream; video.current.srcObject = mediaStream; await video.current.play(); if (!mounted.current) { stopCamera(); return; } setCameraState("active"); const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/browser"); if (!mounted.current || !video.current || !stream.current) return; const hints = new Map(); hints.set(DecodeHintType.TRY_HARDER, true); hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.DATA_MATRIX]); const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200, delayBetweenScanSuccess: 700 }); scannerControls.current = await reader.decodeFromVideoElement(video.current, (decoded) => { const code = decoded?.getText(); if (code && code !== lastCode.current) { lastCode.current = code; void submit(code); } }); if (!mounted.current) stopCamera(); } catch { stopCamera(); if (mounted.current) setCameraState("denied"); } };
  useEffect(() => { let buffer = ""; let timer = 0; const listener = (event: globalThis.KeyboardEvent) => { if ((event.target as HTMLElement).tagName === "INPUT") return; if (event.key === "Enter" && buffer) { void submit(buffer); buffer = ""; return; } if (event.key.length === 1) { buffer += event.key; clearTimeout(timer); timer = window.setTimeout(() => { buffer = ""; }, 500); } }; addEventListener("keydown", listener); return () => removeEventListener("keydown", listener); }, [submit]);
  const success = result?.status === "CHECKED_IN"; const duplicate = result?.status === "ALREADY_CHECKED_IN"; const message: Record<string,string> = { CHECKED_IN: "Tiket diterima", ALREADY_CHECKED_IN: "Tiket sudah digunakan", INVALID_TICKET: "Tiket tidak ditemukan", NOT_PAID: "Tiket belum lunas", REFUNDED: "Tiket sudah direfund", CANCELLED: "Tiket dibatalkan", INACTIVE_TICKET: "Tiket tidak aktif", GATE_INACTIVE: "Gate sudah dinonaktifkan", SERVICE_UNAVAILABLE: "Koneksi terganggu" };
  const back = () => { stopCamera(); setResult(undefined); setShowRecent(false); navigate("/admin"); };

  const toggleUndo = () => {
    const next = !allowUndo;
    setAllowUndo(next);
    localStorage.setItem("cpj_allow_undo", String(next));
  };

  return <main className={`scanner-page ${result ? success ? "status-success" : result.status === "SERVICE_UNAVAILABLE" ? "status-warning" : "status-error" : ""}`}>
    <header className="scanner-header">
      <div className="brand compact"><span>CPJ</span><small>SCANNER</small></div>
      <div className={`network ${online ? "online" : "offline"}`}><i />{online ? "Online" : "Offline"}</div>
      <div className="scanner-actions">
        <button className="icon-button" onClick={() => setShowRecent((s) => !s)} aria-label="Riwayat"><ClockCounterClockwise size={24}/></button>
        <button className="icon-button" onClick={() => void back()} aria-label="Kembali ke dashboard"><ArrowLeft size={24}/></button>
      </div>
    </header>
    <section className="scanner-workspace">
      <div className="scanner-controls">
        <label><DoorOpen size={20}/> Gate<select value={gateId} onChange={(event) => { setGateId(event.target.value); localStorage.setItem("cpj_gate_id", event.target.value); }}><option value="">Pilih gate</option>{gates.filter((gate) => gate.isActive).map((gate) => <option value={gate.id} key={gate.id}>{gate.name}</option>)}</select></label>
        <label className="toggle-undo"><input type="checkbox" checked={allowUndo} onChange={toggleUndo}/> Undo</label>
        {cameraState === "idle" && <button className="button primary" disabled={!gateId || !online} onClick={() => void startCamera()}><Camera size={22}/>Mulai Kamera</button>}
      </div>
      <div className="camera-frame">
        <video ref={video} muted playsInline />
        <div className="scan-guide"><span/><span/><span/><span/></div>
        {cameraState === "idle" && <div className="camera-placeholder"><Camera size={48}/><strong>Kamera belum aktif</strong><p>Pilih gate, lalu mulai kamera.</p></div>}
        {cameraState === "denied" && <div className="camera-placeholder"><Warning size={48}/><strong>Kamera tidak tersedia</strong><p>Gunakan scanner fisik atau input manual.</p></div>}
      </div>
      <form className="manual-form" onSubmit={(event) => { event.preventDefault(); void submit(manual); setManual(""); }}><Keyboard size={22}/><input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Masukkan kode tiket" aria-label="Kode tiket manual"/><button disabled={!gateId || !online}>Periksa</button></form>
    </section>
    {result && <section className="scan-result" role="status">
      <div className="result-icon">{success ? <CheckCircle weight="fill"/> : result.status === "SERVICE_UNAVAILABLE" ? <Warning weight="fill"/> : <XCircle weight="fill"/>}</div>
      <p className="kicker">{success ? "AKSES DIIZINKAN" : duplicate ? "DUPLIKAT" : result.status === "SERVICE_UNAVAILABLE" ? "PERLU DICOBA LAGI" : "AKSES DITOLAK"}</p>
      <h1>{message[result.status]}</h1>
      {result.participantName && <h2>{result.participantName}</h2>}
      <div className="result-meta">{result.code && <span>{result.code}</span>}{result.gateName && <span>{result.gateName}</span>}{result.checkedInAt && <span>{new Date(result.checkedInAt).toLocaleTimeString("id-ID")}</span>}</div>
      {success && <p>{result.maskedWhatsapp} · {result.maskedEmail}</p>}
      {result.status === "SERVICE_UNAVAILABLE" && pendingInput && <button className="button dark" onClick={() => void submit(pendingInput.code, pendingInput.requestId)}><ArrowCounterClockwise/>Coba Lagi</button>}
      {success && allowUndo && result.checkInId && <button className="button undo" onClick={() => void undo(result.checkInId!)}><ArrowUUpLeft/>Undo</button>}
      <button className="result-dismiss" onClick={() => setResult(undefined)}>Tutup hasil</button>
    </section>}
    {showRecent && <section className="recent-panel">
      <h3>Riwayat Scan</h3>
      <button className="icon-button close" onClick={() => setShowRecent(false)}><XCircle/></button>
      <ul>{recent.map((r) => (
        <li key={r.id} className={r.voidedAt ? "voided" : ""}>
          <strong>{r.participantName || "-"}</strong>
          <span>{r.gateName} · {new Date(r.checkedInAt).toLocaleTimeString("id-ID")}</span>
          {!r.voidedAt && allowUndo && <button className="undo-mini" onClick={() => void undo(r.id)}><ArrowUUpLeft size={16}/></button>}
        </li>
      ))}</ul>
    </section>}
  </main>;
}
