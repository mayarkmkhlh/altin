import { Icon, type IconName } from "../icon/icon";

export type TabItem<T extends string> = { value: T; label: string; icon: IconName; count?: number; disabled?: boolean };

export function TabBar<T extends string>({
  items,
  value,
  onChange,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <nav className="tab-bar">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={item.value === value ? "tab is-on" : "tab"}
          aria-current={item.value === value ? "page" : undefined}
          disabled={item.disabled}
          onClick={() => onChange(item.value)}
        >
          <span className="tab-icon">
            <Icon name={item.icon} />
            {item.count ? <span className="tab-count">{item.count}</span> : null}
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
