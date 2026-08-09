import { Reorder } from "framer-motion";
import RecordItem from "./RecordItem";

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
  cols = 5,
}) {
  const bubble = layout === "bubble";
  const baseClass = `records ${bubble ? "records--bubble-grid" : ""}`;
  const gridStyle = bubble ? { "--bubble-cols": cols } : undefined;

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

  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={onReorder}
      className={`${baseClass} records--sortable`}
      style={gridStyle}
    >
      {items.map((item, i) => (
        <RecordItem
          key={item.id}
          item={item}
          fields={fields}
          index={i}
          isAdmin
          sortable
          bubble={bubble}
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
