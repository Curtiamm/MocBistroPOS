import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface DishThumbnailProps {
  src?: string;
  alt: string;
  className?: string;
  iconSize?: string;
}

export function DishThumbnail({
  src,
  alt,
  className = 'w-full aspect-[4/3]',
  iconSize = 'w-6 h-6',
}: DishThumbnailProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-[#EFEAE0] flex flex-col items-center justify-center text-[#6B6056]/70 select-none overflow-hidden`}
        aria-label={alt}
      >
        <UtensilsCrossed className={iconSize} />
      </div>
    );
  }

  return (
    <div className={`${className} bg-[#EFEAE0] overflow-hidden`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
