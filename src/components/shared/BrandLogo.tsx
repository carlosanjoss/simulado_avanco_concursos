import Image from 'next/image';

export function BrandLogo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center overflow-hidden ${compact ? 'w-36 h-10' : 'w-48 h-12'}`}>
      <Image
        src="/images/avanco-logo.png"
        alt="Avanço Simulados"
        width={420}
        height={140}
        className={`w-full h-auto object-contain ${light ? 'brightness-0 invert' : ''}`}
        priority
      />
    </span>
  );
}
