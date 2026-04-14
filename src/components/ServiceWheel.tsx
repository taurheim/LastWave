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
    <div className="flex flex-col items-center gap-0">
      {wheelOrder.map((key, i) => {
        const isActive = key === service;
        const isAbove = i === 0;

        return (
          <button
            key={key}
            type="button"
            onClick={() => handleRowClick(key)}
            className={`relative flex items-center rounded-lg px-1 transition-colors duration-200 cursor-pointer hover:bg-lw-accent/10`}
            style={{ height: 42 }}
            tabIndex={0}
          >
            {/* Label — absolutely positioned so it doesn't shift the icon.
                Mobile (<sm): anchored to the right of this container, grows leftward.
                Desktop (sm+): anchored to the left, grows rightward. */}
            <span
              className={`absolute top-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-sm transition-all duration-300 ease-out
                right-full sm:right-auto sm:left-full`}
              style={{
                maxWidth: dropdownOpen ? 120 : 0,
                opacity: dropdownOpen ? 1 : 0,
              }}
            >
              <span
                className={`block rounded px-2 py-1 ${isActive ? 'font-medium text-lw-accent' : 'text-lw-text'}`}
              >
                {getLabel(key)}
              </span>
            </span>

            {/* Icon */}
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
          </button>
        );
      })}
    </div>
  );
}
