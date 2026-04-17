import { useRef, useEffect, useState } from 'react';
import type { ServiceType } from '@/store/appStore';

interface ServiceWheelProps {
  service: ServiceType;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onServiceChange: (s: ServiceType) => void;
  onSpotifyClick: () => void;
}

const BASE = import.meta.env.BASE_URL;

const services = [
  { key: 'spotify' as const, label: 'Spotify', icon: `${BASE}icons/spotify.svg` },
  { key: 'lastfm' as const, label: 'Last.fm', icon: `${BASE}icons/lastfm.svg` },
  { key: 'listenbrainz' as const, label: 'ListenBrainz', icon: `${BASE}icons/listenbrainz.svg` },
] as const;

type ServiceKey = (typeof services)[number]['key'];

function getWheelOrder(active: ServiceType): [ServiceKey, ServiceKey, ServiceKey] {
  const idx = services.findIndex((s) => s.key === active);
  const above = services[(idx - 1 + services.length) % services.length];
  const below = services[(idx + 1) % services.length];
  return [above.key, active, below.key];
}

function getIcon(key: ServiceKey) {
  return services.find((s) => s.key === key)!.icon;
}

function getLabel(key: ServiceKey) {
  return services.find((s) => s.key === key)!.label;
}

export default function ServiceWheel({
  service,
  dropdownOpen,
  onToggleDropdown,
  onServiceChange,
  onSpotifyClick,
}: ServiceWheelProps) {
  const prevService = useRef(service);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (prevService.current !== service) {
      setAnimating(true);
      prevService.current = service;
      const timer = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [service]);

  function handleRowClick(key: ServiceKey) {
    if (!dropdownOpen) {
      onToggleDropdown();
      return;
    }
    if (key === 'spotify') {
      onSpotifyClick();
    } else if (key !== service) {
      onServiceChange(key);
    } else {
      onToggleDropdown();
    }
  }

  const wheelOrder = getWheelOrder(service);

  return (
    <div className="flex flex-col items-start gap-0" style={{ width: 42, overflow: 'visible' }}>
      {wheelOrder.map((key, i) => {
        const isActive = key === service;
        const isAbove = i === 0;

        return (
          <button
            key={key}
            type="button"
            onClick={() => handleRowClick(key)}
            className="grid cursor-pointer items-center overflow-hidden rounded-lg transition-colors duration-200 hover:bg-lw-accent/10"
            style={{
              height: 42,
              width: dropdownOpen ? 135 : 'max-content',
              gridTemplateColumns: '42px auto',
            }}
            tabIndex={0}
          >
            {/* Icon — in a fixed-width grid cell so it never shifts */}
            <img
              src={getIcon(key)}
              alt={isActive ? getLabel(key) : ''}
              className="shrink-0 justify-self-center transition-all duration-300"
              style={{
                width: isActive ? 40 : 24,
                height: isActive ? 40 : 24,
                opacity: isActive ? 1 : dropdownOpen ? 0.8 : 0.3,
                filter: isActive ? 'none' : dropdownOpen ? 'grayscale(0%)' : 'grayscale(40%)',
                transform:
                  dropdownOpen || isActive
                    ? 'none'
                    : isAbove
                      ? 'perspective(200px) rotateX(30deg)'
                      : 'perspective(200px) rotateX(-30deg)',
              }}
            />

            {/* Label — in auto grid cell, expands rightward without moving icon */}
            <span
              className="overflow-hidden whitespace-nowrap text-sm transition-all duration-300 ease-out"
              style={{
                maxWidth: dropdownOpen ? 100 : 0,
                opacity: dropdownOpen ? 1 : 0,
              }}
            >
              <span
                className={`block px-1 py-1 text-left ${isActive ? 'font-medium text-lw-accent' : 'text-lw-text'}`}
              >
                {getLabel(key)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
