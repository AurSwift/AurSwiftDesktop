interface QuickActionButtonsProps {
  onWeightModalOpen?: () => void;
  onQuantity?: () => void;
  onLineVoid?: () => void;
  onPriceOverride?: () => void;
  onLockTill?: () => void;
  onVoidBasket?: () => void;
  onSaveBasket?: () => void;
  onItemEnquiry?: () => void;
}

const topButtons = [
  { label: "Quantity" },
  { label: "Line void" },
  { label: "Price override" },
];

const bottomButtons = [
  { label: "Lock till" },
  { label: "Void basket" },
  { label: "Save basket" },
  { label: "Item enquiry" },
];

export function QuickActionButtons({
  onWeightModalOpen,
  onQuantity,
  onLineVoid,
  onPriceOverride,
  onLockTill,
  onVoidBasket,
  onSaveBasket,
  onItemEnquiry,
}: QuickActionButtonsProps) {
  const getTopButtonHandler = (label: string) => {
    switch (label) {
      case "Quantity":
        return onQuantity;
      case "Line void":
        return onLineVoid;
      case "Price override":
        return onPriceOverride;
      default:
        return undefined;
    }
  };

  const getBottomButtonHandler = (label: string) => {
    switch (label) {
      case "Lock till":
        return onLockTill;
      case "Void basket":
        return onVoidBasket;
      case "Save basket":
        return onSaveBasket;
      case "Item enquiry":
        return onItemEnquiry || onWeightModalOpen;
      default:
        return undefined;
    }
  };

  return (
    <div className="space-y-2 sm:space-y-3 mt-2">
      {/* Top Row */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {topButtons.map((btn) => (
          <button
            key={btn.label}
            onClick={getTopButtonHandler(btn.label)}
            className="min-h-[44px] bg-slate-200 text-slate-700 font-semibold py-2 sm:py-2.5 lg:py-3 rounded text-xs sm:text-sm hover:bg-slate-300 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!getTopButtonHandler(btn.label)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        {bottomButtons.map((btn) => (
          <button
            key={btn.label}
            onClick={getBottomButtonHandler(btn.label)}
            className="min-h-[44px] bg-sky-600 text-white font-semibold py-2 sm:py-2.5 lg:py-3 rounded text-xs sm:text-sm hover:bg-sky-700 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!getBottomButtonHandler(btn.label)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
