interface ReceiptStatusBadgeProps {
  signed: boolean;
}

export function ReceiptStatusBadge({ signed }: ReceiptStatusBadgeProps) {
  if (signed) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-green-700 bg-green-50 border border-green-200 rounded">
        <span className="w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
        signed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded">
      <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
      unsigned
    </span>
  );
}
