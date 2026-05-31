import React from 'react';
import { ContingencyPlan } from '../types/client.types';

interface EventContingencyPanelProps {
  eventType: string;
  plan: ContingencyPlan | undefined;
  affectedRegion: { x: number; y: number; radius: number };
}

/**
 * Detailed panel showing the AND-OR contingency plan with 2 decision branches.
 * Branch 1: Seeker strategy (blue)
 * Branch 2: Ghost strategy (green)
 */
export const EventContingencyPanel: React.FC<EventContingencyPanelProps> = ({
  eventType,
  plan,
  affectedRegion,
}) => {
  if (!plan || !plan.branches || plan.branches.length < 2) {
    return null;
  }

  const eventInfo: Record<
    string,
    { icon: string; title: string; description: string }
  > = {
    fog: {
      icon: '🌫️',
      title: 'FOG EVENT',
      description: 'Visibility reduced — both players must adapt their strategies.',
    },
    storm: {
      icon: '⛈️',
      title: 'STORM EVENT',
      description: 'Movement chaos — unpredictable zone creates tactical opportunities.',
    },
    sensor_disruption: {
      icon: '📡',
      title: 'SENSOR DISRUPTION',
      description: 'Sensors offline — Seeker loses detection capability temporarily.',
    },
  };

  const info =
    eventInfo[eventType] ||
    {
      icon: '⚡',
      title: eventType.toUpperCase(),
      description: 'A nondeterministic event has occurred.',
    };

  const seekerBranch = plan.branches[0];
  const ghostBranch = plan.branches[1];

  return (
    <div className="bg-gray-950 border border-gray-700 rounded-lg p-4 space-y-4 text-xs font-mono">
      {/* Header */}
      <div>
        <div className="text-xl mb-1">{info.icon}</div>
        <div className="text-lg font-bold text-white mb-1">{info.title}</div>
        <div className="text-gray-400 text-xs">{info.description}</div>
        <div className="text-gray-500 mt-2">
          Affected Region: ({affectedRegion.x}, {affectedRegion.y}) radius {affectedRegion.radius}
        </div>
      </div>

      <div className="border-t border-gray-700" />

      {/* SEEKER BRANCH (Branch 1) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-blue-400 text-lg">🔍</div>
          <div className="text-blue-400 font-bold">SEEKER CONTINGENCY</div>
        </div>

        <div className="bg-blue-950 border border-blue-700 rounded p-3 space-y-2">
          {/* Branch condition */}
          <div className="text-blue-300 italic text-xs">{seekerBranch.condition}</div>

          {/* Recommended actions */}
          {seekerBranch.children && seekerBranch.children.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-blue-400 font-semibold text-xs">Recommended Actions:</div>

              {seekerBranch.children.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="text-blue-300 font-bold flex-shrink-0 min-w-5">[{idx + 1}]</div>
                  <div className="flex-1">
                    <div className="text-blue-200">
                      {formatAction(action.action)}
                    </div>
                    <div className="text-blue-400 text-xs">{action.condition}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GHOST BRANCH (Branch 2) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-green-400 text-lg">👻</div>
          <div className="text-green-400 font-bold">GHOST CONTINGENCY</div>
        </div>

        <div className="bg-green-950 border border-green-700 rounded p-3 space-y-2">
          {/* Branch condition */}
          <div className="text-green-300 italic text-xs">{ghostBranch.condition}</div>

          {/* Recommended actions */}
          {ghostBranch.children && ghostBranch.children.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-green-400 font-semibold text-xs">Recommended Actions:</div>

              {ghostBranch.children.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="text-green-300 font-bold flex-shrink-0 min-w-5">[{idx + 1}]</div>
                  <div className="flex-1">
                    <div className="text-green-200">
                      {formatAction(action.action)}
                    </div>
                    <div className="text-green-400 text-xs">{action.condition}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Strategy note */}
      <div className="bg-gray-900 border border-gray-700 rounded p-2 text-gray-400 text-xs">
        <div className="font-semibold text-gray-300 mb-1">💡 Strategy Tip:</div>
        <div>
          Both players have access to AI-recommended actions. The Seeker should focus on the blue
          branch options, while the Ghost should consider the green branch strategies. Adapt based
          on current situation!
        </div>
      </div>
    </div>
  );
};

/**
 * Format an action object into a human-readable string.
 */
function formatAction(action: any): string {
  if (!action) return 'No action';

  switch (action.type) {
    case 'SCAN':
      return `SCAN at (${action.x}, ${action.y}) with radius ${action.radius}`;
    case 'LOCK':
      return `LOCK target at (${action.x}, ${action.y})`;
    case 'MOVE':
      return `MOVE to (${action.x}, ${action.y})`;
    case 'THROW_DECOY':
      return `THROW_DECOY at (${action.x}, ${action.y})`;
    case 'MAKE_NOISE':
      return `MAKE_NOISE at (${action.x}, ${action.y}) radius ${action.radius}`;
    case 'LAY_FALSE_TRAIL':
      return `LAY_FALSE_TRAIL`;
    case 'COMPLETE_OBJECTIVE':
      return `COMPLETE_OBJECTIVE at (${action.x}, ${action.y})`;
    default:
      return `${action.type}`;
  }
}
