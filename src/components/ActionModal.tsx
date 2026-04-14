import { Check } from 'lucide-react';

interface ActionModalProps {
  avatarUrl?: string | null;
  iconType?: 'check';
  title: string;
  subtitle: string;
  confirmLabel?: string;
  confirmVariant?: 'red' | 'dark';
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
}

export default function ActionModal({
  avatarUrl,
  iconType,
  title,
  subtitle,
  confirmLabel,
  confirmVariant = 'red',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ActionModalProps) {
  return (
    <div className="fixed inset-0 z-[500] flex flex-col justify-end" style={{ maxWidth: '390px', margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-t-3xl pb-10 px-6 pt-3 flex flex-col items-center">
        {/* Pill handle */}
        <div className="w-9 h-1 rounded-full bg-gray-200 mb-6" />

        {/* Avatar or icon */}
        <div className="w-20 h-20 rounded-full overflow-hidden mb-5 flex items-center justify-center bg-gray-100">
          {iconType === 'check' ? (
            <Check size={32} strokeWidth={2.5} className="text-gray-900" />
          ) : avatarUrl ? (
            <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-gray-200 rounded-full" />
          )}
        </div>

        {/* Title */}
        <p className="text-lg font-bold text-gray-900 text-center mb-2">{title}</p>

        {/* Subtitle */}
        <p className="text-sm text-gray-400 text-center leading-snug mb-7">{subtitle}</p>

        {/* Buttons */}
        {confirmLabel && onConfirm && (
          <button
            onClick={onConfirm}
            className={`w-full py-4 rounded-2xl text-white font-bold text-sm mb-3 active:opacity-80 ${
              confirmVariant === 'red' ? 'bg-red-500' : 'bg-gray-900'
            }`}
          >
            {confirmLabel}
          </button>
        )}
        <button
          onClick={onCancel}
          className="w-full py-4 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm active:bg-gray-200"
        >
          {confirmLabel ? cancelLabel : 'Done'}
        </button>
      </div>
    </div>
  );
}
