import React from 'react';
import '../../styles/Components.css';

const Tooltip = ({
    x,
    y,
    containerRef,
    items,
    children,
    className = '',
    estimatedWidth = 148,
    estimatedHeight = 100,
    offset = 12,
    placement = 'auto',
    align = 'end',
    renderItem,
    style,
}) => {
    const hasItems = Array.isArray(items) && items.length > 0;
    if (!hasItems && !children) return null;

    const containerW = containerRef?.current?.offsetWidth ?? 9999;
    const containerH = containerRef?.current?.offsetHeight ?? 9999;

    // --- Vertical position ---
    let top;
    if (placement === 'top') {
        // y = top edge of anchor; tooltip sits above it — allow negative to escape container upward
        top = y - estimatedHeight - offset;
    } else if (placement === 'bottom') {
        top = y + offset;
    } else if (placement === 'side') {
        // For graph crosshair tooltips: vertically centre on cursor,
        // clamped so it never overflows the container.
        top = Math.max(0, Math.min(y - estimatedHeight / 2, containerH - estimatedHeight));
    } else {
        // 'auto': prefer above, fall back to below
        const wouldOverflowBelow = y + estimatedHeight > containerH;
        top = wouldOverflowBelow
            ? Math.max(0, y - estimatedHeight - offset)
            : y + offset;
    }

    // --- Horizontal position ---
    let left;
    if (placement === 'side') {
        // Prefer left-of-cursor, flip right if no room
        const toLeft = x - estimatedWidth - offset;
        left = toLeft < 0 ? x + offset : toLeft;
    } else if (placement === 'top' || placement === 'bottom') {
        // Centre on x, clamped so it never overflows either edge
        const centred = x - estimatedWidth / 2;
        left = Math.max(0, Math.min(centred, containerW - estimatedWidth));
    } else {
        // 'auto' / legacy: align-based with left-edge flip guard
        const flipRight = x - estimatedWidth < 0;
        const baseLeft = align === 'center'
            ? x - estimatedWidth / 2
            : align === 'start'
                ? x
                : x - estimatedWidth;
        left = flipRight ? Math.min(x + offset, containerW - estimatedWidth) : baseLeft;
    }

    return (
        <div
            className={`ui-tooltip ${className}`.trim()}
            style={{ left, top, ...style }}
            role="tooltip"
        >
            {hasItems
                ? items.map((item, i) => (
                    renderItem
                        ? <React.Fragment key={i}>{renderItem(item, i)}</React.Fragment>
                        : (
                            <div key={i} className="ui-tooltip-row">
                                {item.swatchColor && (
                                    <span
                                        className="ui-tooltip-swatch"
                                        style={{ background: item.swatchColor }}
                                    />
                                )}
                                {item.label != null && (
                                    <span className="ui-tooltip-label">{item.label}</span>
                                )}
                                {item.value != null && (
                                    <span className="ui-tooltip-value">{item.value}</span>
                                )}
                            </div>
                        )
                ))
                : children}
        </div>
    );
};

export default Tooltip;