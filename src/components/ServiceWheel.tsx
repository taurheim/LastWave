import { useRef, useEffect, useState } from 'react';
import type { ServiceType } from '@/store/index';

interface ServiceWheelProps {
  service: ServiceType;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onServiceChange: (s: ServiceType) => void;
  onSpotifyClick: () => void;
}

const services = [
  { key: 'spotify' as const, label: 'Spotify', icon: '/icons/spotify.svg' },
  { key: 'lastfm' as const, label: 'Last.fm', icon: '/icons/lastfm.svg' },
  { key: 'listenbrainz' as const, label: 'ListenBrainz', icon: '/icons/listenbrainz.svg' },
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
      // Only the center icon is clickable when closed
      if (key === service) onToggleDropdown();
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
    <div className="flex flex-col items-start gap-0">
      {wheelOrder.map((key, i) => {
        const isActive = key === service;
        const isAbove = i === 0;

        return (
          <button
            key={key}
            type="button"
            onClick={() => handleRowClick(key)}
            className={`flex items-center rounded-lg px-1 py-1.5 transition-colors duration-200 ${
              dropdownOpen
                ? 'cursor-pointer hover:bg-lw-accent/10'
                : isActive
                  ? 'cursor-pointer hover:bg-lw-accent/10'
                  : 'pointer-events-none'
            }`}
            style={{ height: 42 }}
            tabIndex={dropdownOpen || isActive ? 0 : -1}
          >
            {/* Icon — always rendered, styles transition smoothly */}
            <img
              src={getIcon(key)}
              alt={isActive ? getLabel(key) : ''}
              className="shrink-0 transition-all duration-300"
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

            {/* Label — slides out to the right via max-width animation */}
            <span
              className="overflow-hidden whitespace-nowrap text-sm transition-all duration-300 ease-out"
              style={{
                maxWidth: dropdownOpen ? 120 : 0,
                opacity: dropdownOpen ? 1 : 0,
                marginLeft: dropdownOpen ? 8 : 0,
              }}
            >
              <span className={isActive ? 'font-medium text-lw-accent' : 'text-lw-text'}>
                {getLabel(key)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
