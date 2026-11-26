import React, { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface OtpDigitInputProps {
  length: number;
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  groupAfter?: number;
  masked?: boolean;
  allowMaskToggle?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  isSuccess?: boolean;
  ariaLabelPrefix?: string;
  autoFocus?: boolean;
}

export const OtpDigitInput: React.FC<OtpDigitInputProps> = ({
  length,
  value,
  onChange,
  onComplete,
  groupAfter,
  masked = false,
  allowMaskToggle = false,
  disabled = false,
  hasError = false,
  isSuccess = false,
  ariaLabelPrefix = 'Dígito',
  autoFocus = true,
}) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [isMasked, setIsMasked] = useState(masked);

  const digits = Array.from({ length }, (_, idx) => value[idx] ?? '');

  const focusIndex = (idx: number) => {
    const target = inputRefs.current[Math.max(0, Math.min(length - 1, idx))];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const updateAt = (idx: number, char: string) => {
    const next = digits.slice();
    next[idx] = char;
    const joined = next.join('');
    onChange(joined);
    if (joined.length === length && !next.includes('') && onComplete) {
      onComplete(joined);
    }
  };

  const handleChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      updateAt(idx, '');
      return;
    }

    if (raw.length > 1) {
      const next = digits.slice();
      for (let i = 0; i < raw.length && idx + i < length; i++) {
        next[idx + i] = raw[i];
      }
      const joined = next.join('');
      onChange(joined);
      const nextFocus = Math.min(length - 1, idx + raw.length);
      focusIndex(nextFocus);
      if (joined.length === length && !next.includes('') && onComplete) {
        onComplete(joined);
      }
      return;
    }

    updateAt(idx, raw);
    if (idx < length - 1) {
      focusIndex(idx + 1);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        e.preventDefault();
        updateAt(idx, '');
      } else if (idx > 0) {
        e.preventDefault();
        updateAt(idx - 1, '');
        focusIndex(idx - 1);
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      focusIndex(idx - 1);
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      e.preventDefault();
      focusIndex(idx + 1);
    }
  };

  const handlePaste = (idx: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;

    const startIdx = pasted.length >= length ? 0 : idx;
    const next = digits.slice();
    for (let i = 0; i < pasted.length && startIdx + i < length; i++) {
      next[startIdx + i] = pasted[i];
    }
    const joined = next.join('');
    onChange(joined);

    const lastFilled = Math.min(length - 1, startIdx + pasted.length - 1);
    focusIndex(lastFilled < length - 1 ? lastFilled + 1 : length - 1);

    if (joined.length === length && !next.includes('') && onComplete) {
      onComplete(joined);
    }
  };

  const slotSizeClass =
    length === 8
      ? 'w-10 h-12 sm:w-12 sm:h-14 text-lg sm:text-xl'
      : 'w-12 h-14 sm:w-14 sm:h-16 text-xl sm:text-2xl';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {digits.map((digit, idx) => {
          const showSeparator = groupAfter !== undefined && idx === groupAfter;

          const stateStyle = hasError
            ? 'border-red-500 bg-red-50/50 text-red-900 focus:border-red-600 focus:ring-red-600/15'
            : isSuccess
            ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900 focus:border-emerald-600 focus:ring-emerald-600/15'
            : digit
            ? 'border-[#3D5AFF] bg-[#FCFC30]/20 text-black focus:border-[#3D5AFF] focus:ring-[#3D5AFF]/20'
            : 'border-neutral-300 bg-neutral-50 text-black focus:border-[#3D5AFF] focus:bg-white focus:ring-[#3D5AFF]/20';

          return (
            <React.Fragment key={idx}>
              {showSeparator && (
                <span
                  aria-hidden="true"
                  className="text-neutral-400 font-mono text-lg select-none px-0.5"
                >
                  -
                </span>
              )}
              <input
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type={isMasked ? 'password' : 'text'}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoFocus={autoFocus && idx === 0}
                maxLength={length}
                disabled={disabled}
                value={digit}
                aria-label={`${ariaLabelPrefix} ${idx + 1} de ${length}`}
                onChange={(e) => handleChange(idx, e)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={(e) => handlePaste(idx, e)}
                onFocus={(e) => e.target.select()}
                className={`${slotSizeClass} font-mono font-semibold tabular-nums text-center rounded-lg border transition-colors duration-150 outline-none focus:ring-4 disabled:opacity-60 disabled:cursor-not-allowed ${stateStyle}`}
              />
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-600">
        <span className="font-mono tabular-nums text-black">
          {value.replace(/\D/g, '').length}/{length} dígitos preenchidos
        </span>

        {allowMaskToggle && (
          <button
            type="button"
            onClick={() => setIsMasked((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-[#3D5AFF] hover:opacity-80 font-medium transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5AFF] rounded px-1.5 py-1"
          >
            {isMasked ? (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mostrar dígitos</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ocultar dígitos</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
