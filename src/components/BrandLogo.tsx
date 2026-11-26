import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface BrandLogoProps {
  brandName: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  brandName,
  logoUrl,
  size = 'sm',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const boxSize =
    size === 'lg'
      ? 'w-12 h-12 rounded-xl'
      : size === 'md'
      ? 'w-9 h-9 rounded-lg'
      : 'w-8 h-8 rounded-lg';

  const iconSize =
    size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  const hasValidImg = Boolean(logoUrl && logoUrl.trim() && !imgFailed);

  return (
    <div className="inline-flex items-center gap-2.5 min-w-0">
      {hasValidImg ? (
        <img
          src={logoUrl}
          alt={brandName}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${boxSize} object-contain bg-white border border-black/10 shrink-0`}
        />
      ) : (
        <div
          className={`${boxSize} bg-[#3D5AFF] text-white flex items-center justify-center shrink-0`}
          aria-hidden="true"
        >
          <ShieldCheck className={iconSize} />
        </div>
      )}
    </div>
  );
};
