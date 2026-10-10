import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";

export type CameraCaptureHandle = {
  capturar: () => void;
  usarFoto: () => void;
  repetir: () => void;
};

export const CameraCapture = forwardRef<
  CameraCaptureHandle,
  {
    onCapture: (file: File) => void;
    onCancel: () => void;
    onUnavailable: () => void;
    onEstadoFoto?: (hayFoto: boolean) => void;
  }
>(function CameraCapture(
  { onCapture, onCancel, onUnavailable, onEstadoFoto },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailable();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => onUnavailable());

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capturar() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setFoto(canvas.toDataURL("image/jpeg", 0.9));
    onEstadoFoto?.(true);
  }

  function repetir() {
    setFoto(null);
    onEstadoFoto?.(false);
  }

  function usarFoto() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(
          new File([blob], `prenda-${Date.now()}.jpg`, { type: "image/jpeg" }),
        );
      },
      "image/jpeg",
      0.9,
    );
  }

  useImperativeHandle(ref, () => ({ capturar, usarFoto, repetir }));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden">
        {!foto && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        {foto && (
          <img
            src={foto}
            alt="captura"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex gap-2">
        {!foto ? (
          <>
            <Button type="button" onClick={capturar} className="flex-1">
              📸 Capturar
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={usarFoto} className="flex-1">
              Usar esta foto
            </Button>
            <Button type="button" variant="outline" onClick={repetir}>
              Repetir
            </Button>
          </>
        )}
      </div>
    </div>
  );
});
