import { ImageResponse } from 'next/og';

export function generateImageMetadata() {
  return [
    { contentType: 'image/png', size: { width: 32, height: 32 }, id: 'sm' },
    { contentType: 'image/png', size: { width: 192, height: 192 }, id: 'md' },
    { contentType: 'image/png', size: { width: 512, height: 512 }, id: 'lg' },
  ];
}

export default function Icon({ id }: { id: string }) {
  const dim = id === 'sm' ? 32 : id === 'md' ? 192 : 512;
  const radius = id === 'sm' ? 6 : id === 'md' ? 36 : 96;
  const fontSize = id === 'sm' ? 20 : id === 'md' ? 120 : 320;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#1a78c4',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius,
        }}
      >
        <span style={{ color: 'white', fontSize, fontWeight: 700, lineHeight: 1 }}>M</span>
      </div>
    ),
    { width: dim, height: dim }
  );
}
