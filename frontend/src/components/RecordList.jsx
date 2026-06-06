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
}) {
  if (!isAdmin) {
    return (
      <div className="records">
        {items.map((item, i) => (
          <RecordItem
            key={item.id}
            item={item}
            fields={fields}
            index={i}
            isAdmin={false}
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
      className="records records--sortable"
    >
      {items.map((item, i) => (
        <RecordItem
          key={item.id}
          item={item}
          fields={fields}
          index={i}
          isAdmin
          sortable
          onUpdate={onUpdate}
          onRemove={onRemove}
        >
          {renderItem(item)}
        </RecordItem>
      ))}
    </Reorder.Group>
  );
}
