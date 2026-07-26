import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sip — Find Your People';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0E16',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 90, fontWeight: 700, color: '#EDEFF3', display: 'flex' }}>
          sip
        </div>
        <div style={{ fontSize: 34, color: '#8A93A3', marginTop: 20, display: 'flex' }}>
          Find your people
        </div>
        <div
          style={{
            marginTop: 40,
            padding: '12px 28px',
            borderRadius: 999,
            background: 'rgba(59,130,246,0.12)',
            color: '#70B5F9',
            fontSize: 24,
            display: 'flex',
          }}
        >
          Real conversations, zero cold messages
        </div>
      </div>
    ),
    { ...size }
  );
}