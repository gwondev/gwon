import { useRef } from "react";
import { Reorder, motion, useDragControls } from "framer-motion";
import RecordItem from "./RecordItem";

// 그리드에서 "보이는 위치대로" 드래그해 순서를 바꾸는 셀
function SortableBubbleCell({ item, itemRefs, onDragMove, children }) {
  const controls = useDragControls();
  const handleProps = { onPointerDown: (e) => controls.start(e) };
  return (
    <motion.div
      layout
      className="bubble-cell"
      ref={(el) => {
        if (el) itemRefs.current.set(item.id, el);
        else itemRefs.current.delete(item.id);
      }}
      drag
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragSnapToOrigin
      whileDrag={{ scale: 1.05, zIndex: 30 }}
      onDrag={(e) => onDragMove(item.id, e.clientX, e.clientY)}
    >
      {children(handleProps)}
    </motion.div>
  );
}

export default function RecordList({
  items,
  fields,
  isAdmin,
  onUpdate,
  onRemove,
  onReorder,
  renderItem,
  renderDetail,
  layout,
}) {
  const bubble = layout === "bubble";
  const baseClass = `records ${bubble ? "records--bubble-grid" : ""}`;
  // 2행으로 나눠 균형 배치 (한 행 최소 4열). ex) 9→5·4, 10→5·5, 11→6·5
  const cols = Math.max(4, Math.ceil((items.length || 1) / 2));
  const gridStyle = bubble ? { "--bubble-cols": cols } : undefined;
  const itemRefs = useRef(new Map());

  // 드래그 중인 버블이 다른 버블 위로 오면 그 위치로 순서 교체 (보이는대로 바로 반영)
  const handleDragMove = (dragId, x, y) => {
    let targetId = null;
    for (const [id, el] of itemRefs.current) {
      if (id === dragId) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        targetId = id;
        break;
      }
    }
    if (targetId == null) return;
    const from = items.findIndex((it) => it.id === dragId);
    const to = items.findIndex((it) => it.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  if (!isAdmin) {
    return (
      <div className={baseClass} style={gridStyle}>
        {items.map((item, i) => (
          <RecordItem
            key={item.id}
            item={item}
            fields={fields}
            index={i}
            isAdmin={false}
            bubble={bubble}
            detail={renderDetail ? renderDetail(item) : undefined}
            onUpdate={onUpdate}
            onRemove={onRemove}
          >
            {renderItem(item)}
          </RecordItem>
        ))}
      </div>
    );
  }

  // 관리자 + 버블 격자: 그리드에서 자유롭게 드래그해 순서 변경
  if (bubble) {
    return (
      <div className={baseClass} style={gridStyle}>
        {items.map((item, i) => (
          <SortableBubbleCell
            key={item.id}
            item={item}
            itemRefs={itemRefs}
            onDragMove={handleDragMove}
          >
            {(handleProps) => (
              <RecordItem
                plain
                item={item}
                fields={fields}
                index={i}
                isAdmin
                bubble
                detail={renderDetail ? renderDetail(item) : undefined}
                dragHandleProps={handleProps}
                onUpdate={onUpdate}
                onRemove={onRemove}
              >
                {renderItem(item)}
              </RecordItem>
            )}
          </SortableBubbleCell>
        ))}
      </div>
    );
  }

  // 관리자 + 일반 목록: 세로 드래그 정렬
  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={onReorder}
      className={`${baseClass} records--sortable`}
    >
      {items.map((item, i) => (
        <RecordItem
          key={item.id}
          item={item}
          fields={fields}
          index={i}
          isAdmin
          sortable
          detail={renderDetail ? renderDetail(item) : undefined}
          onUpdate={onUpdate}
          onRemove={onRemove}
        >
          {renderItem(item)}
        </RecordItem>
      ))}
    </Reorder.Group>
  );
}
