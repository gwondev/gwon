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
}) {
  // 공개(또는 관리자의 "사용자 보기") 화면: layout="bubble" 이면 격자 버블로 표시
  if (!isAdmin) {
    const bubble = layout === "bubble";
    return (
      <div className={`records ${bubble ? "records--bubble-grid" : ""}`}>
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
