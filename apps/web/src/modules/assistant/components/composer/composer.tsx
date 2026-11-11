import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Icon } from "../../../../components/icon/icon";

export function Composer({
  placeholder,
  sendLabel,
  disabled,
  draft,
  onDraftChange,
  onSend,
}: {
  placeholder: string;
  sendLabel: string;
  disabled: boolean;
  draft?: string;
  onDraftChange?: (value: string) => void;
  onSend: (text: string) => void;
}) {
  const [own, setOwn] = useState("");
  const value = draft ?? own;
  const setValue = onDraftChange ?? setOwn;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  }

  // Enter sends; Shift+Enter adds a line, which long Arabic member lists need.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <textarea
        dir="auto"
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label={placeholder}
      />
      <button type="submit" className="send-button" disabled={disabled || !value.trim()} aria-label={sendLabel}>
        <Icon name="send" />
      </button>
    </form>
  );
}
