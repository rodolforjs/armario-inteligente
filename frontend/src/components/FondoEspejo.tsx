import { useEffect, useRef, useState } from "react";

export function FondoEspejo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [disponible, setDisponible] = useState(true);

  useEffect(() => {
    let cancelado = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setDisponible(false);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setDisponible(false));

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 bg-black">
      {disponible && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
      )}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}
