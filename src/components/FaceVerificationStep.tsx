import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  RefreshCw,
  ScanFace,
} from 'lucide-react';
import { FormConfig } from '../types';
import { BrandLogo } from './BrandLogo';

interface FaceVerificationStepProps {
  config: FormConfig;
  onSuccess: () => void;
  onPhaseChange?: (phase: 'ready' | 'scanning' | 'done') => void;
}

export const FaceVerificationStep: React.FC<FaceVerificationStepProps> = ({
  config,
  onSuccess,
  onPhaseChange,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  const [cameraStatus, setCameraStatus] = useState<'requesting' | 'ready' | 'unavailable'>(
    'requesting'
  );
  const [scanPhase, setScanPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanProgress, setScanProgress] = useState(0);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraStatus('requesting');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('unavailable');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraStatus('ready');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraStatus('unavailable');
    }
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (cameraStatus === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraStatus]);

  const handleStartScan = () => {
    if (scanPhase === 'scanning') return;
    setScanPhase('scanning');
    onPhaseChange?.('scanning');
    setScanProgress(8);

    const startedAt = Date.now();
    const duration = 2200;

    scanTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setScanProgress(pct);

      if (elapsed >= duration) {
        if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
        stopCamera();
        setScanPhase('done');
        onPhaseChange?.('done');

        if (config.autoAdvance) {
          advanceTimerRef.current = window.setTimeout(() => {
            onSuccess();
          }, 1600);
        }
      }
    }, 60);
  };

  if (scanPhase === 'done') {
    return (
      <div className="py-3 space-y-6">
        <div className="p-6 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-emerald-200/80 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <BrandLogo
                brandName={config.brandName}
                logoUrl={config.logoUrl}
                size="md"
              />
              <span className="font-semibold text-black truncate">
                {config.brandName}
              </span>
            </div>
            <span className="font-mono text-xs font-semibold text-emerald-800 shrink-0">
              OK
            </span>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-950">
                {config.faceSuccessTitle}
              </h2>
              <p className="mt-1 text-sm text-emerald-900 leading-relaxed">
                {config.faceSuccessMessage}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
              onSuccess();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3D5AFF] text-white text-sm font-semibold hover:bg-[#2F48E8] transition-colors whitespace-nowrap shrink-0"
          >
            <span>Continuar para código de 8 dígitos</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>

          {config.autoAdvance && (
            <span className="text-xs text-neutral-600">
              Avançando para os 8 dígitos...
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-black">{config.faceTitle}</h2>
        <p className="mt-1 text-sm text-neutral-600">{config.faceHelper}</p>
      </div>

      {/* Biometric Oval Frame */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative w-56 h-72 sm:w-64 sm:h-80 rounded-[128px] overflow-hidden border-4 border-[#FCFC30] bg-neutral-900 shadow-sm flex items-center justify-center">
          {cameraStatus === 'ready' ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-5 space-y-3 text-white/90">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                {cameraStatus === 'requesting' ? (
                  <Camera className="w-7 h-7 text-[#FCFC30]" aria-hidden="true" />
                ) : (
                  <ScanFace className="w-8 h-8 text-[#FCFC30]" aria-hidden="true" />
                )}
              </div>
              <p className="text-xs leading-relaxed text-neutral-200">
                {cameraStatus === 'requesting'
                  ? 'Solicitando acesso à câmera...'
                  : 'Câmera indisponível ou sem permissão no navegador.'}
              </p>
            </div>
          )}

          {/* Subtle Face Alignment Guide */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-4 rounded-[110px] border-2 border-dashed border-white/55"
          />

          {/* Animated Scan Beam during scanning */}
          {scanPhase === 'scanning' && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-4 h-1 bg-[#3D5AFF] shadow-[0_0_14px_3px_#3D5AFF] animate-face-scan"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[#3D5AFF]/10"
              />
            </>
          )}
        </div>

        {/* Status Bar */}
        {scanPhase === 'scanning' ? (
          <div className="w-full max-w-xs space-y-2 text-center">
            <div className="flex items-center justify-between text-xs font-medium text-black">
              <span>Escaneando rosto...</span>
              <span className="font-mono tabular-nums text-[#3D5AFF]">
                {scanProgress}%
              </span>
            </div>
            <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3D5AFF] transition-all duration-100"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-600 text-center max-w-xs">
            {cameraStatus === 'ready'
              ? 'Câmera conectada. Mantenha o rosto iluminado e centralizado.'
              : 'Você pode liberar a câmera ou prosseguir com a validação biométrica assistida.'}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          type="button"
          disabled={scanPhase === 'scanning'}
          onClick={handleStartScan}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#3D5AFF] text-white text-sm font-semibold hover:bg-[#2F48E8] disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
        >
          <ScanFace className="w-4 h-4" aria-hidden="true" />
          <span>
            {scanPhase === 'scanning'
              ? 'Escaneando biometria...'
              : cameraStatus === 'ready'
              ? 'Iniciar escaneamento facial'
              : 'Realizar verificação facial'}
          </span>
        </button>

        {cameraStatus === 'unavailable' && scanPhase === 'idle' && (
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-black hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tentar câmera</span>
          </button>
        )}
      </div>
    </div>
  );
};
